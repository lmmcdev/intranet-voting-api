import { VotingPeriodStatus } from '../../../common/models/VotingPeriod';

export interface CreateVotingPeriodDto {
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  description?: string;
  status?: VotingPeriodStatus;
}
