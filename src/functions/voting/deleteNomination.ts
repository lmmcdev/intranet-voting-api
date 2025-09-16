import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { getDependencies } from "../../containers/utils/Dependencies";
import { AuthHelper } from "../../containers/utils/AuthHelper";

export async function deleteNomination(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    if (request.method !== "DELETE") {
      return ResponseHelper.methodNotAllowed();
    }

    // Require authentication - users can only delete their own nominations
    const authResult = await AuthHelper.requireAuth(request, context);
    if (!authResult.success) {
      return authResult.response;
    }
    const user = authResult.user;

    const { votingService, nominationRepository } = await getDependencies();

    // Get current voting period
    const currentPeriod = await votingService.getCurrentVotingPeriod();
    if (!currentPeriod) {
      return ResponseHelper.badRequest("No active voting period found");
    }

    // Find the user's nomination for the current period
    const existingNomination = await nominationRepository.findByNominatorEmail(
      user.email,
      currentPeriod.id
    );

    if (!existingNomination) {
      return ResponseHelper.notFound("No nomination found to delete");
    }

    // Delete the nomination
    await nominationRepository.delete(existingNomination.id);

    context.log(
      `User ${user.email} deleted their nomination: ${existingNomination.id}`
    );

    return ResponseHelper.ok({
      message: "Nomination deleted successfully",
      deletedNominationId: existingNomination.id
    });
  } catch (error) {
    context.error("Error deleting nomination:", error);

    if (error instanceof Error) {
      return ResponseHelper.badRequest(error.message);
    }

    return ResponseHelper.internalServerError();
  }
}

app.http("delete-nomination", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "nominations",
  handler: deleteNomination,
});