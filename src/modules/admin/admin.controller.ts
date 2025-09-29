import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { AdminService } from "./services/admin.service";
import { ResponseHelper } from "../../common/utils/ResponseHelper";
import { getDependencies } from "../../common/utils/Dependencies";
import { AuthHelper } from "../../common/utils/AuthHelper";

export class AdminController {
  private adminService: AdminService;

  constructor(adminService: AdminService) {
    this.adminService = adminService;
  }

  async setupData(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== "POST") {
        return ResponseHelper.methodNotAllowed();
      }

      context.log("Setting up voting period data");
      const result = await this.adminService.setupVotingPeriod();

      context.log(`Setup completed: ${result.votingPeriod.id}`);
      return ResponseHelper.created(result);
    } catch (error) {
      context.error("Error setting up data:", error);
      return ResponseHelper.internalServerError("Failed to setup initial data");
    }
  }

  async getSystemStatus(
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

      const status = await this.adminService.getSystemStatus();
      return ResponseHelper.ok(status);
    } catch (error) {
      context.error("Error getting system status:", error);
      return ResponseHelper.internalServerError("Failed to get system status");
    }
  }

  async resetVotingPeriod(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== "DELETE") {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const votingPeriodId = request.params.votingPeriodId;
      if (!votingPeriodId) {
        return ResponseHelper.badRequest("Voting period ID is required");
      }

      context.log(`Resetting voting period: ${votingPeriodId}`);
      const result = await this.adminService.resetVotingPeriod(votingPeriodId);

      context.log(`Reset completed: ${result.affectedRecords} records affected`);
      return ResponseHelper.ok(result);
    } catch (error) {
      context.error("Error resetting voting period:", error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError("Failed to reset voting period");
    }
  }

  async ping(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      context.log("Admin module ping called");

      return ResponseHelper.ok({
        message: "Admin module is working",
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url
      });
    } catch (error) {
      context.error("Error in admin ping:", error);
      return ResponseHelper.internalServerError("Admin ping failed");
    }
  }
}

// Azure Functions endpoints
const setupDataFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const adminService = new AdminService(dependencies);
  const controller = new AdminController(adminService);
  return controller.setupData(request, context);
};

const getSystemStatusFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const adminService = new AdminService(dependencies);
  const controller = new AdminController(adminService);
  return controller.getSystemStatus(request, context);
};

const resetVotingPeriodFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const adminService = new AdminService(dependencies);
  const controller = new AdminController(adminService);
  return controller.resetVotingPeriod(request, context);
};

const adminPingFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const adminService = new AdminService(dependencies);
  const controller = new AdminController(adminService);
  return controller.ping(request, context);
};

// Register Azure Functions
app.http("setup-data", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "admin/setup",
  handler: setupDataFunction,
});

app.http("get-system-status", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "admin/status",
  handler: getSystemStatusFunction,
});

app.http("reset-voting-period", {
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "admin/voting/{votingPeriodId}/reset",
  handler: resetVotingPeriodFunction,
});

app.http("admin-ping", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "admin/ping",
  handler: adminPingFunction,
});