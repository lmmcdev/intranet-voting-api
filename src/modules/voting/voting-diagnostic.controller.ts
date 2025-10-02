import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ResponseHelper } from "../../common/utils/ResponseHelper";

export class VotingDiagnosticController {
  async ping(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      context.log("Voting diagnostic ping called");

      return ResponseHelper.ok({
        message: "Voting module is working",
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url
      });
    } catch (error) {
      context.error("Error in voting diagnostic:", error);
      return ResponseHelper.internalServerError("Voting diagnostic failed");
    }
  }
}

// Simple ping endpoint
const votingPingFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const controller = new VotingDiagnosticController();
  return controller.ping(request, context);
};

// Register diagnostic endpoint
app.http("voting-ping", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "voting/ping",
  handler: votingPingFunction,
});