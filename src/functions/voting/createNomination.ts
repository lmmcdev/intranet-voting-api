import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { VotingService } from "../../containers/services/VotingService";
import { CreateNominationDto } from "../../containers/models/Nomination";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { getDependencies } from "../../containers/utils/Dependencies";
import { AuthHelper } from "../../containers/utils/AuthHelper";

export async function createNomination(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    if (request.method !== "POST") {
      return ResponseHelper.methodNotAllowed();
    }

    // Require authentication - any authenticated user can create nominations
    const authResult = await AuthHelper.requireAuth(request, context);
    if (!authResult.success) {
      return authResult.response;
    }
    const user = authResult.user;

    const { votingService } = await getDependencies();
    const body = (await request.json()) as CreateNominationDto;

    // Use the authenticated user's email as the nominator
    const nominationData = {
      ...body,
      nominatorEmail: user.email,
    };

    if (!nominationData.nominatedEmployeeId || !nominationData.reason) {
      return ResponseHelper.badRequest(
        "Missing required fields: nominatedEmployeeId, reason"
      );
    }

    const nomination = await votingService.createNomination(nominationData);

    context.log(`User ${user.email} created nomination:`, nomination.id);
    return ResponseHelper.created(nomination);
  } catch (error) {
    context.error("Error creating nomination:", error);

    if (error instanceof Error) {
      return ResponseHelper.badRequest(error.message);
    }

    return ResponseHelper.internalServerError();
  }
}

app.http("create-nomination", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "nominations",
  handler: createNomination,
});
