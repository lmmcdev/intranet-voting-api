import { VotingPeriod } from '../../../common/models/VotingPeriod';

export interface SetupResponseDto {
  message: string;
  votingPeriod: VotingPeriod;
  instructions?: {
    [key: string]: string;
  };
}

export interface SetupStatusDto {
  currentVotingPeriod: VotingPeriod | null;
  totalEmployees: number;
  totalNominations: number;
  systemStatus: 'ready' | 'needs_setup' | 'partial';
  recommendations: string[];
}