import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { EmployeeService } from './employee.service';
import { ResponseHelper } from '../../common/utils/ResponseHelper';
import { getDependencies } from '../../common/utils/Dependencies';
import { AuthHelper } from '../../common/utils/AuthHelper';

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
      } = {};

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
      return ResponseHelper.ok({
        employees,
        total: employees.length
      });
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
        deletedCount
      });
    } catch (error) {
      context.error('Error deleting all employees:', error);
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
  return controller.getEmployeeById(request, context);
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

app.http('get-employees', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees',
  handler: getEmployeesFunction,
});

app.http('get-employee-by-id', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees/{id}',
  handler: getEmployeeByIdFunction,
});

app.http('autocomplete-employees', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees/autocomplete',
  handler: autocompleteEmployeesFunction,
});

app.http('delete-all-employees', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees/delete-all',
  handler: deleteAllEmployeesFunction,
});
