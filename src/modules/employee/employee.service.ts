import { Employee } from './models/employee.model';
import { EmployeeRepository } from './repositories/EmployeeRepository';
import { EligibilityHelper } from '../../common/utils/EligibilityHelper';
import { ConfigurationService } from '../configuration/configuration.service';
import { VotingGroupService } from '../../common/VotingGroupService';

export class EmployeeService {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly configurationService?: ConfigurationService,
    private readonly votingGroupService?: VotingGroupService
  ) {}

  async getEmployees(filters?: {
    isActive?: boolean;
    department?: string;
    position?: string;
    location?: string;
    votingGroup?: string;
  }): Promise<Employee[]> {
    return this.employeeRepository.findAll(filters);
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

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
    return this.employeeRepository.partialUpdate(id, updates);
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
    const allEmployees = await this.employeeRepository.findAll({
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
}
