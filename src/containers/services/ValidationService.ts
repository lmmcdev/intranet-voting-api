import { CreateNominationDto } from '../models/Nomination';
import { Employee } from '../models/Employee';
import { NominationRepository } from '../repositories/NominationRepository';
import { EmployeeRepository } from '../repositories/EmployeeRepository';

export class ValidationService {
  private nominationRepository: NominationRepository;
  private employeeRepository: EmployeeRepository;

  constructor(nominationRepository: NominationRepository, employeeRepository: EmployeeRepository) {
    this.nominationRepository = nominationRepository;
    this.employeeRepository = employeeRepository;
  }

  async validateNomination(nominationData: CreateNominationDto, votingPeriodId: string): Promise<void> {
    await this.validateEmployee(nominationData.nominatedEmployeeId);
    await this.validateNominator(nominationData.nominatorEmail);
    await this.validateNominationReason(nominationData.reason);
    await this.validateDuplicateNomination(nominationData, votingPeriodId);
    this.validateSelfNomination(nominationData);
  }

  private async validateEmployee(employeeId: string): Promise<void> {
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

    const nominator = await this.employeeRepository.findByEmail(nominatorEmail);
    if (!nominator) {
      throw new Error('Nominator must be an active employee');
    }
    if (!nominator.isActive) {
      throw new Error('Inactive employees cannot make nominations');
    }
  }

  private validateNominationReason(reason: string): void {
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

  private async validateDuplicateNomination(nominationData: CreateNominationDto, votingPeriodId: string): Promise<void> {
    const existingNomination = await this.nominationRepository.findByNominatorAndPeriod(
      nominationData.nominatorEmail,
      votingPeriodId
    );
    if (existingNomination) {
      throw new Error('You can only make one nomination per voting period');
    }
  }

  private async validateSelfNomination(nominationData: CreateNominationDto): Promise<void> {
    const nominatedEmployee = await this.employeeRepository.findById(nominationData.nominatedEmployeeId);
    if (nominatedEmployee && nominatedEmployee.email === nominationData.nominatorEmail) {
      throw new Error('Self-nomination is not allowed');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}