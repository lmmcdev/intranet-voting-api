import { Employee } from './models/employee.model';
import { EmployeeRepository } from './repositories/EmployeeRepository';
import { EligibilityHelper } from '../../common/utils/EligibilityHelper';
import { ConfigurationService } from '../configuration/configuration.service';
import { VotingGroupService } from '../../common/VotingGroupService';
import {
  BulkUpdateEmployeeDto,
  BulkUpdateEmployeesResponseDto,
  BulkUpdateByFilterDto,
} from './dto/bulk-update-employee.dto';
import { NameHelper } from '../../common/utils/NameHelper';
import { AuditService } from '../../common/services/AuditService';
import { AuditEntity, AuditAction } from '../../common/models/AuditLog';

export class EmployeeService {
  private auditService?: AuditService;

  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly configurationService?: ConfigurationService,
    private readonly votingGroupService?: VotingGroupService,
    auditService?: AuditService
  ) {
    this.auditService = auditService;
  }

  async getEmployees(
    filters?: {
      isActive?: boolean;
      department?: string;
      position?: string;
      location?: string;
      votingGroup?: string;
    },
    pagination?: {
      pageSize?: number;
      continuationToken?: string;
    }
  ): Promise<{
    employees: Employee[];
    continuationToken?: string;
    hasMore: boolean;
  }> {
    return this.employeeRepository.findAll(filters, pagination);
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    return this.employeeRepository.findById(id);
  }

  async getEmployeeCount(): Promise<number> {
    return this.employeeRepository.countAll();
  }

  async autocompleteEmployees(query: string): Promise<{ employees: Employee[]; total: number }> {
    // Get all employees and filter client-side for autocomplete
    const allEmployees = await this.employeeRepository.findActiveEmployees();
    const lowerQuery = query.toLowerCase();

    const filteredEmployees = allEmployees
      .filter(
        emp =>
          emp.fullName?.toLowerCase().includes(lowerQuery) ||
          emp.email?.toLowerCase().includes(lowerQuery) ||
          emp.department?.toLowerCase().includes(lowerQuery) ||
          emp.position?.toLowerCase().includes(lowerQuery) ||
          emp.location?.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => {
        const aFullName = a.fullName?.toLowerCase() || '';
        const bFullName = b.fullName?.toLowerCase() || '';

        // Prioritize fullName matches that start with the query
        const aStartsWithQuery = aFullName.startsWith(lowerQuery);
        const bStartsWithQuery = bFullName.startsWith(lowerQuery);

        if (aStartsWithQuery && !bStartsWithQuery) return -1;
        if (!aStartsWithQuery && bStartsWithQuery) return 1;

        // Then prioritize fullName matches that contain the query
        const aFullNameMatch = aFullName.includes(lowerQuery);
        const bFullNameMatch = bFullName.includes(lowerQuery);

        if (aFullNameMatch && !bFullNameMatch) return -1;
        if (!aFullNameMatch && bFullNameMatch) return 1;

        // If both or neither match fullName, sort alphabetically
        return aFullName.localeCompare(bFullName);
      });

    const employees = filteredEmployees.slice(0, 10);

    return {
      employees,
      total: filteredEmployees.length,
    };
  }

  async deleteAllEmployees(): Promise<number> {
    return this.employeeRepository.deleteAll();
  }

  async excludeFromSync(id: string): Promise<Employee | null> {
    return this.employeeRepository.updateSyncStatus(id, true);
  }

  async includeInSync(id: string): Promise<Employee | null> {
    return this.employeeRepository.updateSyncStatus(id, false);
  }

  async getSyncableEmployees(): Promise<Employee[]> {
    return this.employeeRepository.findSyncableEmployees();
  }

  async getVotingGroups(): Promise<string[]> {
    return this.employeeRepository.getDistinctVotingGroups();
  }

  async getLocations(): Promise<string[]> {
    return this.employeeRepository.getDistinctLocations();
  }

  async getDepartments(): Promise<string[]> {
    return this.employeeRepository.getDistinctDepartments();
  }

  async getPositions(): Promise<string[]> {
    return this.employeeRepository.getDistinctPositions();
  }

  async updateEmployee(
    id: string,
    updates: Partial<Employee>,
    userContext?: { userId: string; userName: string; userEmail?: string }
  ): Promise<Employee | null> {
    // Get current employee for audit comparison
    const currentEmployee = await this.employeeRepository.findById(id);

    // Normalize name fields if they're being updated
    const normalizedUpdates = NameHelper.normalizeNameFields(updates);
    const updatedEmployee = await this.employeeRepository.partialUpdate(id, normalizedUpdates);

    // Invalidate cache for this employee
    // Log audit
    if (this.auditService && userContext && currentEmployee && updatedEmployee) {
      try {
        const changes = this.auditService.detectChanges(currentEmployee, updatedEmployee);
        if (changes.length > 0) {
          await this.auditService.log({
            entityType: AuditEntity.EMPLOYEE,
            entityId: id,
            action: AuditAction.UPDATE,
            userId: userContext.userId,
            userName: userContext.userName,
            userEmail: userContext.userEmail,
            changes,
            metadata: {
              employeeName: updatedEmployee.fullName,
              department: updatedEmployee.department,
            },
          });
        }
      } catch (error) {
        console.error('Failed to log audit:', error);
      }
    }

    return updatedEmployee;
  }

  async getEmployeeByEmail(email: string): Promise<Employee | null> {
    return this.employeeRepository.findByEmail(email);
  }

  async getEligibleEmployees(filters?: {
    department?: string;
    position?: string;
    location?: string;
    votingGroup?: string;
  }): Promise<Employee[]> {
    if (!this.configurationService) {
      throw new Error('ConfigurationService is required for eligibility filtering');
    }

    // Get all active employees with optional filters
    const { employees: allEmployees } = await this.employeeRepository.findAll({
      ...filters,
      isActive: true,
    });

    // Get eligibility configuration
    const eligibilityConfig = await this.configurationService.getEligibilityConfig();

    // Filter employees using EligibilityHelper
    return allEmployees.filter(employee =>
      EligibilityHelper.isVotingEligible(employee, eligibilityConfig)
    );
  }

  async bulkUpdateEmployees(
    employees: BulkUpdateEmployeeDto[]
  ): Promise<BulkUpdateEmployeesResponseDto> {
    const response: BulkUpdateEmployeesResponseDto = {
      successful: 0,
      failed: 0,
      errors: [],
      updatedEmployees: [],
    };

    for (const item of employees) {
      try {
        // Validate that the employee exists
        const existingEmployee = await this.employeeRepository.findById(item.id);
        if (!existingEmployee) {
          response.failed++;
          response.errors.push({
            id: item.id,
            error: 'Employee not found',
          });
          continue;
        }

        // Prevent updating certain fields (password should only be updated via auth endpoints)
        const restrictedFields = ['id', 'createdAt', 'password'];
        const updates = { ...item.updates };
        for (const field of restrictedFields) {
          if (field in updates) {
            delete (updates as any)[field];
          }
        }

        // Normalize name fields if they're being updated
        const normalizedUpdates = NameHelper.normalizeNameFields(updates);

        // Add updatedAt timestamp
        (normalizedUpdates as any).updatedAt = new Date();

        // Update the employee
        const updatedEmployee = await this.employeeRepository.partialUpdate(
          item.id,
          normalizedUpdates
        );

        if (updatedEmployee) {
          response.successful++;
          response.updatedEmployees.push(updatedEmployee);
        } else {
          response.failed++;
          response.errors.push({
            id: item.id,
            error: 'Failed to update employee',
          });
        }
      } catch (error) {
        response.failed++;
        response.errors.push({
          id: item.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return response;
  }

  async bulkUpdateByFilter(
    filterDto: BulkUpdateByFilterDto
  ): Promise<BulkUpdateEmployeesResponseDto> {
    const response: BulkUpdateEmployeesResponseDto = {
      successful: 0,
      failed: 0,
      errors: [],
      updatedEmployees: [],
    };

    // Get employees matching the filters
    const { employees } = await this.employeeRepository.findAll(filterDto.filters);

    if (employees.length === 0) {
      return response;
    }

    // Prevent updating certain fields (password should only be updated via auth endpoints)
    const restrictedFields = ['id', 'createdAt', 'password'];
    const updates = { ...filterDto.updates };
    for (const field of restrictedFields) {
      if (field in updates) {
        delete (updates as any)[field];
      }
    }

    // Normalize name fields if they're being updated
    const normalizedUpdates = NameHelper.normalizeNameFields(updates);

    // Add updatedAt timestamp
    (normalizedUpdates as any).updatedAt = new Date();

    // Update each employee
    for (const employee of employees) {
      try {
        const updatedEmployee = await this.employeeRepository.partialUpdate(
          employee.id,
          normalizedUpdates
        );

        if (updatedEmployee) {
          response.successful++;
          response.updatedEmployees.push(updatedEmployee);
        } else {
          response.failed++;
          response.errors.push({
            id: employee.id,
            error: 'Failed to update employee',
          });
        }
      } catch (error) {
        response.failed++;
        response.errors.push({
          id: employee.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return response;
  }
}
