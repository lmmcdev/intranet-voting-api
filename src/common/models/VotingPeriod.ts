export enum VotingPeriodStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  PENDING = 'pending'
}

export interface VotingPeriod {
  id: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  status: VotingPeriodStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVotingPeriodDto {
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
}