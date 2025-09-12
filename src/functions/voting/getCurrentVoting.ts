import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { VotingService } from "../../containers/services/VotingService";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { getDependencies } from "../../containers/utils/Dependencies";

export async function getCurrentVoting(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const { votingService } = await getDependencies();

    if (request.method !== "GET") {
      return ResponseHelper.methodNotAllowed();
    }

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
      `Current voting period: ${currentPeriod.year}-${currentPeriod.month}`
    );
    return ResponseHelper.ok(response);
  } catch (error) {
    context.error("Error retrieving current voting:", error);
    return ResponseHelper.internalServerError();
  }
}

app.http("get-current-voting", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "voting/current",
  handler: getCurrentVoting,
});
