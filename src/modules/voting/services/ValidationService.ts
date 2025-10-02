import { CreateNominationDto, Criteria } from '../dto/create-nomination.dto';
import { Employee } from '../../employee/models/employee.model';
import { NominationRepository } from '../repositories/NominationRepository';
import { EmployeeRepository } from '../../employee/repositories/EmployeeRepository';

export class ValidationService {
  private nominationRepository: NominationRepository;
  private employeeRepository: EmployeeRepository;

  constructor(nominationRepository: NominationRepository, employeeRepository: EmployeeRepository) {
    this.nominationRepository = nominationRepository;
    this.employeeRepository = employeeRepository;
  }

  async validateNomination(
    nominationData: CreateNominationDto,
    votingPeriodId: string
  ): Promise<void> {
    await this.validateEmployee(nominationData.nominatedEmployeeId);
    await this.validateNominator(nominationData.nominatorEmail);
    await this.validateNominationReason(nominationData.reason);
    this.validateCriteria(nominationData.criteria);
    await this.validateDuplicateNomination(nominationData, votingPeriodId);
    await this.validateSelfNomination(nominationData);
  }

  async validateEmployee(employeeId: string): Promise<void> {
    const employee = await this.employeeRepository.findById(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }
    if (!employee.isActive) {
      throw new Error('Cannot nominate inactive employee');
    }
  }

  private async validateNominator(nominatorEmail: string): Promise<void> {
    if (!this.isValidEmail(nominatorEmail)) {
      throw new Error('Invalid nominator email format');
    }
    // validate nominator and nominated are on the same votingGroup
    // Skip nominator validation when SKIP_AUTH is enabled (for development)
    if (process.env.SKIP_AUTH === 'true') {
      return; // Allow any email in development
    }

    const nominator = await this.employeeRepository.findByEmail(nominatorEmail);
    if (!nominator) {
      throw new Error('Nominator must be an active employee');
    }
    if (!nominator.isActive) {
      throw new Error('Inactive employees cannot make nominations');
    }
  }

  async validateNominationReason(reason: string): Promise<void> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Nomination reason is required');
    }
    if (reason.length < 10) {
      throw new Error('Nomination reason must be at least 10 characters long');
    }
    if (reason.length > 500) {
      throw new Error('Nomination reason must not exceed 500 characters');
    }
  }

  validateCriteria(criteria: Criteria): void {
    if (!criteria) {
      throw new Error('Criteria scoring is required');
    }

    const requiredFields = [
      'communication',
      'innovation',
      'leadership',
      'problemSolving',
      'reliability',
      'teamwork',
    ];
    const scores = [
      criteria.communication,
      criteria.innovation,
      criteria.leadership,
      criteria.problemSolving,
      criteria.reliability,
      criteria.teamwork,
    ];

    for (let i = 0; i < requiredFields.length; i++) {
      const field = requiredFields[i];
      const score = scores[i];

      if (score === undefined || score === null) {
        throw new Error(`${field} score is required`);
      }
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new Error(`${field} score must be an integer between 1 and 5`);
      }
    }
  }

  private async validateDuplicateNomination(
    nominationData: CreateNominationDto,
    votingPeriodId: string
  ): Promise<void> {
    const existingNomination = await this.nominationRepository.findByNominatorAndPeriod(
      nominationData.nominatorEmail,
      votingPeriodId
    );
    if (existingNomination) {
      throw new Error('You can only make one nomination per voting period');
    }
  }

  async validateSelfNomination(nominationData: CreateNominationDto): Promise<void> {
    const nominatedEmployee = await this.employeeRepository.findById(
      nominationData.nominatedEmployeeId
    );
    if (nominatedEmployee && nominatedEmployee.email === nominationData.nominatorEmail) {
      throw new Error('No puedes nominarte a ti mismo / Self-nomination is not allowed');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
