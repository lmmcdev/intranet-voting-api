import { Employee } from '../modules/employee/models/employee.model';
import { AzureEmployeeService } from './AzureEmployeeService';
import { EmployeeRepository } from './repositories/EmployeeRepository';

export interface SyncResult {
  newUsers: number;
  updatedUsers: number;
  totalProcessed: number;
  errors: string[];
}

export class EmployeeSyncService {
  private azureEmployeeService: AzureEmployeeService;
  private employeeRepository: EmployeeRepository;

  constructor(azureEmployeeService: AzureEmployeeService, employeeRepository: EmployeeRepository) {
    this.azureEmployeeService = azureEmployeeService;
    this.employeeRepository = employeeRepository;
  }

  async syncEmployeesFromAzure(): Promise<SyncResult> {
    const result: SyncResult = {
      newUsers: 0,
      updatedUsers: 0,
      totalProcessed: 0,
      errors: []
    };

    try {
      const azureEmployees = await this.azureEmployeeService.getAllActiveEmployees();
      const existingEmployees = await this.employeeRepository.findAll();

      const existingEmployeeMap = new Map<string, Employee>();
      existingEmployees.forEach(emp => existingEmployeeMap.set(emp.id, emp));

      for (const azureEmployee of azureEmployees) {
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
              updatedAt: new Date()
            };
            await this.employeeRepository.update(azureEmployee.id, updatedEmployee);
            result.updatedUsers++;
          }
        } catch (error) {
          const errorMessage = `Error processing employee ${azureEmployee.id}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
        }
      }

      await this.deactivateRemovedEmployees(azureEmployees, existingEmployees);

    } catch (error) {
      const errorMessage = `Error during sync: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMessage);
    }

    return result;
  }

  private hasEmployeeChanged(existing: Employee, azure: Employee): boolean {
    return (
      existing.name !== azure.name ||
      existing.email !== azure.email ||
      existing.department !== azure.department ||
      existing.position !== azure.position ||
      existing.isActive !== azure.isActive
    );
  }

  private async deactivateRemovedEmployees(azureEmployees: Employee[], existingEmployees: Employee[]): Promise<void> {
    const azureEmployeeIds = new Set(azureEmployees.map(emp => emp.id));

    for (const existing of existingEmployees) {
      if (!azureEmployeeIds.has(existing.id) && existing.isActive) {
        const deactivatedEmployee = {
          ...existing,
          isActive: false,
          updatedAt: new Date()
        };
        await this.employeeRepository.update(existing.id, deactivatedEmployee);
      }
    }
  }

  async syncSingleEmployee(employeeId: string): Promise<{ success: boolean; message: string; employee?: Employee }> {
    try {
      const azureEmployee = await this.azureEmployeeService.getEmployeeById(employeeId);

      if (!azureEmployee) {
        return { success: false, message: 'Employee not found in Azure AD' };
      }

      const existingEmployee = await this.employeeRepository.findById(employeeId);

      if (!existingEmployee) {
        const createdEmployee = await this.employeeRepository.create(azureEmployee);
        return {
          success: true,
          message: 'New employee created',
          employee: createdEmployee
        };
      } else if (this.hasEmployeeChanged(existingEmployee, azureEmployee)) {
        const updatedEmployee = {
          ...azureEmployee,
          createdAt: existingEmployee.createdAt,
          updatedAt: new Date()
        };
        const updated = await this.employeeRepository.update(employeeId, updatedEmployee);
        return {
          success: true,
          message: 'Employee updated',
          employee: updated
        };
      } else {
        return {
          success: true,
          message: 'No changes detected',
          employee: existingEmployee
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error syncing employee: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}