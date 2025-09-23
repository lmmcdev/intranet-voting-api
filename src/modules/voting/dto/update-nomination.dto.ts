import { Criteria } from './create-nomination.dto';

export interface UpdateNominationDto {
  nominatedEmployeeId?: string;
  reason?: string;
  criteria?: Criteria;
}