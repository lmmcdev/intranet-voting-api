import { Criteria } from '../../modules/voting/dto/create-nomination.dto';

export interface Nomination {
  id: string;
  nominatedEmployeeId: string;
  nominatorEmail: string;
  votingPeriodId: string;
  reason: string;
  criteria: Criteria;
  createdAt: Date;
  updatedAt?: Date;
}

export interface NominationWithEmployee extends Nomination {
  nominatedEmployee: {
    fullName: string;
    department: string;
    position: string;
  };
}
