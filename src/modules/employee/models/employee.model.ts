export interface Employee {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  email?: string;
  username?: string;
  password?: string;
  department: string;
  position: string;
  positionId?: string;
  companyCode?: string;
  jobTitle?: string;
  homeDepartment?: string;
  reportsTo?: string;
  directReportsCount?: number;
  location?: string;
  positionStatus?: 'A' | 'I' | string; // A - Active, I - Inactive
  hireDate?: Date;
  rehireDate?: Date;
  isActive: boolean;
  votingEligible?: boolean;
  excludeFromSync?: boolean;
  source?: 'adp';
  roles?: string[];
  votingGroup?: string;
  firstLogin?: boolean; // Flag to require password change on first login
  createdAt: Date;
  updatedAt: Date;
}
