import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { EmployeeSyncService } from "../../common/EmployeeSyncService";
import { ResponseHelper } from "../../common/utils/ResponseHelper";
import { getDependencies } from "../../common/utils/Dependencies";
import { AuthHelper } from "../../common/utils/AuthHelper";

export class EmployeeSyncController {
  private employeeSyncService: EmployeeSyncService;

  constructor(employeeSyncService: EmployeeSyncService) {
    this.employeeSyncService = employeeSyncService;
  }

  async syncAllEmployees(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== "POST") {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      context.log("Starting employee sync from Azure AD to Cosmos DB");
      const syncResult = await this.employeeSyncService.syncEmployeesFromAzure();

      context.log("Sync completed:", {
        newUsers: syncResult.newUsers,
        updatedUsers: syncResult.updatedUsers,
        totalProcessed: syncResult.totalProcessed,
        errors: syncResult.errors.length
      });

      return ResponseHelper.ok({
        message: "Employee sync completed",
        result: syncResult
      });
    } catch (error) {
      context.error("Error during employee sync:", error);
      return ResponseHelper.internalServerError("Employee sync failed");
    }
  }

  async syncSingleEmployee(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== "POST") {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const employeeId = request.params.id;
      if (!employeeId) {
        return ResponseHelper.badRequest("Employee ID is required");
      }

      context.log(`Starting sync for employee: ${employeeId}`);
      const syncResult = await this.employeeSyncService.syncSingleEmployee(employeeId);

      if (syncResult.success) {
        context.log(`Employee sync completed for ${employeeId}:`, syncResult.message);
        return ResponseHelper.ok({
          message: syncResult.message,
          employee: syncResult.employee,
          matchedWithExternal: syncResult.matchedWithExternal ?? false
        });
      } else {
        context.warn(`Employee sync failed for ${employeeId}:`, syncResult.message);
        return ResponseHelper.badRequest(syncResult.message);
      }
    } catch (error) {
      context.error("Error during single employee sync:", error);
      return ResponseHelper.internalServerError("Employee sync failed");
    }
  }

  async getSyncStatus(
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

      const { azureEmployeeService, employeeRepository } = await getDependencies();

      const [azureCount, cosmosCount] = await Promise.all([
        azureEmployeeService.getEmployeeCount(),
        employeeRepository.count()
      ]);

      return ResponseHelper.ok({
        azureEmployeeCount: azureCount,
        cosmosEmployeeCount: cosmosCount,
        syncNeeded: azureCount !== cosmosCount,
        lastSyncTime: null // This could be stored in config or a separate table
      });
    } catch (error) {
      context.error("Error getting sync status:", error);
      return ResponseHelper.internalServerError("Failed to get sync status");
    }
  }
}

// Azure Functions endpoints
const syncAllEmployeesFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { employeeSyncService } = await getDependencies();
  const controller = new EmployeeSyncController(employeeSyncService);
  return controller.syncAllEmployees(request, context);
};

const syncSingleEmployeeFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { employeeSyncService } = await getDependencies();
  const controller = new EmployeeSyncController(employeeSyncService);
  return controller.syncSingleEmployee(request, context);
};

const getSyncStatusFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { employeeSyncService } = await getDependencies();
  const controller = new EmployeeSyncController(employeeSyncService);
  return controller.getSyncStatus(request, context);
};

// Register Azure Functions
app.http("sync-all-employees", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "employees/sync",
  handler: syncAllEmployeesFunction,
});

app.http("sync-single-employee", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "employees/{id}/sync",
  handler: syncSingleEmployeeFunction,
});

app.http("get-sync-status", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "employees/sync/status",
  handler: getSyncStatusFunction,
});
