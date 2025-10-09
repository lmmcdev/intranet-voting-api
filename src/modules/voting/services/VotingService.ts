import { Nomination, NominationWithEmployee } from '../../../common/models/Nomination';
import { CreateNominationDto, Criteria } from '../dto/create-nomination.dto';
import { UpdateNominationDto } from '../dto/update-nomination.dto';
import { UpdateVotingPeriodDto } from '../dto/update-voting-period.dto';
import { VotingPeriod, VotingPeriodStatus } from '../../../common/models/VotingPeriod';
import {
  VoteResult,
  VotingPeriodResults,
  WinnersContainer,
} from '../../../common/models/VoteResult';
import { WinnerHistory, WinnerType } from '../../../common/models/WinnerHistory';
import { NominationRepository } from '../repositories/NominationRepository';
import { VotingPeriodRepository } from '../repositories/VotingPeriodRepository';
import { WinnerHistoryRepository } from '../repositories/WinnerHistoryRepository';
import { AzureEmployeeService } from '../../../common/AzureEmployeeService';
import { ValidationService } from './ValidationService';
import { NotificationService } from './NotificationService';
import { EmployeeService } from '../../employee/employee.service';
import { ConfigurationService } from '../../configuration/configuration.service';

export class VotingService {
  private nominationRepository: NominationRepository;
  private votingPeriodRepository: VotingPeriodRepository;
  private winnerHistoryRepository: WinnerHistoryRepository;
  private azureEmployeeService: AzureEmployeeService;
  private validationService: ValidationService;
  private notificationService: NotificationService;
  private employeeService: EmployeeService;
  private configurationService?: ConfigurationService;

  constructor(
    nominationRepository: NominationRepository,
    votingPeriodRepository: VotingPeriodRepository,
    winnerHistoryRepository: WinnerHistoryRepository,
    azureEmployeeService: AzureEmployeeService,
    validationService: ValidationService,
    notificationService: NotificationService,
    employeeService: EmployeeService,
    configurationService?: ConfigurationService
  ) {
    this.nominationRepository = nominationRepository;
    this.votingPeriodRepository = votingPeriodRepository;
    this.winnerHistoryRepository = winnerHistoryRepository;
    this.azureEmployeeService = azureEmployeeService;
    this.validationService = validationService;
    this.notificationService = notificationService;
    this.employeeService = employeeService;
    this.configurationService = configurationService;
  }

  async createNomination(nominationData: CreateNominationDto): Promise<Nomination> {
    const currentPeriod = await this.getCurrentVotingPeriod();
    if (!currentPeriod) {
      throw new Error('No active voting period found');
    }

    if (!nominationData.nominatorUserName || !nominationData.nominatorUserId) {
      throw new Error('Nominator information is required');
    }

    await this.validationService.validateNomination(nominationData, currentPeriod.id);

    const nomination: Nomination = {
      id: this.generateId(),
      nominatedEmployeeId: nominationData.nominatedEmployeeId,
      nominatorUserName: nominationData.nominatorUserName,
      nominatorUserId: nominationData.nominatorUserId,
      reason: nominationData.reason,
      criteria: nominationData.criteria,
      votingPeriodId: currentPeriod.id,
      createdAt: new Date(),
    };

    const createdNomination = await this.nominationRepository.create(nomination);

    try {
      const nominatedEmployee = await this.employeeService.getEmployeeById(
        nominationData.nominatedEmployeeId
      );

      if (nominatedEmployee) {
        await this.notificationService.sendNominationNotification(
          nominationData.nominatorUserName,
          nominatedEmployee.fullName || 'Unknown Employee',
          nominatedEmployee.department,
          currentPeriod,
          nominationData.reason
        );
      }
    } catch (error) {
      console.error('Failed to send nomination notification:', error);
    }

    return createdNomination;
  }

  async getCurrentVotingPeriod(): Promise<VotingPeriod | null> {
    return await this.votingPeriodRepository.findActiveVotingPeriod();
  }

  async getNominationsForCurrentPeriod(): Promise<NominationWithEmployee[]> {
    const currentPeriod = await this.getCurrentVotingPeriod();
    if (!currentPeriod) {
      return [];
    }

    const nominations = await this.nominationRepository.findByVotingPeriod(currentPeriod.id);

    const nominationsWithEmployee: NominationWithEmployee[] = [];

    for (const nomination of nominations) {
      const employee = await this.employeeService.getEmployeeById(nomination.nominatedEmployeeId);

      nominationsWithEmployee.push({
        ...nomination,
        nominatedEmployee: {
          fullName: employee?.fullName || 'Unknown Employee',
          department: employee?.department || 'Unknown',
          position: employee?.position || 'Unknown',
        },
      });
    }

    return nominationsWithEmployee;
  }

  async getAllVotingPeriods(): Promise<VotingPeriod[]> {
    return await this.votingPeriodRepository.findRecentPeriods();
  }

  async getVotingResults(votingPeriodId: string): Promise<VotingPeriodResults> {
    const votingPeriod = await this.votingPeriodRepository.findById(votingPeriodId);
    if (!votingPeriod) {
      throw new Error('Voting period not found');
    }

    const nominations = await this.nominationRepository.findByVotingPeriod(votingPeriodId);

    // Get all unique employee IDs from nominations
    const uniqueEmployeeIds = [...new Set(nominations.map(n => n.nominatedEmployeeId))];

    // Fetch all employees in parallel
    const employeePromises = uniqueEmployeeIds.map(id =>
      this.employeeService.getEmployeeById(id)
    );
    const employees = await Promise.all(employeePromises);

    // Create a map for quick employee lookup
    const employeeMap = new Map();
    uniqueEmployeeIds.forEach((id, index) => {
      employeeMap.set(id, employees[index]);
    });

    // Group nominations by votingGroup
    const nominationsByGroup = new Map<string, typeof nominations>();
    for (const nomination of nominations) {
      const employee = employeeMap.get(nomination.nominatedEmployeeId);
      const votingGroup = employee?.votingGroup || 'default';

      if (!nominationsByGroup.has(votingGroup)) {
        nominationsByGroup.set(votingGroup, []);
      }
      nominationsByGroup.get(votingGroup)!.push(nomination);
    }

    const allResults: VoteResult[] = [];
    const winnersByGroup: VoteResult[] = [];

    // Get eligibility config for winners formula
    const eligibilityConfig = this.configurationService
      ? await this.configurationService.getEligibilityConfig()
      : null;

    // Process each voting group separately
    for (const [votingGroup, groupNominations] of nominationsByGroup.entries()) {
      const employeeVotes = this.aggregateVotes(groupNominations);
      const groupTotalNominations = groupNominations.length;

      const groupResults: VoteResult[] = employeeVotes.map((vote, index) => {
        const employee = employeeMap.get(vote.employeeId);
        return {
          votingPeriodId,
          employeeId: vote.employeeId,
          employeeName: employee?.fullName || 'Unknown',
          department: employee?.department || 'Unknown',
          position: employee?.position || 'Unknown',
          nominationCount: vote.count,
          percentage: Math.round((vote.count / groupTotalNominations) * 100 * 100) / 100,
          rank: index + 1,
          averageCriteria: vote.averageCriteria,
          votingGroup: votingGroup === 'default' ? undefined : votingGroup,
        };
      });

      allResults.push(...groupResults);

      // Calculate number of winners for this group using formula
      let numberOfWinners = 1; // Default to 1 winner
      if (eligibilityConfig?.winnersFormula) {
        const formula = eligibilityConfig.winnersFormula;
        numberOfWinners = Math.round(groupTotalNominations / formula.divisor);
        numberOfWinners = Math.max(formula.minWinners, numberOfWinners);
      }

      // Select top N winners for this group
      const groupWinners = groupResults.slice(0, numberOfWinners);
      winnersByGroup.push(...groupWinners);
    }

    const totalNominations = nominations.length;
    const totalVotes = allResults.reduce((sum, result) => sum + result.nominationCount, 0);
    const totalEmployees = await this.employeeService.getEmployeeCount();

    console.log(
      `Total Employees: ${totalEmployees}, Total Votes: ${totalVotes}, Total Nominations: ${totalNominations}`
    );

    const averageRate = totalEmployees > 0 ? totalNominations / totalEmployees : 0;
    const averageVotes = +(averageRate * 100).toFixed(2);

    // Sort results by votingGroup and rank
    allResults.sort((a, b) => {
      const groupA = a.votingGroup || 'default';
      const groupB = b.votingGroup || 'default';
      if (groupA !== groupB) {
        return groupA.localeCompare(groupB);
      }
      return a.rank - b.rank;
    });

    return {
      votingPeriod: {
        id: votingPeriod.id,
        year: votingPeriod.year,
        month: votingPeriod.month,
        status: votingPeriod.status,
      },
      totalNominations,
      averageVotes,
      results: allResults,
      winner: winnersByGroup[0], // For backwards compatibility, return first winner
      winners: winnersByGroup,
    };
  }

  private aggregateVotes(
    nominations: Nomination[]
  ): { employeeId: string; count: number; averageCriteria: Criteria }[] {
    const voteMap = new Map<string, { count: number; totalCriteria: Criteria }>();

    nominations.forEach(nomination => {
      const current = voteMap.get(nomination.nominatedEmployeeId) || {
        count: 0,
        totalCriteria: {
          communication: 0,
          innovation: 0,
          leadership: 0,
          problemSolving: 0,
          reliability: 0,
          teamwork: 0,
        },
      };

      voteMap.set(nomination.nominatedEmployeeId, {
        count: current.count + 1,
        totalCriteria: {
          communication: current.totalCriteria.communication + nomination.criteria.communication,
          innovation: current.totalCriteria.innovation + nomination.criteria.innovation,
          leadership: current.totalCriteria.leadership + nomination.criteria.leadership,
          problemSolving: current.totalCriteria.problemSolving + nomination.criteria.problemSolving,
          reliability: current.totalCriteria.reliability + nomination.criteria.reliability,
          teamwork: current.totalCriteria.teamwork + nomination.criteria.teamwork,
        },
      });
    });

    return Array.from(voteMap.entries())
      .map(([employeeId, data]) => ({
        employeeId,
        count: data.count,
        averageCriteria: {
          communication: Math.round((data.totalCriteria.communication / data.count) * 10) / 10,
          innovation: Math.round((data.totalCriteria.innovation / data.count) * 10) / 10,
          leadership: Math.round((data.totalCriteria.leadership / data.count) * 10) / 10,
          problemSolving: Math.round((data.totalCriteria.problemSolving / data.count) * 10) / 10,
          reliability: Math.round((data.totalCriteria.reliability / data.count) * 10) / 10,
          teamwork: Math.round((data.totalCriteria.teamwork / data.count) * 10) / 10,
        },
      }))
      .sort((a, b) => {
        // Sort by vote count first
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        // In case of tie, sort by average criteria score
        const avgA =
          (a.averageCriteria.communication +
            a.averageCriteria.innovation +
            a.averageCriteria.leadership +
            a.averageCriteria.problemSolving +
            a.averageCriteria.reliability +
            a.averageCriteria.teamwork) /
          6;

        const avgB =
          (b.averageCriteria.communication +
            b.averageCriteria.innovation +
            b.averageCriteria.leadership +
            b.averageCriteria.problemSolving +
            b.averageCriteria.reliability +
            b.averageCriteria.teamwork) /
          6;

        return avgB - avgA;
      });
  }

  async updateNomination(
    nominationId: string,
    updateData: UpdateNominationDto
  ): Promise<Nomination> {
    const currentPeriod = await this.getCurrentVotingPeriod();
    if (!currentPeriod) {
      throw new Error('No active voting period found');
    }

    // Find existing nomination by nominator username and current voting period
    /*  const existingNomination = await this.nominationRepository.findByNominatorUsername(
      nominatorUserName,
      currentPeriod.id
    ); */
    const existingNomination = await this.nominationRepository.findById(nominationId);
    if (!existingNomination) {
      throw new Error('No existing nomination found to update');
    }

    // Validate the updated data if provided
    if (updateData.nominatedEmployeeId) {
      await this.validationService.validateEmployee(updateData.nominatedEmployeeId);

      // Check for self-nomination
      const updateNominationData: CreateNominationDto = {
        nominatedEmployeeId: updateData.nominatedEmployeeId,
        nominatorUserName: existingNomination.nominatorUserName,
        nominatorUserId: existingNomination.nominatorUserId,
        reason: updateData.reason || existingNomination.reason,
        criteria: updateData.criteria || existingNomination.criteria,
      };
      await this.validationService.validateSelfNomination(updateNominationData);
    }

    if (updateData.reason) {
      await this.validationService.validateNominationReason(updateData.reason);
    }

    if (updateData.criteria) {
      this.validationService.validateCriteria(updateData.criteria);
    }

    // Update the nomination
    const updatedNomination: Nomination = {
      ...existingNomination,
      nominatedEmployeeId: updateData.nominatedEmployeeId || existingNomination.nominatedEmployeeId,
      reason: updateData.reason || existingNomination.reason,
      criteria: updateData.criteria || existingNomination.criteria,
      updatedAt: new Date(),
    };

    return await this.nominationRepository.update(existingNomination.id, updatedNomination);
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  async getWinners(): Promise<VoteResult[]> {
    const recentPeriods = await this.votingPeriodRepository.findRecentPeriods();
    const winners: VoteResult[] = [];

    for (const period of recentPeriods) {
      if (period.status === VotingPeriodStatus.CLOSED) {
        const results = await this.getVotingResults(period.id);
        // Include all winners from all voting groups
        if (results.winners && results.winners.length > 0) {
          winners.push(...results.winners);
        } else if (results.winner) {
          // Fallback for backwards compatibility
          winners.push(results.winner);
        }
      }
    }

    return winners;
  }

  async getWinnersGrouped(): Promise<WinnersContainer[]> {
    const recentPeriods = await this.votingPeriodRepository.findRecentPeriods();
    const winnersContainers: WinnersContainer[] = [];

    // Process periods in parallel
    const containerPromises = recentPeriods
      .filter(period => period.status === VotingPeriodStatus.ACTIVE)
      .map(async period => {
        const results = await this.getVotingResults(period.id);

        if (results.winners && results.winners.length > 0) {
          const winnersByGroup = results.winners.map(winner => ({
            votingGroup: winner.votingGroup || 'default',
            winner,
          }));

          return {
            votingPeriodId: period.id,
            year: period.year,
            month: period.month,
            winnersByGroup,
          };
        }
        return null;
      });

    const containers = await Promise.all(containerPromises);
    winnersContainers.push(...containers.filter((c): c is WinnersContainer => c !== null));

    return winnersContainers;
  }

  async getNomination(id: string): Promise<Nomination | null> {
    return this.nominationRepository.findById(id);
  }

  async getMyNominations(nominatorUserName: string): Promise<NominationWithEmployee | null> {
    const currentPeriod = await this.getCurrentVotingPeriod();
    if (!currentPeriod) {
      return null;
    }

    const nomination = await this.nominationRepository.findByNominatorUsername(
      nominatorUserName,
      currentPeriod.id
    );

    if (!nomination) {
      return null;
    }

    const employee = await this.employeeService.getEmployeeById(nomination.nominatedEmployeeId);

    const nominationWithEmployee: NominationWithEmployee = {
      ...nomination,
      nominatedEmployee: {
        fullName: employee?.fullName || 'Unknown Employee',
        department: employee?.department || 'Unknown',
        position: employee?.position || 'Unknown',
      },
    };

    return nominationWithEmployee;
  }

  async deleteNomination(id: string): Promise<void> {
    await this.nominationRepository.delete(id);
  }

  async updateVotingPeriod(
    votingPeriodId: string,
    updateData: UpdateVotingPeriodDto
  ): Promise<VotingPeriod> {
    const period = await this.votingPeriodRepository.findById(votingPeriodId);
    if (!period) {
      throw new Error('Voting period not found');
    }

    // Validate that if changing year/month, no period exists for that combination
    if (updateData.year !== undefined || updateData.month !== undefined) {
      const targetYear = updateData.year ?? period.year;
      const targetMonth = updateData.month ?? period.month;

      // Only check if year or month is actually changing
      if (targetYear !== period.year || targetMonth !== period.month) {
        const existingPeriod = await this.votingPeriodRepository.findByYearAndMonth(
          targetYear,
          targetMonth
        );
        if (existingPeriod && existingPeriod.id !== votingPeriodId) {
          throw new Error(`A voting period already exists for ${targetYear}-${targetMonth}`);
        }
      }
    }

    // Update only provided fields
    const updatedPeriod: VotingPeriod = {
      ...period,
      ...(updateData.year !== undefined && { year: updateData.year }),
      ...(updateData.month !== undefined && { month: updateData.month }),
      ...(updateData.startDate !== undefined && { startDate: updateData.startDate }),
      ...(updateData.endDate !== undefined && { endDate: updateData.endDate }),
      ...(updateData.status !== undefined && { status: updateData.status }),
      ...(updateData.description !== undefined && { description: updateData.description }),
    };

    return this.votingPeriodRepository.update(votingPeriodId, updatedPeriod);
  }

  async closeVotingPeriod(votingPeriodId: string): Promise<VotingPeriod> {
    const period = await this.votingPeriodRepository.findById(votingPeriodId);
    if (!period) {
      throw new Error('Voting period not found');
    }

    if (period.status === VotingPeriodStatus.CLOSED) {
      throw new Error('Voting period is already closed');
    }

    period.status = VotingPeriodStatus.CLOSED;
    period.endDate = new Date();

    return this.votingPeriodRepository.update(votingPeriodId, period);
  }

  async selectRandomWinnerFromAll(votingPeriodId: string): Promise<VoteResult> {
    // Get voting results for the period
    const results = await this.getVotingResults(votingPeriodId);

    // Get all winners (one per voting group)
    const winners = results.winners || [];

    if (winners.length === 0) {
      throw new Error('No winners found for this voting period');
    }

    // Select one random winner from all group winners
    const randomIndex = Math.floor(Math.random() * winners.length);
    const selectedWinner = winners[randomIndex];

    // Save winners to history: general winner and all group winners
    await this.saveWinnersToHistory(votingPeriodId, winners, selectedWinner);

    // Close the voting period commented out to allow manual closing later
    //await this.closeVotingPeriod(votingPeriodId);

    return selectedWinner;
  }

  private async saveWinnersToHistory(
    votingPeriodId: string,
    winners: VoteResult[],
    generalWinner: VoteResult
  ): Promise<void> {
    const period = await this.votingPeriodRepository.findById(votingPeriodId);
    if (!period) {
      throw new Error('Voting period not found');
    }

    // Delete existing winners for this period (in case of re-calculation)
    await this.winnerHistoryRepository.deleteByVotingPeriod(votingPeriodId);

    // Save the general winner (único ganador del período)
    const generalWinnerHistory: WinnerHistory = {
      id: this.generateId(),
      votingPeriodId,
      year: period.year,
      month: period.month,
      employeeId: generalWinner.employeeId,
      employeeName: generalWinner.employeeName,
      department: generalWinner.department,
      position: generalWinner.position,
      nominationCount: generalWinner.nominationCount,
      percentage: generalWinner.percentage,
      rank: generalWinner.rank,
      averageCriteria: generalWinner.averageCriteria,
      votingGroup: generalWinner.votingGroup,
      winnerType: WinnerType.GENERAL,
      createdAt: new Date(),
    };
    await this.winnerHistoryRepository.create(generalWinnerHistory);

    // Save all group winners (ganadores por departamento/grupo)
    for (const winner of winners) {
      const groupWinnerHistory: WinnerHistory = {
        id: this.generateId(),
        votingPeriodId,
        year: period.year,
        month: period.month,
        employeeId: winner.employeeId,
        employeeName: winner.employeeName,
        department: winner.department,
        position: winner.position,
        nominationCount: winner.nominationCount,
        percentage: winner.percentage,
        rank: winner.rank,
        averageCriteria: winner.averageCriteria,
        votingGroup: winner.votingGroup,
        winnerType: WinnerType.BY_GROUP,
        createdAt: new Date(),
      };

      await this.winnerHistoryRepository.create(groupWinnerHistory);
    }
  }

  async getWinnerHistory(): Promise<WinnerHistory[]> {
    return await this.winnerHistoryRepository.findAll();
  }

  async getWinnerHistoryByYear(year: number): Promise<WinnerHistory[]> {
    return await this.winnerHistoryRepository.findByYear(year);
  }

  async getWinnerHistoryByYearAndMonth(year: number, month: number): Promise<WinnerHistory[]> {
    return await this.winnerHistoryRepository.findByYearAndMonth(year, month);
  }

  async getYearlyWinners(): Promise<WinnerHistory[]> {
    return await this.winnerHistoryRepository.findYearlyWinners();
  }

  async getYearlyWinnerByYear(year: number): Promise<WinnerHistory | null> {
    return await this.winnerHistoryRepository.findYearlyWinnerByYear(year);
  }

  async markWinnerAsYearly(winnerId: string): Promise<WinnerHistory> {
    return await this.winnerHistoryRepository.markAsYearlyWinner(winnerId);
  }

  async unmarkWinnerAsYearly(winnerId: string): Promise<WinnerHistory> {
    return await this.winnerHistoryRepository.unmarkAsYearlyWinner(winnerId);
  }

  async getEmployeeResults(employeeId: string, votingPeriodId?: string): Promise<NominationWithEmployee[]> {
    let nominations: Nomination[] = [];

    if (votingPeriodId) {
      // Get nominations for specific voting period
      nominations = await this.nominationRepository.findByVotingPeriod(votingPeriodId);
    } else {
      // Get nominations for all recent periods
      const recentPeriods = await this.votingPeriodRepository.findRecentPeriods();

      for (const period of recentPeriods) {
        const periodNominations = await this.nominationRepository.findByVotingPeriod(period.id);
        nominations.push(...periodNominations);
      }
    }

    // Filter nominations for this specific employee
    const employeeNominations = nominations.filter(
      nomination => nomination.nominatedEmployeeId === employeeId
    );

    // Get employee details and convert to NominationWithEmployee
    const nominationsWithEmployee: NominationWithEmployee[] = [];

    for (const nomination of employeeNominations) {
      const employee = await this.employeeService.getEmployeeById(nomination.nominatedEmployeeId);

      nominationsWithEmployee.push({
        ...nomination,
        nominatedEmployee: {
          fullName: employee?.fullName || 'Unknown Employee',
          department: employee?.department || 'Unknown',
          position: employee?.position || 'Unknown',
        },
      });
    }

    return nominationsWithEmployee;
  }
}
