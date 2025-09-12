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

export async function createNomination(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const { votingService } = await getDependencies();

    if (request.method !== "POST") {
      return ResponseHelper.methodNotAllowed();
    }

    const body = (await request.json()) as CreateNominationDto;

    if (!body.nominatedEmployeeId || !body.nominatorEmail || !body.reason) {
      return ResponseHelper.badRequest(
        "Missing required fields: nominatedEmployeeId, nominatorEmail, reason"
      );
    }

    const nomination = await votingService.createNomination(body);

    context.log("Nomination created successfully:", nomination.id);
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
