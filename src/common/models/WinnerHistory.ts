import { Criteria } from '../../modules/voting/dto/create-nomination.dto';

export enum WinnerType {
  GENERAL = 'general', // Ganador único del período (seleccionado aleatoriamente)
  BY_GROUP = 'by_group', // Ganador por grupo/departamento
}

export interface WinnerHistory {
  id: string;
  votingPeriodId: string;
  year: number;
  month: number;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  nominationCount: number;
  percentage: number;
  rank: number;
  averageCriteria: Criteria;
  votingGroup?: string;
  winnerType: WinnerType; // Tipo de ganador
  isYearlyWinner?: boolean; // Marca si es el ganador del año
  createdAt: Date;
}
