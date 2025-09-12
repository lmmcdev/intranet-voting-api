export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmployeeDto {
  name: string;
  email: string;
  department: string;
  position: string;
}

export interface UpdateEmployeeDto {
  name?: string;
  email?: string;
  department?: string;
  position?: string;
  isActive?: boolean;
}