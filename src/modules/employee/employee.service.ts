import { Employee } from './models/employee.model';

export class EmployeeService {
  private dependencies: any;

  constructor(dependencies: any) {
    this.dependencies = dependencies;
  }

  async getEmployees(): Promise<Employee[]> {
    return this.dependencies.azureEmployeeService.getAllActiveEmployees();
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    return this.dependencies.azureEmployeeService.getEmployeeById(id);
  }

  async autocompleteEmployees(query: string): Promise<Employee[]> {
    return this.dependencies.azureEmployeeService.searchEmployees(query, 10);
  }
}