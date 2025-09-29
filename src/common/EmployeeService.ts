import { Employee } from '../modules/employee/models/employee.model';
import { CreateEmployeeDto } from '../modules/employee/dto/create-employee.dto';
import { UpdateEmployeeDto } from '../modules/employee/dto/update-employee.dto';
import { EmployeeRepository } from '../modules/employee/repositories/EmployeeRepository';

export class EmployeeService {
  private employeeRepository: EmployeeRepository;

  constructor(employeeRepository: EmployeeRepository) {
    this.employeeRepository = employeeRepository;
  }

  async createEmployee(employeeData: CreateEmployeeDto): Promise<Employee> {
    const existingEmployee = await this.employeeRepository.findByEmail(employeeData.email);
    if (existingEmployee) {
      throw new Error('Employee with this email already exists');
    }

    const employee: Employee = {
      id: this.generateId(),
      ...employeeData,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.employeeRepository.create(employee);
  }

  async getAllActiveEmployees(): Promise<Employee[]> {
    return await this.employeeRepository.findActiveEmployees();
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    return await this.employeeRepository.findById(id);
  }

  async updateEmployee(id: string, updateData: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const updatedEmployee: Employee = {
      ...employee,
      ...updateData,
      updatedAt: new Date(),
    };

    return await this.employeeRepository.update(id, updatedEmployee);
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}
