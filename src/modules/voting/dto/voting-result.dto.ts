export interface VotingResultDto {
  nominatedEmployeeId: string;
  employeeName: string;
  department: string;
  position: string;
  totalScore: number;
  averageScore: number;
  nominationCount: number;
  criteria: {
    communication: number;
    innovation: number;
    leadership: number;
    problemSolving: number;
    reliability: number;
    teamwork: number;
  };
}