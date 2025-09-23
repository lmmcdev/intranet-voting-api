import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { EmployeeService } from "./employee.service";
import { ResponseHelper } from "../../common/utils/ResponseHelper";
import { getDependencies } from "../../common/utils/Dependencies";
import { AuthHelper } from "../../common/utils/AuthHelper";

export class EmployeeController {
  private employeeService: EmployeeService;

  constructor(employeeService: EmployeeService) {
    this.employeeService = employeeService;
  }

  async getEmployees(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== "GET") {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const employees = await this.employeeService.getEmployees();
      return ResponseHelper.ok(employees);
    } catch (error) {
      context.error("Error getting employees:", error);
      return ResponseHelper.internalServerError();
    }
  }

  async getEmployeeById(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== "GET") {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const id = request.params.id;
      if (!id) {
        return ResponseHelper.badRequest("Employee ID is required");
      }

      const employee = await this.employeeService.getEmployeeById(id);
      if (!employee) {
        return ResponseHelper.notFound("Employee not found");
      }

      return ResponseHelper.ok(employee);
    } catch (error) {
      context.error("Error getting employee by id:", error);
      return ResponseHelper.internalServerError();
    }
  }

  async autocompleteEmployees(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== "GET") {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const query = request.query.get("q") || "";
      if (!query || query.length < 2) {
        return ResponseHelper.badRequest("Query must be at least 2 characters");
      }

      const employees = await this.employeeService.autocompleteEmployees(query);
      return ResponseHelper.ok(employees);
    } catch (error) {
      context.error("Error autocompleting employees:", error);
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
  const employeeService = new EmployeeService(dependencies);
  const controller = new EmployeeController(employeeService);
  return controller.getEmployees(request, context);
};

const getEmployeeByIdFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const employeeService = new EmployeeService(dependencies);
  const controller = new EmployeeController(employeeService);
  return controller.getEmployeeById(request, context);
};

const autocompleteEmployeesFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const employeeService = new EmployeeService(dependencies);
  const controller = new EmployeeController(employeeService);
  return controller.autocompleteEmployees(request, context);
};

app.http("get-employees", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "employees",
  handler: getEmployeesFunction,
});

app.http("get-employee-by-id", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "employees/{id}",
  handler: getEmployeeByIdFunction,
});

app.http("autocomplete-employees", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "employees/autocomplete",
  handler: autocompleteEmployeesFunction,
});