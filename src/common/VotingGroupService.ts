import { Employee } from '../modules/employee/models/employee.model';

export type VotingGroupStrategy = 'location' | 'department' | 'custom';

interface VotingGroupConfig {
  strategy: VotingGroupStrategy;
  customMappings?: Record<string, string>; // For custom mapping: { "location1,location2": "Group A" }
}

export class VotingGroupService {
  private strategy: VotingGroupStrategy;
  private customMappings: Map<string, string> = new Map();

  constructor(strategy: VotingGroupStrategy = 'location', customMappingsJson?: string) {
    this.strategy = strategy;

    if (customMappingsJson && strategy === 'custom') {
      try {
        const mappings = JSON.parse(customMappingsJson);
        Object.entries(mappings).forEach(([keys, group]) => {
          // Support comma-separated keys mapping to same group
          const keyList = keys.split(',').map(k => k.trim().toLowerCase());
          keyList.forEach(key => {
            this.customMappings.set(key, group as string);
          });
        });
        console.log(`[VotingGroupService] Loaded ${this.customMappings.size} custom voting group mappings`);
      } catch (error) {
        console.error('[VotingGroupService] Failed to parse custom mappings:', error);
      }
    }

    console.log(`[VotingGroupService] Initialized with strategy: ${this.strategy}`);
  }

  assignVotingGroup(employee: Employee): string | undefined {
    switch (this.strategy) {
      case 'location':
        return this.normalizeValue(employee.location);

      case 'department':
        return this.normalizeValue(employee.department);

      case 'custom':
        return this.getCustomGroup(employee);

      default:
        return undefined;
    }
  }

  private getCustomGroup(employee: Employee): string | undefined {
    // Try location first
    const locationKey = this.normalizeValue(employee.location)?.toLowerCase();
    if (locationKey && this.customMappings.has(locationKey)) {
      return this.customMappings.get(locationKey);
    }

    // Try department
    const deptKey = this.normalizeValue(employee.department)?.toLowerCase();
    if (deptKey && this.customMappings.has(deptKey)) {
      return this.customMappings.get(deptKey);
    }

    // Default to location if no custom mapping found
    return this.normalizeValue(employee.location);
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
    return this.strategy;
  }

  updateConfiguration(strategy: VotingGroupStrategy, customMappingsJson?: string): void {
    this.strategy = strategy;
    this.customMappings.clear();

    if (customMappingsJson && strategy === 'custom') {
      try {
        const mappings = JSON.parse(customMappingsJson);
        Object.entries(mappings).forEach(([keys, group]) => {
          // Support comma-separated keys mapping to same group
          const keyList = keys.split(',').map(k => k.trim().toLowerCase());
          keyList.forEach(key => {
            this.customMappings.set(key, group as string);
          });
        });
        console.log(`[VotingGroupService] Updated with ${this.customMappings.size} custom voting group mappings`);
      } catch (error) {
        console.error('[VotingGroupService] Failed to parse custom mappings:', error);
        throw new Error('Invalid JSON format for custom mappings');
      }
    }

    console.log(`[VotingGroupService] Configuration updated to strategy: ${this.strategy}`);
  }
}