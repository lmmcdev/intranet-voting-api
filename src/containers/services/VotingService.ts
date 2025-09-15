import { Nomination, CreateNominationDto, UpdateNominationDto, NominationWithEmployee } from '../models/Nomination';
import { VotingPeriod, VotingPeriodStatus } from '../models/VotingPeriod';
import { VoteResult, VotingPeriodResults } from '../models/VoteResult';
import { NominationRepository } from '../repositories/NominationRepository';
import { VotingPeriodRepository } from '../repositories/VotingPeriodRepository';
import { EmployeeRepository } from '../repositories/EmployeeRepository';
import { ValidationService } from './ValidationService';

export class VotingService {
  private nominationRepository: NominationRepository;
  private votingPeriodRepository: VotingPeriodRepository;
  private employeeRepository: EmployeeRepository;
  private validationService: ValidationService;

  constructor(
    nominationRepository: NominationRepository,
    votingPeriodRepository: VotingPeriodRepository,
    employeeRepository: EmployeeRepository,
    validationService: ValidationService
  ) {
    this.nominationRepository = nominationRepository;
    this.votingPeriodRepository = votingPeriodRepository;
    this.employeeRepository = employeeRepository;
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

    return await this.nominationRepository.findByVotingPeriodWithEmployee(currentPeriod.id);
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
        const employee = await this.employeeRepository.findById(vote.employeeId);
        return {
          votingPeriodId,
          employeeId: vote.employeeId,
          employeeName: employee?.name || 'Unknown',
          department: employee?.department || 'Unknown',
          position: employee?.position || 'Unknown',
          nominationCount: vote.count,
          percentage: (vote.count / totalNominations) * 100,
          rank: index + 1
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

  private aggregateVotes(nominations: Nomination[]): { employeeId: string; count: number }[] {
    const voteMap = new Map<string, number>();
    
    nominations.forEach(nomination => {
      const currentCount = voteMap.get(nomination.nominatedEmployeeId) || 0;
      voteMap.set(nomination.nominatedEmployeeId, currentCount + 1);
    });

    return Array.from(voteMap.entries())
      .map(([employeeId, count]) => ({ employeeId, count }))
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
        reason: updateData.reason || existingNomination.reason
      };
      await this.validationService.validateSelfNomination(updateNominationData);
    }

    if (updateData.reason) {
      await this.validationService.validateNominationReason(updateData.reason);
    }

    // Update the nomination
    const updatedNomination: Nomination = {
      ...existingNomination,
      nominatedEmployeeId: updateData.nominatedEmployeeId || existingNomination.nominatedEmployeeId,
      reason: updateData.reason || existingNomination.reason,
      updatedAt: new Date()
    };

    return await this.nominationRepository.update(existingNomination.id, updatedNomination);
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}