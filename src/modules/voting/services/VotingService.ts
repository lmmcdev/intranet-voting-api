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
import { WinnerHistory, WinnerType, Reaction } from '../../../common/models/WinnerHistory';
import { NominationRepository } from '../repositories/NominationRepository';
import { VotingPeriodRepository } from '../repositories/VotingPeriodRepository';
import { WinnerHistoryRepository } from '../repositories/WinnerHistoryRepository';
import { AzureEmployeeService } from '../../../common/AzureEmployeeService';
import { ValidationService } from './ValidationService';
import { NotificationService } from './NotificationService';
import { EmployeeService } from '../../employee/employee.service';
import { ConfigurationService } from '../../configuration/configuration.service';
import { AuditService } from '../../../common/services/AuditService';
import { AuditEntity, AuditAction } from '../../../common/models/AuditLog';
import {
  PaginationParams,
  PaginatedResponse,
  parsePaginationParams,
  calculatePaginationMeta,
} from '../../../common/models/Pagination';

export class VotingService {
  private nominationRepository: NominationRepository;
  private votingPeriodRepository: VotingPeriodRepository;
  private winnerHistoryRepository: WinnerHistoryRepository;
  private validationService: ValidationService;
  private notificationService: NotificationService;
  private employeeService: EmployeeService;
  private configurationService?: ConfigurationService;
  private auditService?: AuditService;

  constructor(
    nominationRepository: NominationRepository,
    votingPeriodRepository: VotingPeriodRepository,
    winnerHistoryRepository: WinnerHistoryRepository,
    azureEmployeeService: AzureEmployeeService,
    validationService: ValidationService,
    notificationService: NotificationService,
    employeeService: EmployeeService,
    configurationService?: ConfigurationService,
    auditService?: AuditService
  ) {
    this.nominationRepository = nominationRepository;
    this.votingPeriodRepository = votingPeriodRepository;
    this.winnerHistoryRepository = winnerHistoryRepository;
    this.validationService = validationService;
    this.notificationService = notificationService;
    this.employeeService = employeeService;
    this.configurationService = configurationService;
    this.auditService = auditService;
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

  /**
   * Get nominations for current period with pagination using Cosmos DB continuation tokens
   *
   * Example usage:
   * ```typescript
   * // First page
   * const page1 = await getNominationsForCurrentPeriodPaginated({ limit: 10 });
   * // Returns: { data: [...10 items], meta: { continuationToken: "ABC123", hasNextPage: true } }
   *
   * // Next page
   * const page2 = await getNominationsForCurrentPeriodPaginated({
   *   limit: 10,
   *   continuationToken: "ABC123"
   * });
   * // Returns: { data: [...10 items], meta: { continuationToken: "XYZ789", hasNextPage: true } }
   * ```
   *
   * @param pagination - Pagination parameters (limit, continuationToken)
   * @returns Paginated response with nominations and metadata
   */
  async getNominationsForCurrentPeriodPaginated(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<NominationWithEmployee>> {
    const currentPeriod = await this.getCurrentVotingPeriod();
    if (!currentPeriod) {
      return {
        data: [],
        meta: calculatePaginationMeta(0, pagination.limit || 10, undefined),
      };
    }

    // Parse and validate pagination params
    const { limit, continuationToken } = parsePaginationParams(pagination);

    // Decode continuation token to get offset
    let offset = 0;
    if (continuationToken) {
      try {
        const decoded = Buffer.from(continuationToken, 'base64').toString('utf-8');
        const tokenData = JSON.parse(decoded);
        offset = tokenData.offset || 0;
      } catch (error) {
        console.error('Failed to decode continuation token:', error);
        offset = 0;
      }
    }

    // Query with pagination using offset
    const result = await this.nominationRepository.findByVotingPeriodPaginated(
      currentPeriod.id,
      limit,
      offset
    );

    // Enrich nominations with employee data
    const nominationsWithEmployee: NominationWithEmployee[] = [];

    for (const nomination of result.resources) {
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

    // Calculate pagination metadata
    const meta = calculatePaginationMeta(
      nominationsWithEmployee.length,
      limit,
      result.continuationToken
    );

    return {
      data: nominationsWithEmployee,
      meta,
    };
  }

  async getAllVotingPeriods(): Promise<VotingPeriod[]> {
    return await this.votingPeriodRepository.findRecentPeriods();
  }

  async getVotingPeriodById(votingPeriodId: string): Promise<VotingPeriod | null> {
    return await this.votingPeriodRepository.findById(votingPeriodId);
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
    const employeePromises = uniqueEmployeeIds.map(id => this.employeeService.getEmployeeById(id));
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
        const reasons = groupNominations
          .filter(n => n.nominatedEmployeeId === vote.employeeId)
          .map(n => {
            return {
              comment: n.reason,
              username: n.nominatorUserName,
              date: n.createdAt,
              criteria: n.criteria,
            };
          });
        const employee = employeeMap.get(vote.employeeId);
        return {
          votingPeriodId,
          employeeId: vote.employeeId,
          employeeName: employee?.fullName || 'Unknown',
          department: employee?.department || 'Unknown',
          position: employee?.position || 'Unknown',
          nominationCount: vote.count,
          reasons,
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

    const results = {
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

    return results;
  }

  /*   // voting results by employee id and optional voting period id
  async getVotingResultsByEmployee(
    employeeId: string,
    votingPeriodId: string
  ): Promise<VoteResult[]> {
    const results: VoteResult[] = [];
    try {
      const nominations = await this.nominationRepository.findByPeriodAndEmployeeId(
        employeeId,
        votingPeriodId
      );
      if (nominations.length === 0) {
        return [];
      }

      // transform nominations to results
      for (const nomination of nominations) {
        const employee = await this.employeeService.getEmployeeById(nomination.nominatedEmployeeId);
        results.push({
          votingPeriodId,
          employeeId: nomination.nominatedEmployeeId,
          employeeName: employee?.fullName || 'Unknown',
          department: employee?.department || 'Unknown',
          position: employee?.position || 'Unknown',
          nominationCount: 1,
          reasons: nomination ? [nomination.reason] : [],
          percentage: 100,
          rank: 1,
          averageCriteria: nomination.criteria,
        });
      }

      return results;
    } catch (error) {
      console.error('Error fetching nominations:', error);
    }
    return results;
  } */

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

    // Process periods in parallel - Include both ACTIVE and CLOSED periods
    const containerPromises = recentPeriods
      .filter(
        period =>
          period.status === VotingPeriodStatus.ACTIVE ||
          period.status === VotingPeriodStatus.PENDING
      )
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
    updateData: UpdateVotingPeriodDto,
    userContext?: { userId: string; userName: string; userEmail?: string }
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

    const result = await this.votingPeriodRepository.update(votingPeriodId, updatedPeriod);

    // Log audit
    if (this.auditService && userContext) {
      try {
        const changes = this.auditService.detectChanges(period, updatedPeriod);
        await this.auditService.log({
          entityType: AuditEntity.VOTING_PERIOD,
          entityId: votingPeriodId,
          action: AuditAction.UPDATE,
          userId: userContext.userId,
          userName: userContext.userName,
          userEmail: userContext.userEmail,
          changes,
          metadata: {
            year: updatedPeriod.year,
            month: updatedPeriod.month,
            status: updatedPeriod.status,
          },
        });
      } catch (error) {
        console.error('Failed to log audit:', error);
      }
    }

    return result;
  }

  async closeVotingPeriod(
    votingPeriodId: string,
    userContext?: { userId: string; userName: string; userEmail?: string }
  ): Promise<VotingPeriod> {
    const period = await this.votingPeriodRepository.findById(votingPeriodId);
    if (!period) {
      throw new Error('Voting period not found');
    }

    if (period.status === VotingPeriodStatus.CLOSED) {
      throw new Error('Voting period is already closed');
    }

    const oldStatus = period.status;
    period.status = VotingPeriodStatus.CLOSED;
    period.endDate = new Date();

    const result = await this.votingPeriodRepository.update(votingPeriodId, period);

    // Log audit
    if (this.auditService && userContext) {
      try {
        await this.auditService.log({
          entityType: AuditEntity.VOTING_PERIOD,
          entityId: votingPeriodId,
          action: AuditAction.CLOSE,
          userId: userContext.userId,
          userName: userContext.userName,
          userEmail: userContext.userEmail,
          changes: [
            {
              field: 'status',
              oldValue: oldStatus,
              newValue: VotingPeriodStatus.CLOSED,
            },
          ],
          metadata: {
            year: period.year,
            month: period.month,
            closedAt: period.endDate,
          },
        });
      } catch (error) {
        console.error('Failed to log audit:', error);
      }
    }

    return result;
  }

  async resetVotingPeriod(
    votingPeriodId: string,
    userContext?: { userId: string; userName: string; userEmail?: string }
  ): Promise<{
    success: boolean;
    nominationsDeleted: number;
    winnersDeleted: number;
    message: string;
  }> {
    const result = {
      success: false,
      nominationsDeleted: 0,
      winnersDeleted: 0,
      message: '',
    };

    try {
      // 1. Verify voting period exists
      const period = await this.votingPeriodRepository.findById(votingPeriodId);
      if (!period) {
        throw new Error('Voting period not found');
      }

      // 2. Get all nominations for this period
      const nominations = await this.nominationRepository.findByVotingPeriod(votingPeriodId);

      // 3. Delete all nominations
      for (const nomination of nominations) {
        await this.nominationRepository.delete(nomination.id);
        result.nominationsDeleted++;
      }

      // 4. Get all winners for this period
      const winners = await this.winnerHistoryRepository.findByVotingPeriod(votingPeriodId);

      // 5. Delete all winners
      await this.winnerHistoryRepository.deleteByVotingPeriod(votingPeriodId);
      result.winnersDeleted = winners.length;

      // 6. Set period status back to ACTIVE (optional, or keep as is)
      period.status = VotingPeriodStatus.ACTIVE;
      await this.votingPeriodRepository.update(votingPeriodId, period);

      result.success = true;
      result.message = `Successfully reset voting period ${votingPeriodId}. Deleted ${result.nominationsDeleted} nominations and ${result.winnersDeleted} winners.`;

      // 8. Log audit
      if (this.auditService && userContext) {
        try {
          await this.auditService.log({
            entityType: AuditEntity.VOTING_PERIOD,
            entityId: votingPeriodId,
            action: AuditAction.RESET,
            userId: userContext.userId,
            userName: userContext.userName,
            userEmail: userContext.userEmail,
            metadata: {
              year: period.year,
              month: period.month,
              nominationsDeleted: result.nominationsDeleted,
              winnersDeleted: result.winnersDeleted,
            },
          });
        } catch (error) {
          console.error('Failed to log audit:', error);
        }
      }

      return result;
    } catch (error) {
      result.message = error instanceof Error ? error.message : 'Unknown error occurred';
      return result;
    }
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
      id: `winner-${period.year}-${period.month}-general`,
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

  async getWinnerHistoryByYear(year: number, winnerType?: string): Promise<WinnerHistory[]> {
    const allWinners = await this.winnerHistoryRepository.findByYear(year);

    if (!winnerType || winnerType === 'all') {
      return allWinners;
    }

    return allWinners.filter(w => w.winnerType === winnerType);
  }

  async getWinnerHistoryByYearAndMonth(
    year: number,
    month: number,
    winnerType?: string
  ): Promise<WinnerHistory[]> {
    const allWinners = await this.winnerHistoryRepository.findByYearAndMonth(year, month);

    if (!winnerType || winnerType === 'all') {
      return allWinners;
    }

    return allWinners.filter(w => w.winnerType === winnerType);
  }

  async getWinnerByTypeAndPeriod(
    votingPeriodId: string,
    winnerType: 'general' | 'by_group'
  ): Promise<WinnerHistory | WinnerHistory[]> {
    if (winnerType === 'general') {
      // Return only the general winner
      const winner = await this.winnerHistoryRepository.findGeneralWinnerByPeriod(votingPeriodId);
      if (!winner) {
        throw new Error('No general winner found for this voting period');
      }
      return winner;
    } else {
      // Return all group winners
      const winners = await this.winnerHistoryRepository.findGroupWinnersByPeriod(votingPeriodId);
      if (!winners || winners.length === 0) {
        throw new Error('No group winners found for this voting period');
      }
      return winners;
    }
  }

  async getCurrentWinner(): Promise<WinnerHistory | null> {
    // 1. Get all recent voting periods (sorted by most recent first)
    const recentPeriods = await this.votingPeriodRepository.findRecentPeriods();

    if (recentPeriods.length === 0) {
      return null;
    }

    // 2. Find the most recent CLOSED period
    let closedPeriod: VotingPeriod | null = null;
    let recentWinner: WinnerHistory | null = null;

    for (const period of recentPeriods) {
      if (period.status === VotingPeriodStatus.CLOSED) {
        closedPeriod = period;
        recentWinner = await this.winnerHistoryRepository.findGeneralWinnerByPeriod(period.id);
        if (recentWinner) break; // Exit loop if found
      }
    }

    return recentWinner;
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

  async getEmployeeResults(
    employeeId: string,
    votingPeriodId?: string
  ): Promise<NominationWithEmployee[]> {
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

  /**
   * Create bulk nominations for testing purposes
   * @param count Number of nominations to create
   * @returns Summary of created nominations
   */
  async createBulkNominationsForTesting(count: number): Promise<{
    success: boolean;
    created: number;
    failed: number;
    errors: string[];
    nominations: Nomination[];
  }> {
    const result = {
      success: false,
      created: 0,
      failed: 0,
      errors: [] as string[],
      nominations: [] as Nomination[],
    };

    try {
      // Get current voting period
      const currentPeriod = await this.getCurrentVotingPeriod();
      if (!currentPeriod) {
        result.errors.push('No active voting period found');
        return result;
      }

      // Get eligible employees (both nominators and nominees)
      const { employees: allEmployees } = await this.employeeService.getEmployees({
        isActive: true,
      });

      if (allEmployees.length < 2) {
        result.errors.push('Not enough employees to create nominations');
        return result;
      }

      // Create nominations
      for (let i = 0; i < count; i++) {
        try {
          // Random nominator
          const nominator = allEmployees[Math.floor(Math.random() * allEmployees.length)];

          // Random nominee (different from nominator)
          let nominee;
          do {
            nominee = allEmployees[Math.floor(Math.random() * allEmployees.length)];
          } while (nominee.id === nominator.id);

          // Random criteria scores (1-5)
          const criteria: Criteria = {
            communication: Math.floor(Math.random() * 5) + 1,
            innovation: Math.floor(Math.random() * 5) + 1,
            leadership: Math.floor(Math.random() * 5) + 1,
            problemSolving: Math.floor(Math.random() * 5) + 1,
            reliability: Math.floor(Math.random() * 5) + 1,
            teamwork: Math.floor(Math.random() * 5) + 1,
          };

          const reasons = [
            'Outstanding performance and dedication to the team',
            'Excellent problem-solving skills and innovation',
            'Great leadership and mentoring abilities',
            'Exceptional teamwork and collaboration',
            'Consistent reliability and quality work',
            'Strong communication and interpersonal skills',
            'Goes above and beyond to help colleagues',
            'Demonstrates exceptional technical expertise',
            'Shows great initiative and proactive attitude',
            'Maintains positive attitude and motivates others',
          ];

          const nomination: Nomination = {
            id: this.generateId(),
            nominatedEmployeeId: nominee.id,
            nominatorUserName: nominator.fullName || `test-user-${i}`,
            nominatorUserId: nominator.id,
            reason: reasons[Math.floor(Math.random() * reasons.length)],
            criteria,
            votingPeriodId: currentPeriod.id,
            createdAt: new Date(),
          };

          const created = await this.nominationRepository.create(nomination);
          result.nominations.push(created);
          result.created++;
        } catch (error) {
          result.failed++;
          result.errors.push(
            error instanceof Error ? error.message : `Failed to create nomination ${i + 1}`
          );
        }
      }

      result.success = result.created > 0;
      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error occurred');
      return result;
    }
  }

  // Reaction methods
  async addReactionToWinner(
    winnerId: string,
    userId: string,
    userName: string,
    emoji: string
  ): Promise<WinnerHistory> {
    const reaction: Reaction = {
      userId,
      userName,
      emoji,
      timestamp: new Date(),
    };

    return await this.winnerHistoryRepository.addReaction(winnerId, reaction);
  }

  async removeReactionFromWinner(
    winnerId: string,
    userId: string,
    emoji: string
  ): Promise<WinnerHistory> {
    return await this.winnerHistoryRepository.removeReaction(winnerId, userId, emoji);
  }

  async getWinnerReactions(winnerId: string): Promise<Reaction[]> {
    return await this.winnerHistoryRepository.getReactions(winnerId);
  }

  async getVotingPeriodAuditHistory(votingPeriodId: string) {
    if (!this.auditService) {
      return [];
    }

    return await this.auditService.getEntityAuditLogs(AuditEntity.VOTING_PERIOD, votingPeriodId);
  }

  async deleteVotingPeriod(
    votingPeriodId: string,
    userContext?: { userId: string; userName: string; userEmail?: string }
  ): Promise<{ success: boolean; message: string }> {
    const period = await this.votingPeriodRepository.findById(votingPeriodId);
    if (!period) {
      throw new Error('Voting period not found');
    }

    // Get related data for audit log
    const nominations = await this.nominationRepository.findByVotingPeriod(votingPeriodId);
    const winners = await this.winnerHistoryRepository.findByVotingPeriod(votingPeriodId);

    // Delete related data first
    for (const nomination of nominations) {
      await this.nominationRepository.delete(nomination.id);
    }

    await this.winnerHistoryRepository.deleteByVotingPeriod(votingPeriodId);

    // Delete the voting period
    await this.votingPeriodRepository.delete(votingPeriodId);

    // Log audit
    if (this.auditService && userContext) {
      try {
        await this.auditService.log({
          entityType: AuditEntity.VOTING_PERIOD,
          entityId: votingPeriodId,
          action: AuditAction.DELETE,
          userId: userContext.userId,
          userName: userContext.userName,
          userEmail: userContext.userEmail,
          metadata: {
            year: period.year,
            month: period.month,
            status: period.status,
            nominationsDeleted: nominations.length,
            winnersDeleted: winners.length,
          },
        });
      } catch (error) {
        console.error('Failed to log audit:', error);
      }
    }

    return {
      success: true,
      message: `Voting period deleted successfully. Removed ${nominations.length} nominations and ${winners.length} winners.`,
    };
  }

  async createVotingPeriod(
    data: {
      year: number;
      month: number;
      startDate: Date;
      endDate: Date;
      description?: string;
      status?: VotingPeriodStatus;
    },
    userContext?: { userId: string; userName: string; userEmail?: string }
  ): Promise<VotingPeriod> {
    // Validate that no period exists for this year/month combination
    const month = data.month < 10 ? `0${data.month}` : data.month;
    const yearMonth = `${data.year}-${month}`;
    const existingPeriod = await this.votingPeriodRepository.findByYearAndMonth(
      data.year,
      data.month
    );

    if (existingPeriod) {
      throw new Error(`A voting period already exists for ${data.year}-${data.month}`);
    }

    // Create new voting period
    const newPeriod: VotingPeriod = {
      id: `vp-${yearMonth}`,
      year: data.year,
      month: data.month,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status || VotingPeriodStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(data.description && { description: data.description }),
    };

    const createdPeriod = await this.votingPeriodRepository.create(newPeriod);

    // Log audit
    if (this.auditService && userContext) {
      try {
        await this.auditService.log({
          entityType: AuditEntity.VOTING_PERIOD,
          entityId: createdPeriod.id,
          action: AuditAction.CREATE,
          userId: userContext.userId,
          userName: userContext.userName,
          userEmail: userContext.userEmail,
          metadata: {
            year: createdPeriod.year,
            month: createdPeriod.month,
            status: createdPeriod.status,
            startDate: createdPeriod.startDate,
            endDate: createdPeriod.endDate,
          },
        });
      } catch (error) {
        console.error('Failed to log audit:', error);
      }
    }

    return createdPeriod;
  }
}
