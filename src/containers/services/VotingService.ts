import { Nomination, CreateNominationDto, UpdateNominationDto, NominationWithEmployee, Criteria } from '../models/Nomination';
import { VotingPeriod, VotingPeriodStatus } from '../models/VotingPeriod';
import { VoteResult, VotingPeriodResults } from '../models/VoteResult';
import { NominationRepository } from '../repositories/NominationRepository';
import { VotingPeriodRepository } from '../repositories/VotingPeriodRepository';
import { AzureEmployeeService } from './AzureEmployeeService';
import { ValidationService } from './ValidationService';

export class VotingService {
  private nominationRepository: NominationRepository;
  private votingPeriodRepository: VotingPeriodRepository;
  private azureEmployeeService: AzureEmployeeService;
  private validationService: ValidationService;

  constructor(
    nominationRepository: NominationRepository,
    votingPeriodRepository: VotingPeriodRepository,
    azureEmployeeService: AzureEmployeeService,
    validationService: ValidationService
  ) {
    this.nominationRepository = nominationRepository;
    this.votingPeriodRepository = votingPeriodRepository;
    this.azureEmployeeService = azureEmployeeService;
    this.validationService = validationService;
  }

  async createNomination(nominationData: CreateNominationDto): Promise<Nomination> {
    const currentPeriod = await this.getCurrentVotingPeriod();
    if (!currentPeriod) {
      throw new Error('No active voting period found');
    }

    await this.validationService.validateNomination(nominationData, currentPeriod.id);

    const nomination: Nomination = {
      id: this.generateId(),
      ...nominationData,
      votingPeriodId: currentPeriod.id,
      createdAt: new Date()
    };

    return await this.nominationRepository.create(nomination);
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
      const employee = await this.azureEmployeeService.getEmployeeById(nomination.nominatedEmployeeId);

      nominationsWithEmployee.push({
        ...nomination,
        nominatedEmployee: {
          name: employee?.name || 'Unknown Employee',
          department: employee?.department || 'Unknown',
          position: employee?.position || 'Unknown'
        }
      });
    }

    return nominationsWithEmployee;
  }

  async getVotingResults(votingPeriodId: string): Promise<VotingPeriodResults> {
    const votingPeriod = await this.votingPeriodRepository.findById(votingPeriodId);
    if (!votingPeriod) {
      throw new Error('Voting period not found');
    }

    const nominations = await this.nominationRepository.findByVotingPeriod(votingPeriodId);
    const employeeVotes = this.aggregateVotes(nominations);
    const totalNominations = nominations.length;

    const results: VoteResult[] = await Promise.all(
      employeeVotes.map(async (vote, index) => {
        const employee = await this.azureEmployeeService.getEmployeeById(vote.employeeId);
        return {
          votingPeriodId,
          employeeId: vote.employeeId,
          employeeName: employee?.name || 'Unknown',
          department: employee?.department || 'Unknown',
          position: employee?.position || 'Unknown',
          nominationCount: vote.count,
          percentage: (vote.count / totalNominations) * 100,
          rank: index + 1,
          averageCriteria: vote.averageCriteria
        };
      })
    );

    return {
      votingPeriod: {
        id: votingPeriod.id,
        year: votingPeriod.year,
        month: votingPeriod.month,
        status: votingPeriod.status
      },
      totalNominations,
      results,
      winner: results[0]
    };
  }

  private aggregateVotes(nominations: Nomination[]): { employeeId: string; count: number; averageCriteria: Criteria }[] {
    const voteMap = new Map<string, { count: number, totalCriteria: Criteria }>();

    nominations.forEach(nomination => {
      const current = voteMap.get(nomination.nominatedEmployeeId) || {
        count: 0,
        totalCriteria: {
          communication: 0,
          innovation: 0,
          leadership: 0,
          problemSolving: 0,
          reliability: 0,
          teamwork: 0
        }
      };

      voteMap.set(nomination.nominatedEmployeeId, {
        count: current.count + 1,
        totalCriteria: {
          communication: current.totalCriteria.communication + nomination.criteria.communication,
          innovation: current.totalCriteria.innovation + nomination.criteria.innovation,
          leadership: current.totalCriteria.leadership + nomination.criteria.leadership,
          problemSolving: current.totalCriteria.problemSolving + nomination.criteria.problemSolving,
          reliability: current.totalCriteria.reliability + nomination.criteria.reliability,
          teamwork: current.totalCriteria.teamwork + nomination.criteria.teamwork
        }
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
          teamwork: Math.round((data.totalCriteria.teamwork / data.count) * 10) / 10
        }
      }))
      .sort((a, b) => b.count - a.count);
  }

  async updateNomination(nominatorEmail: string, updateData: UpdateNominationDto): Promise<Nomination> {
    const currentPeriod = await this.getCurrentVotingPeriod();
    if (!currentPeriod) {
      throw new Error('No active voting period found');
    }

    // Find existing nomination by nominator email and current voting period
    const existingNomination = await this.nominationRepository.findByNominatorEmail(nominatorEmail, currentPeriod.id);
    if (!existingNomination) {
      throw new Error('No existing nomination found to update');
    }

    // Validate the updated data if provided
    if (updateData.nominatedEmployeeId) {
      await this.validationService.validateEmployee(updateData.nominatedEmployeeId);
      
      // Check for self-nomination
      const updateNominationData: CreateNominationDto = {
        nominatedEmployeeId: updateData.nominatedEmployeeId,
        nominatorEmail: nominatorEmail,
        reason: updateData.reason || existingNomination.reason,
        criteria: updateData.criteria || existingNomination.criteria
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
      updatedAt: new Date()
    };

    return await this.nominationRepository.update(existingNomination.id, updatedNomination);
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}