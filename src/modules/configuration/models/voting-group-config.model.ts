export type VotingGroupStrategy = 'location' | 'department' | 'custom';

export interface DepartmentGroupMapping {
  groupName: string; // Nombre del voting group
  departments: string[]; // Departamentos que pertenecen a este grupo
}

export interface VotingGroupConfig {
  id: string; // Use 'voting-group' as single document ID
  strategy: VotingGroupStrategy;

  // For grouping multiple small departments into specific voting groups
  departmentGroupMappings?: DepartmentGroupMapping[];

  // Legacy custom mappings (for backward compatibility)
  customMappings?: Record<string, string>;

  // Fallback strategy if no mapping is found
  fallbackStrategy?: 'location' | 'department' | 'none';

  createdAt?: Date;
  updatedAt?: Date;
}

export const DEFAULT_VOTING_GROUP_CONFIG: VotingGroupConfig = {
  id: 'voting-group',
  strategy: 'location',
  departmentGroupMappings: [],
  customMappings: {},
  fallbackStrategy: 'location',
};

/**
 * Example configuration:
 * {
 *   strategy: 'custom',
 *   departmentGroupMappings: [
 *     {
 *       groupName: 'Administrative',
 *       departments: ['HR', 'Finance', 'Legal', 'Admin']
 *     },
 *     {
 *       groupName: 'Technical',
 *       departments: ['IT', 'Development', 'QA', 'DevOps']
 *     },
 *     {
 *       groupName: 'Operations',
 *       departments: ['Sales', 'Marketing', 'Customer Support', 'Logistics']
 *     }
 *   ],
 *   fallbackStrategy: 'location'
 * }
 */
