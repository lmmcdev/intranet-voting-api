import { Nomination, NominationWithEmployee } from '../../../common/models/Nomination';
import { CreateNominationDto, Criteria } from '../dto/create-nomination.dto';
import { UpdateNominationDto } from '../dto/update-nomination.dto';
import { VotingPeriod, VotingPeriodStatus } from '../../../common/models/VotingPeriod';
import { VoteResult, VotingPeriodResults, WinnersContainer } from '../../../common/models/VoteResult';
import { NominationRepository } from '../repositories/NominationRepository';
import { VotingPeriodRepository } from '../repositories/VotingPeriodRepository';
import { AzureEmployeeService } from '../../../common/AzureEmployeeService';
import { ValidationService } from './ValidationService';
import { NotificationService } from './NotificationService';
import { EmployeeService } from '../../employee/employee.service';

export class VotingService {
  private nominationRepository: NominationRepository;
  private votingPeriodRepository: VotingPeriodRepository;
  private azureEmployeeService: AzureEmployeeService;
  private validationService: ValidationService;
  private notificationService: NotificationService;
  private employeeService: EmployeeService;

  constructor(
    nominationRepository: NominationRepository,
    votingPeriodRepository: VotingPeriodRepository,
    azureEmployeeService: AzureEmployeeService,
    validationService: ValidationService,
    notificationService: NotificationService,
    employeeService: EmployeeService
  ) {
    this.nominationRepository = nominationRepository;
    this.votingPeriodRepository = votingPeriodRepository;
    this.azureEmployeeService = azureEmployeeService;
    this.validationService = validationService;
    this.notificationService = notificationService;
    this.employeeService = employeeService;
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

    // Group nominations by votingGroup
    const nominationsByGroup = new Map<string, typeof nominations>();
    for (const nomination of nominations) {
      const employee = await this.employeeService.getEmployeeById(nomination.nominatedEmployeeId);
      const votingGroup = employee?.votingGroup || 'default';

      if (!nominationsByGroup.has(votingGroup)) {
        nominationsByGroup.set(votingGroup, []);
      }
      nominationsByGroup.get(votingGroup)!.push(nomination);
    }

    const allResults: VoteResult[] = [];
    const winnersByGroup: VoteResult[] = [];

    // Process each voting group separately
    for (const [votingGroup, groupNominations] of nominationsByGroup.entries()) {
      const employeeVotes = this.aggregateVotes(groupNominations);
      const groupTotalNominations = groupNominations.length;

      const groupResults: VoteResult[] = await Promise.all(
        employeeVotes.map(async (vote, index) => {
          const employee = await this.employeeService.getEmployeeById(vote.employeeId);
          return {
            votingPeriodId,
            employeeId: vote.employeeId,
            employeeName: employee?.fullName || 'Unknown',
            department: employee?.department || 'Unknown',
            position: employee?.position || 'Unknown',
            nominationCount: vote.count,
            percentage: (vote.count / groupTotalNominations) * 100,
            rank: index + 1,
            averageCriteria: vote.averageCriteria,
            votingGroup: votingGroup === 'default' ? undefined : votingGroup,
          };
        })
      );

      allResults.push(...groupResults);

      // The first result in each group is the winner for that group
      if (groupResults[0]) {
        winnersByGroup.push(groupResults[0]);
      }
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
      .sort((a, b) => b.count - a.count);
  }

  async updateNomination(
    nominatorUserName: string,
    updateData: UpdateNominationDto
  ): Promise<Nomination> {
    const currentPeriod = await this.getCurrentVotingPeriod();
    if (!currentPeriod) {
      throw new Error('No active voting period found');
    }

    // Find existing nomination by nominator username and current voting period
    const existingNomination = await this.nominationRepository.findByNominatorUsername(
      nominatorUserName,
      currentPeriod.id
    );
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

    for (const period of recentPeriods) {
      if (period.status === VotingPeriodStatus.CLOSED) {
        const results = await this.getVotingResults(period.id);

        if (results.winners && results.winners.length > 0) {
          const winnersByGroup = results.winners.map(winner => ({
            votingGroup: winner.votingGroup || 'default',
            winner,
          }));

          winnersContainers.push({
            votingPeriodId: period.id,
            year: period.year,
            month: period.month,
            winnersByGroup,
          });
        }
      }
    }

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
}
