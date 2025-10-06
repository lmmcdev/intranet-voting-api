export interface EligibilityConfig {
  id: string; // Use 'eligibility' as single document ID
  minimumDaysForEligibility: number; // Days required to be eligible (default: 365)
  excludedJobTitles: string[]; // Job titles that are excluded from voting
  excludedDepartments: string[]; // Departments excluded from voting
  excludedPositions: string[]; // Positions excluded from voting
  excludedPositionKeywords: string[]; // Keywords in position field that exclude from voting (partial match)
  requireActiveStatus: boolean; // Only active employees are eligible (default: true)
  customRules?: {
    // Optional custom rules
    allowedCompanyCodes?: string[]; // If set, only these company codes are eligible
    excludedCompanyCodes?: string[]; // Company codes to exclude
    minDirectReportsForExclusion?: number; // Managers with X or more reports are excluded
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export const DEFAULT_ELIGIBILITY_CONFIG: EligibilityConfig = {
  id: 'eligibility',
  minimumDaysForEligibility: 365, // 1 year
  excludedJobTitles: [],
  excludedDepartments: [],
  excludedPositions: [],
  excludedPositionKeywords: [],
  requireActiveStatus: true,
  customRules: {},
};
