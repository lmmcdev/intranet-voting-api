export interface Criteria {
  communication: number;
  innovation: number;
  leadership: number;
  problemSolving: number;
  reliability: number;
  teamwork: number;
}

export interface CreateNominationDto {
  nominatedEmployeeId: string;
  nominatorUserName?: string;
  nominatorUserId?: string;
  reason: string;
  criteria: Criteria;
}
