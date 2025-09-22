// get all winners
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

export async function getWinners(
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
    const winners = await votingService.getWinners();

    const response = {
      winners: winners,
      totalWinners: winners.length,
    };

    context.log(
      `User ${user.email} accessed all winners (${winners.length} winners)`
    );
    return ResponseHelper.ok(response);
  } catch (error) {
    context.error("Error retrieving winners:", error);
    return ResponseHelper.internalServerError();
  }
}

app.http("get-winners", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "voting/winners",
  handler: getWinners,
});
