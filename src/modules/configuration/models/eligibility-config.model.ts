export interface EligibilityConfig {
  id: string; // Use 'eligibility' as single document ID
  minimumDaysForEligibility: number; // Days required to be eligible (default: 365)
  excludedJobTitles: string[]; // Job titles that are excluded from voting
  excludedDepartments: string[]; // Departments excluded from voting
  excludedPositions: string[]; // Positions excluded from voting
  excludedPositionKeywords: string[]; // Keywords in position field that exclude from voting (partial match)
  requireActiveStatus: boolean; // Only active employees are eligible (default: true)
  winnersFormula?: {
    // Formula to calculate number of winners: topWinners = Math.round(totalVotes / divisor)
    divisor: number; // Divide total votes by this number (e.g., 25 means 1 winner per 25 votes)
    minWinners: number; // Minimum number of winners (e.g., 1)
  };
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
  winnersFormula: {
    divisor: 25, // 1 winner per 25 votes
    minWinners: 1, // At least 1 winner
  },
  customRules: {},
};
