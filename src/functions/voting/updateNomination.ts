import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { VotingService } from "../../containers/services/VotingService";
import { UpdateNominationDto } from "../../containers/models/Nomination";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { getDependencies } from "../../containers/utils/Dependencies";
import { AuthHelper } from "../../containers/utils/AuthHelper";

export async function updateNomination(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    if (request.method !== "PUT") {
      return ResponseHelper.methodNotAllowed();
    }

    // Require authentication - any authenticated user can update their own nomination
    const authResult = await AuthHelper.requireAuth(request, context);
    if (!authResult.success) {
      return authResult.response;
    }
    const user = authResult.user;

    const { votingService } = await getDependencies();
    const body = (await request.json()) as UpdateNominationDto;

    // Validate that at least one field is provided for update
    if (!body.nominatedEmployeeId && !body.reason) {
      return ResponseHelper.badRequest(
        "At least one field (nominatedEmployeeId or reason) must be provided for update"
      );
    }

    const updatedNomination = await votingService.updateNomination(user.email, body);

    context.log(`User ${user.email} updated their nomination:`, updatedNomination.id);
    return ResponseHelper.ok(updatedNomination);
  } catch (error) {
    context.error("Error updating nomination:", error);

    if (error instanceof Error) {
      return ResponseHelper.badRequest(error.message);
    }

    return ResponseHelper.internalServerError();
  }
}

app.http("update-nomination", {
  methods: ["PUT"],
  authLevel: "function",
  route: "nominations/update",
  handler: updateNomination,
});