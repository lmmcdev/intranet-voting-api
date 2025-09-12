import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { EmployeeService } from "../../containers/services/EmployeeService";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { getDependencies } from "../../containers/utils/Dependencies";

export async function getEmployees(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const { employeeService } = await getDependencies();

    if (request.method !== "GET") {
      return ResponseHelper.methodNotAllowed();
    }

    const employees = await employeeService.getAllActiveEmployees();

    context.log(`Retrieved ${employees.length} active employees`);
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
