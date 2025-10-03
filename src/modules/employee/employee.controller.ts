import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { EmployeeService } from './employee.service';
import { Employee } from './models/employee.model';
import { ResponseHelper } from '../../common/utils/ResponseHelper';
import { getDependencies } from '../../common/utils/Dependencies';
import { AuthHelper } from '../../common/utils/AuthHelper';
import * as fs from 'fs';
import * as path from 'path';
import { RequireRoles, RequireOwnership } from '../auth/decorators/auth.decorators';
import { UserRole, Permission } from '../../common/constants/roles.constants';

export class EmployeeController {
  private employeeService: EmployeeService;

  constructor(employeeService: EmployeeService) {
    this.employeeService = employeeService;
  }

  async getEmployees(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      // Read query parameters
      const filters: {
        isActive?: boolean;
        department?: string;
        position?: string;
        location?: string;
        votingGroup?: string;
      } = {};

      const employee = await this.employeeService.getEmployeeById(authResult.user.userId);
      if (!employee) {
        return ResponseHelper.unauthorized('Employee record not found');
      }

      // Only allow filtering by votingGroup if the user belongs to one
      if (!employee.roles || !employee.roles.includes('admin')) {
        filters.votingGroup = employee.votingGroup;
      } else {
        const votingGroupParam = request.query.get('votingGroup');
        if (votingGroupParam) {
          filters.votingGroup = votingGroupParam;
        }
      }

      const isActiveParam = request.query.get('isActive');
      if (isActiveParam !== null) {
        filters.isActive = isActiveParam.toLowerCase() === 'true';
      }

      const department = request.query.get('department');
      if (department) {
        filters.department = department;
      }

      const position = request.query.get('position');
      if (position) {
        filters.position = position;
      }

      const location = request.query.get('location');
      if (location) {
        filters.location = location;
      }

      const employees = await this.employeeService.getEmployees(filters);
      return ResponseHelper.ok(employees);
    } catch (error) {
      context.error('Error getting employees:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async getEmployeeById(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const id = request.params.id;
      if (!id) {
        return ResponseHelper.badRequest('Employee ID is required');
      }

      const employee = await this.employeeService.getEmployeeById(id);
      if (!employee) {
        return ResponseHelper.notFound('Employee not found');
      }

      return ResponseHelper.ok(employee);
    } catch (error) {
      context.error('Error getting employee by id:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async autocompleteEmployees(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const query = request.query.get('q') || '';
      if (!query || query.length < 2) {
        return ResponseHelper.badRequest('Query must be at least 2 characters');
      }

      const employees = await this.employeeService.autocompleteEmployees(query);
      return ResponseHelper.ok(employees);
    } catch (error) {
      context.error('Error autocompleting employees:', error);
      return ResponseHelper.internalServerError();
    }
  }

  @RequireRoles([UserRole.ADMIN, UserRole.SUPER_ADMIN])
  async deleteAllEmployees(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'DELETE') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const deletedCount = await this.employeeService.deleteAllEmployees();
      return ResponseHelper.ok({
        message: `Successfully deleted ${deletedCount} employees`,
        deletedCount,
      });
    } catch (error) {
      context.error('Error deleting all employees:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async getVotingGroups(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const votingGroups = await this.employeeService.getVotingGroups();
      return ResponseHelper.ok(votingGroups);
    } catch (error) {
      context.error('Error getting voting groups:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async updateEmployee(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'PATCH') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const id = request.params.id;
      if (!id) {
        return ResponseHelper.badRequest('Employee ID is required');
      }

      const body = (await request.json()) as Partial<Employee>;

      // Prevent updating certain fields
      const restrictedFields = ['id', 'createdAt'];
      for (const field of restrictedFields) {
        if (field in body) {
          delete (body as any)[field];
        }
      }

      const updatedEmployee = await this.employeeService.updateEmployee(id, body);

      if (!updatedEmployee) {
        return ResponseHelper.notFound('Employee not found');
      }

      return ResponseHelper.ok(updatedEmployee);
    } catch (error) {
      context.error('Error updating employee:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError();
    }
  }

  async getEligibleEmployees(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      // Read query parameters
      const filters: {
        department?: string;
        position?: string;
        location?: string;
        votingGroup?: string;
      } = {};

      context.log('Eligible employees - Looking for employee with ID:', authResult.user.userId);
      const employee = await this.employeeService.getEmployeeById(authResult.user.userId);
      context.log('Eligible employees - Found employee:', employee?.id, 'votingGroup:', employee?.votingGroup);
      if (!employee) {
        return ResponseHelper.unauthorized('Employee record not found');
      }

      // Always filter by voting group - users can only see employees in their own voting group
      // Admins can optionally filter by a different voting group via query parameter
      if (!employee.roles || !employee.roles.includes('admin')) {
        filters.votingGroup = employee.votingGroup;
      } else {
        const votingGroupParam = request.query.get('votingGroup');
        if (votingGroupParam) {
          filters.votingGroup = votingGroupParam;
        } else {
          // Even admins default to their own voting group if not specified
          filters.votingGroup = employee.votingGroup;
        }
      }

      const department = request.query.get('department');
      if (department) {
        filters.department = department;
      }

      const position = request.query.get('position');
      if (position) {
        filters.position = position;
      }

      const location = request.query.get('location');
      if (location) {
        filters.location = location;
      }

      context.log('Filtering eligible employees with votingGroup:', filters.votingGroup);
      const employees = await this.employeeService.getEligibleEmployees(filters);

      // Exclude the current user from the list (can't nominate yourself)
      const filteredEmployees = employees.filter(emp => emp.id !== authResult.user.userId);

      return ResponseHelper.ok(filteredEmployees);
    } catch (error) {
      context.error('Error getting eligible employees:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError();
    }
  }

  async exportEmployeesToCSV(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      // Get filters from query params
      const filters: {
        isActive?: boolean;
        department?: string;
        position?: string;
        location?: string;
        votingGroup?: string;
      } = {};

      const isActiveParam = request.query.get('isActive');
      if (isActiveParam !== null) {
        filters.isActive = isActiveParam.toLowerCase() === 'true';
      }

      const department = request.query.get('department');
      if (department) filters.department = department;

      const position = request.query.get('position');
      if (position) filters.position = position;

      const location = request.query.get('location');
      if (location) filters.location = location;

      const votingGroup = request.query.get('votingGroup');
      if (votingGroup) filters.votingGroup = votingGroup;

      const employees = await this.employeeService.getEmployees(filters);

      // Build CSV content
      const headers = [
        'ID',
        'Full Name',
        'Email',
        'Department',
        'Position',
        'Location',
        'Voting Group',
        'Is Active',
        'Job Title',
        'Company Code',
        'Reports To',
        'Direct Reports Count',
        'Hire Date',
        'Source',
        'Role',
        'Exclude From Sync',
      ];

      const csvRows = [headers.join(',')];

      for (const emp of employees) {
        const row = [
          emp.id || '',
          `"${(emp.fullName || '').replace(/"/g, '""')}"`,
          emp.email || '',
          `"${(emp.department || '').replace(/"/g, '""')}"`,
          `"${(emp.position || '').replace(/"/g, '""')}"`,
          `"${(emp.location || '').replace(/"/g, '""')}"`,
          `"${(emp.votingGroup || '').replace(/"/g, '""')}"`,
          emp.isActive ? 'Yes' : 'No',
          `"${(emp.jobTitle || '').replace(/"/g, '""')}"`,
          emp.companyCode || '',
          emp.reportsTo || '',
          emp.directReportsCount !== undefined ? emp.directReportsCount.toString() : '',
          emp.hireDate ? new Date(emp.hireDate).toISOString().split('T')[0] : '',
          emp.source || '',
          emp.roles || '',
          emp.excludeFromSync ? 'Yes' : 'No',
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');

      // Write to analysis folder
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .split('T')
        .join('_')
        .slice(0, -5);
      const analysisDir = path.join(__dirname, '../../../analysis');

      // Ensure analysis directory exists
      if (!fs.existsSync(analysisDir)) {
        fs.mkdirSync(analysisDir, { recursive: true });
      }

      const filePath = path.join(analysisDir, `employees_${timestamp}.csv`);
      fs.writeFileSync(filePath, csvContent, 'utf-8');
      context.log(`CSV file written to: ${filePath}`);

      return ResponseHelper.ok({
        message: 'CSV file created successfully',
        filePath: `analysis/employees_${timestamp}.csv`,
        totalEmployees: employees.length,
      });
    } catch (error) {
      context.error('Error exporting employees to CSV:', error);
      return ResponseHelper.internalServerError();
    }
  }
}

// Azure Functions endpoints
const getEmployeesFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new EmployeeController(dependencies.employeeService);
  return controller.getEmployees(request, context);
};

const getEmployeeByIdFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new EmployeeController(dependencies.employeeService);

  if (request.method === 'GET') {
    return controller.getEmployeeById(request, context);
  } else if (request.method === 'PATCH') {
    return controller.updateEmployee(request, context);
  }

  return ResponseHelper.methodNotAllowed();
};

const autocompleteEmployeesFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new EmployeeController(dependencies.employeeService);
  return controller.autocompleteEmployees(request, context);
};

const deleteAllEmployeesFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new EmployeeController(dependencies.employeeService);
  return controller.deleteAllEmployees(request, context);
};

const getVotingGroupsFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new EmployeeController(dependencies.employeeService);
  return controller.getVotingGroups(request, context);
};

const exportEmployeesToCSVFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new EmployeeController(dependencies.employeeService);
  return controller.exportEmployeesToCSV(request, context);
};

const getEligibleEmployeesFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new EmployeeController(dependencies.employeeService);
  return controller.getEligibleEmployees(request, context);
};

app.http('get-employees', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees',
  handler: getEmployeesFunction,
});

app.http('autocomplete-employees', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees/autocomplete',
  handler: autocompleteEmployeesFunction,
});

app.http('get-eligible-employees', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'eligible-employees',
  handler: getEligibleEmployeesFunction,
});

app.http('export-employees-csv', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees/export/csv',
  handler: exportEmployeesToCSVFunction,
});

app.http('delete-all-employees', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees/delete-all',
  handler: deleteAllEmployeesFunction,
});

app.http('employee-by-id', {
  methods: ['GET', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees/{id}',
  handler: getEmployeeByIdFunction,
});

app.http('get-voting-groups', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting-groups',
  handler: getVotingGroupsFunction,
});
