export interface Nomination {
  id: string;
  nominatedEmployeeId: string;
  nominatorEmail: string;
  votingPeriodId: string;
  reason: string;
  createdAt: Date;
}

export interface CreateNominationDto {
  nominatedEmployeeId: string;
  nominatorEmail: string;
  reason: string;
}

export interface NominationWithEmployee extends Nomination {
  nominatedEmployee: {
    name: string;
    department: string;
    position: string;
  };
}