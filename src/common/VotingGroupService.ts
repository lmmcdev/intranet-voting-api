import { Employee } from '../modules/employee/models/employee.model';
import {
  VotingGroupConfig,
  VotingGroupStrategy,
} from '../modules/configuration/models/voting-group-config.model';

export class VotingGroupService {
  private config: VotingGroupConfig;
  private departmentGroupMap: Map<string, string> = new Map(); // department -> group name
  private locationGroupMap: Map<string, string> = new Map(); // location -> group name
  private mixedDepartmentGroupMap: Map<string, string> = new Map(); // department -> group name (for mixed)
  private mixedLocationGroupMap: Map<string, string> = new Map(); // location -> group name (for mixed)

  constructor(config: VotingGroupConfig) {
    this.config = config;
    this.buildDepartmentGroupMap();
    this.buildLocationGroupMap();
    this.buildMixedGroupMaps();
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

  /**
   * Build a map from location names to their assigned voting group
   */
  private buildLocationGroupMap(): void {
    this.locationGroupMap.clear();

    if (this.config.locationGroupMappings) {
      for (const mapping of this.config.locationGroupMappings) {
        for (const loc of mapping.locations) {
          const normalizedLoc = loc.trim().toLowerCase();
          this.locationGroupMap.set(normalizedLoc, mapping.groupName);
        }
      }
      console.log(
        `[VotingGroupService] Loaded ${this.locationGroupMap.size} location-to-group mappings`
      );
    }
  }

  /**
   * Build maps for mixed groups (departments and locations together)
   */
  private buildMixedGroupMaps(): void {
    this.mixedDepartmentGroupMap.clear();
    this.mixedLocationGroupMap.clear();

    if (this.config.mixedGroupMappings) {
      for (const mapping of this.config.mixedGroupMappings) {
        // Map departments to group name
        if (mapping.departments) {
          for (const dept of mapping.departments) {
            const normalizedDept = dept.trim().toLowerCase();
            this.mixedDepartmentGroupMap.set(normalizedDept, mapping.groupName);
          }
        }

        // Map locations to group name
        if (mapping.locations) {
          for (const loc of mapping.locations) {
            const normalizedLoc = loc.trim().toLowerCase();
            this.mixedLocationGroupMap.set(normalizedLoc, mapping.groupName);
          }
        }
      }
      console.log(
        `[VotingGroupService] Loaded ${this.mixedDepartmentGroupMap.size} mixed department mappings and ${this.mixedLocationGroupMap.size} mixed location mappings`
      );
    }
  }

  assignVotingGroup(employee: Employee): string | undefined {
    switch (this.config.strategy) {
      case 'location':
        // Check if location has a group mapping
        const normalizedLoc = employee.location?.trim().toLowerCase();
        if (normalizedLoc && this.locationGroupMap.has(normalizedLoc)) {
          return this.locationGroupMap.get(normalizedLoc);
        }
        // Otherwise return the location itself
        return this.normalizeValue(employee.location);

      case 'department':
        // Check if department has a group mapping
        const normalizedDept = employee.department?.trim().toLowerCase();
        if (normalizedDept && this.departmentGroupMap.has(normalizedDept)) {
          return this.departmentGroupMap.get(normalizedDept);
        }
        // Otherwise return the department itself
        return this.normalizeValue(employee.department);

      case 'mixed':
        return this.getMixedGroup(employee);

      case 'custom':
        return this.getCustomGroup(employee);

      default:
        return undefined;
    }
  }

  private getMixedGroup(employee: Employee): string | undefined {
    // First check if employee's location matches a mixed group
    const normalizedLoc = employee.location?.trim().toLowerCase();
    if (normalizedLoc && this.mixedLocationGroupMap.has(normalizedLoc)) {
      return this.mixedLocationGroupMap.get(normalizedLoc);
    }

    // Then check if employee's department matches a mixed group
    const normalizedDept = employee.department?.trim().toLowerCase();
    if (normalizedDept && this.mixedDepartmentGroupMap.has(normalizedDept)) {
      return this.mixedDepartmentGroupMap.get(normalizedDept);
    }

    // Fallback strategy
    if (this.config.fallbackStrategy === 'location') {
      return this.normalizeValue(employee.location);
    } else if (this.config.fallbackStrategy === 'department') {
      return this.normalizeValue(employee.department);
    }

    return undefined;
  }

  private getCustomGroup(employee: Employee): string | undefined {
    const normalizedLoc = employee.location?.trim().toLowerCase();
    const normalizedDept = employee.department?.trim().toLowerCase();

    // First check mixed group mappings (location OR department match)
    if (normalizedLoc && this.mixedLocationGroupMap.has(normalizedLoc)) {
      return this.mixedLocationGroupMap.get(normalizedLoc);
    }
    if (normalizedDept && this.mixedDepartmentGroupMap.has(normalizedDept)) {
      return this.mixedDepartmentGroupMap.get(normalizedDept);
    }

    // Then check location group mappings
    if (normalizedLoc && this.locationGroupMap.has(normalizedLoc)) {
      return this.locationGroupMap.get(normalizedLoc);
    }

    // Then check department group mappings
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
    this.buildLocationGroupMap();
    this.buildMixedGroupMaps();
    console.log(`[VotingGroupService] Configuration updated to strategy: ${this.config.strategy}`);
  }
}
