import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { VotingService } from "../../containers/services/VotingService";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { getDependencies } from "../../containers/utils/Dependencies";

export async function getVotingResults(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const { votingService } = await getDependencies();

    if (request.method !== "GET") {
      return ResponseHelper.methodNotAllowed();
    }

    const votingPeriodId = request.params.id;

    if (!votingPeriodId) {
      return ResponseHelper.badRequest("Voting period ID is required");
    }

    const results = await votingService.getVotingResults(votingPeriodId);

    context.log(`Retrieved results for voting period: ${votingPeriodId}`);
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
  authLevel: "anonymous",
  route: "voting/results/{id}",
  handler: getVotingResults,
});
