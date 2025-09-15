import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getDependencies } from "../../containers/utils/Dependencies";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { VotingPeriodStatus } from "../../containers/models/VotingPeriod";

export async function setupData(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    if (request.method !== "POST") {
      return ResponseHelper.methodNotAllowed();
    }

    const { votingPeriodRepository } = await getDependencies();

    // Create current voting period (this month)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JavaScript months are 0-indexed

    // Start of month to end of month
    const startDate = new Date(year, now.getMonth(), 1);
    const endDate = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

    const votingPeriod = {
      id: `vp-${year}-${month.toString().padStart(2, "0")}`,
      year,
      month,
      startDate,
      endDate,
      status: VotingPeriodStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Check if voting period already exists
    const existingPeriod = await votingPeriodRepository.findById(
      votingPeriod.id
    );
    if (existingPeriod) {
      context.log(`Voting period ${votingPeriod.id} already exists`);
      return ResponseHelper.ok({
        message: "Voting period already exists",
        votingPeriod: existingPeriod,
      });
    }

    // Create the voting period
    const createdPeriod = await votingPeriodRepository.create(votingPeriod);

    context.log(`Created voting period: ${createdPeriod.id}`);

    return ResponseHelper.created({
      message: "Setup completed successfully",
      votingPeriod: createdPeriod,
      instructions: {
        "1": "Voting period created for current month",
        "2": "You can now create nominations using POST /api/nominations",
        "3": "Use GET /api/voting/current to see the active voting period",
        "4": "Use GET /api/employees to see available employees for nomination",
      },
    });
  } catch (error) {
    context.error("Error setting up data:", error);
    return ResponseHelper.internalServerError("Failed to setup initial data");
  }
}

app.http("setup-data", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "setup",
  handler: setupData,
});
