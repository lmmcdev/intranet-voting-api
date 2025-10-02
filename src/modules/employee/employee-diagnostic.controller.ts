import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ResponseHelper } from "../../common/utils/ResponseHelper";

export class EmployeeDiagnosticController {
  async ping(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      context.log("Employee diagnostic ping called");

      return ResponseHelper.ok({
        message: "Employee module is working",
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url
      });
    } catch (error) {
      context.error("Error in employee diagnostic:", error);
      return ResponseHelper.internalServerError("Diagnostic failed");
    }
  }

  async checkDependencies(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      context.log("Checking employee dependencies");

      // Try to import and call dependencies
      const { getDependencies } = require("../../common/utils/Dependencies");

      context.log("Dependencies import successful");

      return ResponseHelper.ok({
        message: "Dependencies can be imported",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      context.error("Error checking dependencies:", error);
      return ResponseHelper.internalServerError(`Dependency check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Simple ping endpoint
const employeePingFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const controller = new EmployeeDiagnosticController();
  return controller.ping(request, context);
};

// Dependency check endpoint
const employeeDependencyCheckFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const controller = new EmployeeDiagnosticController();
  return controller.checkDependencies(request, context);
};

// Register diagnostic endpoints
app.http("employee-ping", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "employees/ping",
  handler: employeePingFunction,
});

app.http("employee-dependency-check", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "employees/dependencies/check",
  handler: employeeDependencyCheckFunction,
});