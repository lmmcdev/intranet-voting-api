import { app, InvocationContext, Timer } from "@azure/functions";
import { VotingPeriodRepository } from "../../containers/repositories/VotingPeriodRepository";
import { NotificationService } from "../../containers/services/NotificationService";
import { VotingService } from "../../containers/services/VotingService";
import { VotingPeriodStatus } from "../../containers/models/VotingPeriod";
import { getDependencies } from "../../containers/utils/Dependencies";

export async function closeVotingPeriod(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  try {
    const { votingPeriodRepository, notificationService, votingService } =
      await getDependencies();

    context.log("Checking for expired voting periods...");

    const expiredPeriods =
      await votingPeriodRepository.findExpiredActivePeriods();

    if (expiredPeriods.length === 0) {
      context.log("No expired voting periods found");
      return;
    }

    for (const period of expiredPeriods) {
      context.log(`Closing voting period: ${period.year}-${period.month}`);

      period.status = VotingPeriodStatus.CLOSED;
      period.updatedAt = new Date();

      await votingPeriodRepository.update(period.id, period);

      await notificationService.sendVotingCloseNotification(period);

      const results = await votingService.getVotingResults(period.id);
      if (results.winner) {
        await notificationService.sendWinnerAnnouncement(
          results.winner,
          period
        );
      }

      context.log(`Voting period ${period.id} closed successfully`);
    }

    context.log(`Processed ${expiredPeriods.length} expired voting periods`);
  } catch (error) {
    context.error("Error in closeVotingPeriod timer function:", error);
    throw error;
  }
}

app.timer("close-voting-period", {
  schedule: "0 0 1 * *",
  handler: closeVotingPeriod,
});
