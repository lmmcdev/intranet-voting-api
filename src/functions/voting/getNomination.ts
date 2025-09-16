import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { getDependencies } from "../../containers/utils/Dependencies";
import { AuthHelper } from "../../containers/utils/AuthHelper";

export async function getNomination(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    if (request.method !== "GET") {
      return ResponseHelper.methodNotAllowed();
    }

    // Require authentication - users can only view their own nomination
    const authResult = await AuthHelper.requireAuth(request, context);
    if (!authResult.success) {
      return authResult.response;
    }
    const user = authResult.user;

    const { votingService, nominationRepository, azureEmployeeService } = await getDependencies();

    // Get current voting period
    const currentPeriod = await votingService.getCurrentVotingPeriod();
    if (!currentPeriod) {
      return ResponseHelper.badRequest("No active voting period found");
    }

    // Find the user's nomination for the current period
    const nomination = await nominationRepository.findByNominatorEmail(
      user.email,
      currentPeriod.id
    );

    if (!nomination) {
      return ResponseHelper.notFound("No nomination found for current voting period");
    }

    // Get nominated employee details
    const employee = await azureEmployeeService.getEmployeeById(nomination.nominatedEmployeeId);

    const nominationWithEmployee = {
      ...nomination,
      nominatedEmployee: {
        name: employee?.name || 'Unknown Employee',
        department: employee?.department || 'Unknown',
        position: employee?.position || 'Unknown'
      }
    };

    context.log(`User ${user.email} retrieved their nomination: ${nomination.id}`);

    return ResponseHelper.ok(nominationWithEmployee);
  } catch (error) {
    context.error("Error retrieving nomination:", error);

    if (error instanceof Error) {
      return ResponseHelper.badRequest(error.message);
    }

    return ResponseHelper.internalServerError();
  }
}

app.http("get-nomination", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "nominations/my",
  handler: getNomination,
});