import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { getDependencies } from "../../containers/utils/Dependencies";
import { AuthHelper } from "../../containers/utils/AuthHelper";

export async function getEmployeeById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    if (request.method !== "GET") {
      return ResponseHelper.methodNotAllowed();
    }

    // Require authentication - any authenticated user can view employee details
    const authResult = await AuthHelper.requireAuth(request, context);
    if (!authResult.success) {
      return authResult.response;
    }
    const user = authResult.user;

    const employeeId = request.params.id;
    if (!employeeId) {
      return ResponseHelper.badRequest("Employee ID is required");
    }

    const { azureEmployeeService } = await getDependencies();

    // Get employee by ID from Azure AD
    const employee = await azureEmployeeService.getEmployeeById(employeeId);

    if (!employee) {
      return ResponseHelper.notFound("Employee not found");
    }

    context.log(
      `User ${user.email} retrieved employee details for ID: ${employeeId}`
    );
    return ResponseHelper.ok(employee);
  } catch (error) {
    context.error("Error retrieving employee by ID:", error);
    return ResponseHelper.internalServerError();
  }
}

app.http("get-employee-by-id", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "employees/{id}",
  handler: getEmployeeById,
});