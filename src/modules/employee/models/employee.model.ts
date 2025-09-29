export interface Employee {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  email: string;
  department: string;
  position: string;
  positionId?: string;
  companyCode?: string;
  jobTitle?: string;
  homeDepartment?: string;
  reportsTo?: string;
  directReportsCount?: number;
  location?: string;
  positionStatus?: string;
  hireDate?: Date;
  rehireDate?: Date;
  isActive: boolean;
  excludeFromSync?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
