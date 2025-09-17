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

export async function getAllVoting(
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
    const user = authResult.user;

    const { votingService } = await getDependencies();
    const allVotingPeriods = await votingService.getAllVotingPeriods();

    const response = {
      votingPeriods: allVotingPeriods,
      totalPeriods: allVotingPeriods.length,
    };

    context.log(
      `User ${user.email} accessed all voting periods (${allVotingPeriods.length} periods)`
    );
    return ResponseHelper.ok(response);
  } catch (error) {
    context.error("Error retrieving all voting periods:", error);
    return ResponseHelper.internalServerError();
  }
}

app.http("get-all-voting", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "voting/all",
  handler: getAllVoting,
});