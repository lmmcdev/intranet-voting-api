export interface VoteResult {
  votingPeriodId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  nominationCount: number;
  percentage: number;
  rank: number;
}

export interface VotingPeriodResults {
  votingPeriod: {
    id: string;
    year: number;
    month: number;
    status: string;
  };
  totalNominations: number;
  results: VoteResult[];
  winner?: VoteResult;
}