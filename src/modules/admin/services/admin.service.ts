import { VotingPeriod, VotingPeriodStatus } from '../../../common/models/VotingPeriod';
import { SetupResponseDto, SetupStatusDto } from '../dto/setup-response.dto';

export class AdminService {
  private dependencies: any;

  constructor(dependencies: any) {
    this.dependencies = dependencies;
  }

  async setupVotingPeriod(): Promise<SetupResponseDto> {
    const { votingPeriodRepository } = this.dependencies;

    // Create current voting period (this month)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JavaScript months are 0-indexed

    // Start of month to end of month
    const startDate = new Date(year, now.getMonth(), 1);
    const endDate = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

    const votingPeriod: VotingPeriod = {
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
    const existingPeriod = await votingPeriodRepository.findById(votingPeriod.id);
    if (existingPeriod) {
      return {
        message: "Voting period already exists",
        votingPeriod: existingPeriod,
      };
    }

    // Create the voting period
    const createdPeriod = await votingPeriodRepository.create(votingPeriod);

    return {
      message: "Setup completed successfully",
      votingPeriod: createdPeriod,
      instructions: {
        "1": "Voting period created for current month",
        "2": "You can now create nominations using POST /api/nominations",
        "3": "Use GET /api/voting/current to see the active voting period",
        "4": "Use GET /api/employees to see available employees for nomination",
      },
    };
  }

  async getSystemStatus(): Promise<SetupStatusDto> {
    const { votingPeriodRepository, nominationRepository, azureEmployeeService } = this.dependencies;

    // Get current voting period
    const currentPeriod = await votingPeriodRepository.findActiveVotingPeriod();

    // Get employee count
    const totalEmployees = await azureEmployeeService.getEmployeeCount();

    // Get nomination count for current period
    let totalNominations = 0;
    if (currentPeriod) {
      const nominations = await nominationRepository.findByVotingPeriod(currentPeriod.id);
      totalNominations = nominations.length;
    }

    // Determine system status and recommendations
    const recommendations: string[] = [];
    let systemStatus: 'ready' | 'needs_setup' | 'partial' = 'ready';

    if (!currentPeriod) {
      systemStatus = 'needs_setup';
      recommendations.push('No active voting period found. Run setup to create one.');
    }

    if (totalEmployees === 0) {
      systemStatus = systemStatus === 'ready' ? 'partial' : 'needs_setup';
      recommendations.push('No employees found in Azure AD. Check Azure configuration.');
    }

    if (currentPeriod && totalNominations === 0) {
      recommendations.push('No nominations yet for current period. Encourage users to nominate colleagues.');
    }

    if (totalEmployees > 0 && currentPeriod && totalNominations > 0) {
      recommendations.push('System is running smoothly! Check voting results regularly.');
    }

    return {
      currentVotingPeriod: currentPeriod,
      totalEmployees,
      totalNominations,
      systemStatus,
      recommendations,
    };
  }

  async resetVotingPeriod(votingPeriodId: string): Promise<{ message: string; affectedRecords: number }> {
    const { votingPeriodRepository, nominationRepository } = this.dependencies;

    // Find the voting period
    const period = await votingPeriodRepository.findById(votingPeriodId);
    if (!period) {
      throw new Error('Voting period not found');
    }

    // Count nominations to be deleted
    const nominations = await nominationRepository.findByVotingPeriod(votingPeriodId);
    const affectedRecords = nominations.length;

    // Delete all nominations for this period
    for (const nomination of nominations) {
      await nominationRepository.delete(nomination.id);
    }

    // Delete the voting period
    await votingPeriodRepository.delete(votingPeriodId);

    return {
      message: `Successfully reset voting period ${votingPeriodId}`,
      affectedRecords,
    };
  }
}