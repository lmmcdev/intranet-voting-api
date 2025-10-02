import { Employee } from '../modules/employee/models/employee.model';
import {
  VotingGroupConfig,
  VotingGroupStrategy,
} from '../modules/configuration/models/voting-group-config.model';

export class VotingGroupService {
  private config: VotingGroupConfig;
  private departmentGroupMap: Map<string, string> = new Map(); // department -> group name

  constructor(config: VotingGroupConfig) {
    this.config = config;
    this.buildDepartmentGroupMap();
    console.log(`[VotingGroupService] Initialized with strategy: ${this.config.strategy}`);
  }

  /**
   * Build a map from department names to their assigned voting group
   */
  private buildDepartmentGroupMap(): void {
    this.departmentGroupMap.clear();

    if (this.config.departmentGroupMappings) {
      for (const mapping of this.config.departmentGroupMappings) {
        for (const dept of mapping.departments) {
          const normalizedDept = dept.trim().toLowerCase();
          this.departmentGroupMap.set(normalizedDept, mapping.groupName);
        }
      }
      console.log(
        `[VotingGroupService] Loaded ${this.departmentGroupMap.size} department-to-group mappings`
      );
    }
  }

  assignVotingGroup(employee: Employee): string | undefined {
    switch (this.config.strategy) {
      case 'location':
        return this.normalizeValue(employee.location);

      case 'department':
        // Check if department has a group mapping
        const normalizedDept = employee.department?.trim().toLowerCase();
        if (normalizedDept && this.departmentGroupMap.has(normalizedDept)) {
          return this.departmentGroupMap.get(normalizedDept);
        }
        // Otherwise return the department itself
        return this.normalizeValue(employee.department);

      case 'custom':
        return this.getCustomGroup(employee);

      default:
        return undefined;
    }
  }

  private getCustomGroup(employee: Employee): string | undefined {
    // First check department group mappings
    const normalizedDept = employee.department?.trim().toLowerCase();
    if (normalizedDept && this.departmentGroupMap.has(normalizedDept)) {
      return this.departmentGroupMap.get(normalizedDept);
    }

    // Then try legacy custom mappings if they exist
    if (this.config.customMappings) {
      const locationKey = this.normalizeValue(employee.location)?.toLowerCase();
      if (locationKey && this.config.customMappings[locationKey]) {
        return this.config.customMappings[locationKey];
      }

      const deptKey = this.normalizeValue(employee.department)?.toLowerCase();
      if (deptKey && this.config.customMappings[deptKey]) {
        return this.config.customMappings[deptKey];
      }
    }

    // Fallback strategy
    if (this.config.fallbackStrategy === 'location') {
      return this.normalizeValue(employee.location);
    } else if (this.config.fallbackStrategy === 'department') {
      return this.normalizeValue(employee.department);
    }

    return undefined;
  }

  private normalizeValue(value?: string): string | undefined {
    if (!value) return undefined;

    const normalized = value.trim();

    // Skip "Unknown" values
    if (normalized === 'Unknown' || normalized === '') {
      return undefined;
    }

    return normalized;
  }

  getStrategy(): VotingGroupStrategy {
    return this.config.strategy;
  }

  getConfig(): VotingGroupConfig {
    return this.config;
  }

  updateConfiguration(config: VotingGroupConfig): void {
    this.config = config;
    this.buildDepartmentGroupMap();
    console.log(`[VotingGroupService] Configuration updated to strategy: ${this.config.strategy}`);
  }
}
