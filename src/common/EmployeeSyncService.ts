import { Employee } from '../modules/employee/models/employee.model';
import { AzureEmployeeService } from './AzureEmployeeService';
import { EmployeeRepository } from '../modules/employee/repositories/EmployeeRepository';
import {
  EmployeeDirectoryMatchResult,
  EmployeeDirectoryService,
} from '../modules/employee/services/EmployeeDirectoryService';

export interface SyncResult {
  newUsers: number;
  updatedUsers: number;
  totalProcessed: number;
  errors: string[];
  matchedExternalRecords: number;
  unmatchedAzureEmployees: number;
  unmatchedExternalRecords: number;
}

export class EmployeeSyncService {
  private azureEmployeeService: AzureEmployeeService;
  private employeeRepository: EmployeeRepository;
  private employeeDirectoryService?: EmployeeDirectoryService;

  constructor(
    azureEmployeeService: AzureEmployeeService,
    employeeRepository: EmployeeRepository,
    employeeDirectoryService?: EmployeeDirectoryService
  ) {
    this.azureEmployeeService = azureEmployeeService;
    this.employeeRepository = employeeRepository;
    this.employeeDirectoryService = employeeDirectoryService;
  }

  async syncEmployeesFromAzure(): Promise<SyncResult> {
    const result: SyncResult = {
      newUsers: 0,
      updatedUsers: 0,
      totalProcessed: 0,
      errors: [],
      matchedExternalRecords: 0,
      unmatchedAzureEmployees: 0,
      unmatchedExternalRecords: 0,
    };

    try {
      const azureEmployees = await this.azureEmployeeService.getAllActiveEmployees();
      const matchResult = await this.enrichWithExternalDirectory(azureEmployees);
      result.matchedExternalRecords = matchResult.matches;
      result.unmatchedAzureEmployees = matchResult.unmatchedAzureEmployees.length;
      result.unmatchedExternalRecords = matchResult.unmatchedExternalRecords.length;

      const enrichedEmployees = matchResult.enrichedEmployees;
      const existingEmployees = await this.employeeRepository.findSyncableEmployees();

      const existingEmployeeMap = new Map<string, Employee>();
      existingEmployees.forEach(emp => existingEmployeeMap.set(emp.id, emp));

      for (const azureEmployee of enrichedEmployees) {
        result.totalProcessed++;

        try {
          const existingEmployee = existingEmployeeMap.get(azureEmployee.id);

          if (!existingEmployee) {
            await this.employeeRepository.create(azureEmployee);
            result.newUsers++;
          } else if (this.hasEmployeeChanged(existingEmployee, azureEmployee)) {
            const updatedEmployee = {
              ...azureEmployee,
              createdAt: existingEmployee.createdAt,
              updatedAt: new Date(),
            };
            await this.employeeRepository.update(azureEmployee.id, updatedEmployee);
            result.updatedUsers++;
          }
        } catch (error) {
          const errorMessage = `Error processing employee ${azureEmployee.id}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
        }
      }
      await this.deactivateRemovedEmployees(enrichedEmployees, existingEmployees);
    } catch (error) {
      const errorMessage = `Error during sync: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMessage);
    }

    return result;
  }

  private hasEmployeeChanged(existing: Employee, azure: Employee): boolean {
    return (
      existing.fullName !== azure.fullName ||
      existing.email !== azure.email ||
      existing.department !== azure.department ||
      existing.position !== azure.position ||
      existing.reportsTo !== azure.reportsTo ||
      existing.directReportsCount !== azure.directReportsCount ||
      existing.location !== azure.location ||
      existing.isActive !== azure.isActive
    );
  }

  private async deactivateRemovedEmployees(
    azureEmployees: Employee[],
    existingEmployees: Employee[]
  ): Promise<void> {
    const azureEmployeeIds = new Set(azureEmployees.map(emp => emp.id));

    for (const existing of existingEmployees) {
      if (!azureEmployeeIds.has(existing.id) && existing.isActive) {
        const deactivatedEmployee = {
          ...existing,
          isActive: false,
          updatedAt: new Date(),
        };
        await this.employeeRepository.update(existing.id, deactivatedEmployee);
      }
    }
  }

  async syncSingleEmployee(employeeId: string): Promise<{
    success: boolean;
    message: string;
    employee?: Employee;
    matchedWithExternal?: boolean;
  }> {
    try {
      const azureEmployee = await this.azureEmployeeService.getEmployeeById(employeeId);

      if (!azureEmployee) {
        return { success: false, message: 'Employee not found in Azure AD' };
      }

      const matchResult = await this.enrichWithExternalDirectory([azureEmployee]);
      const enrichedEmployee = matchResult.enrichedEmployees[0] || azureEmployee;
      const matchedWithExternal = matchResult.matches > 0;

      const existingEmployee = await this.employeeRepository.findById(employeeId);

      if (!existingEmployee) {
        const createdEmployee = await this.employeeRepository.create(enrichedEmployee);
        return {
          success: true,
          message: 'New employee created',
          employee: createdEmployee,
          matchedWithExternal,
        };
      } else if (this.hasEmployeeChanged(existingEmployee, enrichedEmployee)) {
        const updatedEmployee = {
          ...enrichedEmployee,
          createdAt: existingEmployee.createdAt,
          updatedAt: new Date(),
        };
        const updated = await this.employeeRepository.update(employeeId, updatedEmployee);
        return {
          success: true,
          message: 'Employee updated',
          employee: updated,
          matchedWithExternal,
        };
      } else {
        return {
          success: true,
          message: 'No changes detected',
          employee: existingEmployee,
          matchedWithExternal,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error syncing employee: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async enrichWithExternalDirectory(
    employees: Employee[]
  ): Promise<EmployeeDirectoryMatchResult> {
    if (!this.employeeDirectoryService) {
      console.log('[EmployeeSyncService] No employee directory service configured - CSV merge disabled');
      return {
        enrichedEmployees: employees.map(employee => ({ ...employee })),
        matches: 0,
        unmatchedAzureEmployees: employees,
        unmatchedExternalRecords: [],
      };
    }

    if (employees.length === 0) {
      console.log('[EmployeeSyncService] No employees to enrich');
      return {
        enrichedEmployees: [],
        matches: 0,
        unmatchedAzureEmployees: [],
        unmatchedExternalRecords: [],
      };
    }

    try {
      console.log(`[EmployeeSyncService] Attempting to enrich ${employees.length} employees with CSV data`);
      const result = await this.employeeDirectoryService.matchEmployees(employees);
      console.log(`[EmployeeSyncService] CSV merge result: ${result.matches} matches, ${result.unmatchedAzureEmployees.length} unmatched Azure employees, ${result.unmatchedExternalRecords.length} unmatched CSV records`);
      return result;
    } catch (error) {
      console.warn('[EmployeeSyncService] Failed to match external directory:', error);
      return {
        enrichedEmployees: employees.map(employee => ({ ...employee })),
        matches: 0,
        unmatchedAzureEmployees: employees,
        unmatchedExternalRecords: [],
      };
    }
  }
}
