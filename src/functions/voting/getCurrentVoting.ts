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

export async function getCurrentVoting(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    if (request.method !== "GET") {
      return ResponseHelper.methodNotAllowed();
    }

    // Require authentication - any authenticated user can view current voting
    const authResult = await AuthHelper.requireAuth(request, context);
    if (!authResult.success) {
      return authResult.response;
    }
    const user = authResult.user;

    const { votingService } = await getDependencies();
    const currentPeriod = await votingService.getCurrentVotingPeriod();

    if (!currentPeriod) {
      return ResponseHelper.notFound("No active voting period found");
    }

    const nominations = await votingService.getNominationsForCurrentPeriod();

    const response = {
      votingPeriod: currentPeriod,
      nominations: nominations,
      totalNominations: nominations.length,
    };

    context.log(
      `User ${user.email} accessed current voting period: ${currentPeriod.year}-${currentPeriod.month}`
    );
    return ResponseHelper.ok(response);
  } catch (error) {
    context.error("Error retrieving current voting:", error);
    return ResponseHelper.internalServerError();
  }
}

app.http("get-current-voting", {
  methods: ["GET"],
  authLevel: "function",
  route: "voting/current",
  handler: getCurrentVoting,
});
