import { Criteria } from "../../modules/voting/dto/create-nomination.dto";

export interface VoteResult {
  votingPeriodId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  nominationCount: number;
  percentage: number;
  rank: number;
  averageCriteria: Criteria;
}

export interface VotingPeriodResults {
  votingPeriod: {
    id: string;
    year: number;
    month: number;
    status: string;
  };
  totalNominations: number;
  averageVotes: number;
  results: VoteResult[];
  winner?: VoteResult;
}
