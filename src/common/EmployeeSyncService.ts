import { Employee } from '../modules/employee/models/employee.model';
import { AzureEmployeeService } from './AzureEmployeeService';
import { EmployeeRepository } from '../modules/employee/repositories/EmployeeRepository';
import {
  EmployeeDirectoryMatchResult,
  EmployeeDirectoryService,
} from '../modules/employee/services/EmployeeDirectoryService';
import { VotingGroupService } from './VotingGroupService';
import { PasswordHelper } from './utils/PasswordHelper';
import { DEFAULT_INITIAL_PASSWORD } from '../config/env.config';

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
  private votingGroupService?: VotingGroupService;

  constructor(
    azureEmployeeService: AzureEmployeeService,
    employeeRepository: EmployeeRepository,
    employeeDirectoryService?: EmployeeDirectoryService,
    votingGroupService?: VotingGroupService
  ) {
    this.azureEmployeeService = azureEmployeeService;
    this.employeeRepository = employeeRepository;
    this.employeeDirectoryService = employeeDirectoryService;
    this.votingGroupService = votingGroupService;
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
      // Load CSV employees only
      let finalEmployees: Employee[] = [];
      if (this.employeeDirectoryService) {
        finalEmployees = await this.employeeDirectoryService.loadCsvAsEmployees();
        console.log(`[EmployeeSyncService] Loaded ${finalEmployees.length} employees from CSV`);
        result.matchedExternalRecords = finalEmployees.length;
      } else {
        throw new Error('Employee directory service not configured - CSV sync not available');
      }

      // Step 4: Sync to database
      const existingEmployees = await this.employeeRepository.findSyncableEmployees();
      const existingEmployeeMap = new Map<string, Employee>();
      existingEmployees.forEach(emp => existingEmployeeMap.set(emp.id, emp));

      // Track which employees we've processed to avoid duplicates
      const processedIds = new Set<string>();

      // Track usernames to ensure uniqueness
      const existingUsernames = new Set<string>(
        existingEmployees.map(emp => emp.username).filter((username): username is string => !!username)
      );

      for (const employee of finalEmployees) {
        // Skip if we've already processed this employee ID
        if (processedIds.has(employee.id)) {
          console.log(`[EmployeeSyncService] Skipping duplicate employee ID: ${employee.id}`);
          continue;
        }

        processedIds.add(employee.id);
        result.totalProcessed++;

        try {
          // Assign voting group
          if (this.votingGroupService) {
            employee.votingGroup = this.votingGroupService.assignVotingGroup(employee);
          }

          const existingEmployee = existingEmployeeMap.get(employee.id);

          // Generate username and password if not exists
          if (!employee.username && employee.firstName && employee.lastName) {
            employee.username = await this.generateUniqueUsername(
              employee.firstName,
              employee.lastName,
              existingUsernames
            );
            existingUsernames.add(employee.username);
          }

          // Set default password for new employees only
          if (!existingEmployee && !employee.password) {
            employee.password = await PasswordHelper.hash(DEFAULT_INITIAL_PASSWORD);
            employee.firstLogin = true; // Flag for password change on first login
            console.log(
              `[EmployeeSyncService] Set default password for ${employee.username}`
            );
          }

          if (!existingEmployee) {
            await this.employeeRepository.create(employee);
            result.newUsers++;
          } else if (this.hasEmployeeChanged(existingEmployee, employee)) {
            const updatedEmployee = {
              ...employee,
              createdAt: existingEmployee.createdAt,
              updatedAt: new Date(),
              password: existingEmployee.password, // Preserve existing password
            };
            await this.employeeRepository.update(employee.id, updatedEmployee);
            result.updatedUsers++;
          }
        } catch (error) {
          const errorMessage = `Error processing employee ${employee.id}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
        }
      }

      await this.deactivateRemovedEmployees(finalEmployees, existingEmployees);
    } catch (error) {
      const errorMessage = `Error during sync: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMessage);
    }

    return result;
  }

  private async generateUniqueUsername(
    firstName: string,
    lastName: string,
    existingUsernames: Set<string>
  ): Promise<string> {
    // Normalize names: lowercase and remove special characters
    const normalizedFirstName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // For compound last names (e.g., "Tapia Salvador"), use only the first part
    const lastNameFirstPart = lastName.split(/\s+/)[0];
    const normalizedLastName = lastNameFirstPart.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Base username: firstname.lastname (first part of compound last name)
    let username = `${normalizedFirstName}.${normalizedLastName}`;

    // If username already exists, append a number
    if (existingUsernames.has(username)) {
      let counter = 1;
      while (existingUsernames.has(`${username}${counter}`)) {
        counter++;
      }
      username = `${username}${counter}`;
    }

    return username;
  }

  private hasEmployeeChanged(existing: Employee, azure: Employee): boolean {
    return (
      existing.fullName !== azure.fullName ||
      existing.firstName !== azure.firstName ||
      existing.lastName !== azure.lastName ||
      existing.middleName !== azure.middleName ||
      existing.email !== azure.email ||
      existing.department !== azure.department ||
      existing.position !== azure.position ||
      existing.positionId !== azure.positionId ||
      existing.companyCode !== azure.companyCode ||
      existing.jobTitle !== azure.jobTitle ||
      existing.homeDepartment !== azure.homeDepartment ||
      existing.reportsTo !== azure.reportsTo ||
      existing.directReportsCount !== azure.directReportsCount ||
      existing.location !== azure.location ||
      existing.positionStatus !== azure.positionStatus ||
      existing.votingEligible !== azure.votingEligible ||
      this.hasDateChanged(existing.hireDate, azure.hireDate) ||
      this.hasDateChanged(existing.rehireDate, azure.rehireDate) ||
      existing.isActive !== azure.isActive
    );
  }

  private hasDateChanged(date1?: Date, date2?: Date): boolean {
    // Handle undefined/null cases
    if (!date1 && !date2) return false;
    if (!date1 || !date2) return true;

    // Compare dates by converting to ISO string
    return new Date(date1).toISOString() !== new Date(date2).toISOString();
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

  async updateVotingGroups(
    strategy: string,
    customMappings?: string
  ): Promise<{
    success: boolean;
    totalUpdated: number;
    errors: string[];
  }> {
    const result = {
      success: true,
      totalUpdated: 0,
      errors: [] as string[],
    };

    try {
      // Update VotingGroupService configuration
      if (!this.votingGroupService) {
        throw new Error('VotingGroupService not configured');
      }

      this.votingGroupService.updateConfiguration(strategy as any, customMappings);

      // Get all active employees
      const employees = await this.employeeRepository.findSyncableEmployees();
      console.log(`[EmployeeSyncService] Updating voting groups for ${employees.length} employees`);

      // Update each employee's voting group
      for (const employee of employees) {
        try {
          const newVotingGroup = this.votingGroupService.assignVotingGroup(employee);

          // Only update if voting group changed
          if (employee.votingGroup !== newVotingGroup) {
            const updatedEmployee = {
              ...employee,
              votingGroup: newVotingGroup,
              updatedAt: new Date(),
            };

            await this.employeeRepository.update(employee.id, updatedEmployee);
            result.totalUpdated++;
          }
        } catch (error) {
          const errorMessage = `Error updating employee ${employee.id}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
        }
      }

      console.log(
        `[EmployeeSyncService] Voting groups updated: ${result.totalUpdated} employees modified`
      );
    } catch (error) {
      result.success = false;
      const errorMessage = `Error during voting group update: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMessage);
    }

    return result;
  }

  private async enrichWithExternalDirectory(
    employees: Employee[]
  ): Promise<EmployeeDirectoryMatchResult> {
    if (!this.employeeDirectoryService) {
      console.log(
        '[EmployeeSyncService] No employee directory service configured - CSV merge disabled'
      );
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
      console.log(
        `[EmployeeSyncService] Attempting to enrich ${employees.length} employees with CSV data`
      );
      const result = await this.employeeDirectoryService.matchEmployees(employees);
      console.log(
        `[EmployeeSyncService] CSV merge result: ${result.matches} matches, ${result.unmatchedAzureEmployees.length} unmatched Azure employees, ${result.unmatchedExternalRecords.length} unmatched CSV records`
      );
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
