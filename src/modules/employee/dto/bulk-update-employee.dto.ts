export interface BulkUpdateEmployeeDto {
  id: string;
  updates: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    email?: string;
    username?: string;
    department?: string;
    position?: string;
    positionId?: string;
    companyCode?: string;
    jobTitle?: string;
    homeDepartment?: string;
    reportsTo?: string;
    directReportsCount?: number;
    location?: string;
    positionStatus?: 'A' | 'I' | string;
    hireDate?: Date;
    rehireDate?: Date;
    isActive?: boolean;
    votingEligible?: boolean;
    excludeFromSync?: boolean;
    roles?: string[];
    votingGroup?: string;
  };
}

export interface BulkUpdateEmployeesRequestDto {
  employees: BulkUpdateEmployeeDto[];
}

export interface BulkUpdateByFilterDto {
  filters: {
    isActive?: boolean;
    department?: string;
    position?: string;
    location?: string;
    votingGroup?: string;
    excludeFromSync?: boolean;
  };
  updates: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    email?: string;
    username?: string;
    department?: string;
    position?: string;
    positionId?: string;
    companyCode?: string;
    jobTitle?: string;
    homeDepartment?: string;
    reportsTo?: string;
    directReportsCount?: number;
    location?: string;
    positionStatus?: 'A' | 'I' | string;
    hireDate?: Date;
    rehireDate?: Date;
    isActive?: boolean;
    votingEligible?: boolean;
    excludeFromSync?: boolean;
    roles?: string[];
    votingGroup?: string;
  };
}

export interface BulkUpdateEmployeesResponseDto {
  successful: number;
  failed: number;
  errors: {
    id: string;
    error: string;
  }[];
  updatedEmployees: any[];
}
