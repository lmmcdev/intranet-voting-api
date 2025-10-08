import { VotingPeriodStatus } from '../../../common/models/VotingPeriod';

export interface UpdateVotingPeriodDto {
  year?: number;
  month?: number;
  startDate?: Date;
  endDate?: Date;
  status?: VotingPeriodStatus;
  description?: string;
}
