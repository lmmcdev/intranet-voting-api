import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { VotingService } from "../../containers/services/VotingService";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { getDependencies } from "../../containers/utils/Dependencies";
import { AuthHelper } from "../../containers/utils/AuthHelper";

export async function getVotingResults(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    if (request.method !== "GET") {
      return ResponseHelper.methodNotAllowed();
    }

    // Require authentication - temporarily allow any authenticated user in development
    const authResult = await AuthHelper.requireAuth(request, context);
    if (!authResult.success) {
      return authResult.response;
    }
    const user = authResult.user;

    const { votingService } = await getDependencies();
    const votingPeriodId = request.params.id;

    if (!votingPeriodId) {
      return ResponseHelper.badRequest("Voting period ID is required");
    }

    const results = await votingService.getVotingResults(votingPeriodId);

    context.log(`User ${user.email} retrieved results for voting period: ${votingPeriodId}`);
    return ResponseHelper.ok(results);
  } catch (error) {
    context.error("Error retrieving voting results:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return ResponseHelper.notFound(error.message);
    }

    return ResponseHelper.internalServerError();
  }
}

app.http("get-voting-results", {
  methods: ["GET"],
  authLevel: "function",
  route: "voting/results/{id}",
  handler: getVotingResults,
});
