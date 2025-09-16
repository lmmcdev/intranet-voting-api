import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { EmployeeService } from "../../containers/services/EmployeeService";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { getDependencies } from "../../containers/utils/Dependencies";
import { AuthHelper } from "../../containers/utils/AuthHelper";

export async function getEmployees(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    if (request.method !== "GET") {
      return ResponseHelper.methodNotAllowed();
    }

    // Require authentication - any authenticated user can view employees
    const authResult = await AuthHelper.requireAuth(request, context);
    if (!authResult.success) {
      return authResult.response;
    }
    const user = authResult.user;

    const { azureEmployeeService } = await getDependencies();

    // AzureEmployeeService automatically handles fallback to mock data
    const employees = await azureEmployeeService.getAllActiveEmployees();

    context.log(
      `User ${user.email} retrieved ${employees.length} active employees`
    );
    return ResponseHelper.ok(employees);
  } catch (error) {
    context.error("Error retrieving employees:", error);
    return ResponseHelper.internalServerError();
  }
}

app.http("get-employees", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "employees",
  handler: getEmployees,
});
