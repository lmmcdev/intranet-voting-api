export interface Criteria {
  communication: number;
  innovation: number;
  leadership: number;
  problemSolving: number;
  reliability: number;
  teamwork: number;
}

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

export interface CreateNominationDto {
  nominatedEmployeeId: string;
  nominatorEmail: string;
  reason: string;
  criteria: Criteria;
}

export interface UpdateNominationDto {
  nominatedEmployeeId?: string;
  reason?: string;
  criteria?: Criteria;
}

export interface NominationWithEmployee extends Nomination {
  nominatedEmployee: {
    name: string;
    department: string;
    position: string;
  };
}