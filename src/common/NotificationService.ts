import { VoteResult } from './models/VoteResult';
import { VotingPeriod } from './models/VotingPeriod';

export interface NotificationMessage {
  to: string;
  subject: string;
  body: string;
  type: 'email' | 'teams' | 'slack';
}

export class NotificationService {
  async sendVotingOpenNotification(votingPeriod: VotingPeriod): Promise<void> {
    const message: NotificationMessage = {
      to: 'all@company.com',
      subject: `Voting Now Open - Employee of the Month ${this.getMonthName(votingPeriod.month)} ${votingPeriod.year}`,
      body: `
        The voting period for Employee of the Month is now open!
        
        Period: ${this.getMonthName(votingPeriod.month)} ${votingPeriod.year}
        Voting closes: ${votingPeriod.endDate.toLocaleDateString()}
        
        Please submit your nominations through the company portal.
      `,
      type: 'email',
    };

    await this.sendNotification(message);
  }

  async sendVotingCloseNotification(votingPeriod: VotingPeriod): Promise<void> {
    const message: NotificationMessage = {
      to: 'all@company.com',
      subject: `Voting Closed - Employee of the Month ${this.getMonthName(votingPeriod.month)} ${votingPeriod.year}`,
      body: `
        The voting period for Employee of the Month has closed.
        
        Period: ${this.getMonthName(votingPeriod.month)} ${votingPeriod.year}
        Results will be announced soon.
      `,
      type: 'email',
    };

    await this.sendNotification(message);
  }

  async sendWinnerAnnouncement(winner: VoteResult, votingPeriod: VotingPeriod): Promise<void> {
    const message: NotificationMessage = {
      to: 'all@company.com',
      subject: `🎉 Employee of the Month Winner - ${this.getMonthName(votingPeriod.month)} ${votingPeriod.year}`,
      body: `
        Congratulations to our Employee of the Month!

        Winner: ${winner.employeeName}
        Department: ${winner.department}
        Position: ${winner.position}
        Votes: ${winner.nominationCount} (${winner.percentage.toFixed(1)}%)

        Thank you to everyone who participated in the voting!
      `,
      type: 'email',
    };

    await this.sendNotification(message);
  }

  async sendNominationNotification(
    nominatorEmail: string,
    nominatedEmployeeName: string,
    nominatedEmployeeDepartment: string,
    votingPeriod: VotingPeriod,
    reason: string
  ): Promise<void> {
    const message: NotificationMessage = {
      to: nominatorEmail,
      subject: `Nomination Submitted - Employee of the Month ${this.getMonthName(votingPeriod.month)} ${votingPeriod.year}`,
      body: `
        Your nomination has been successfully submitted!

        Nominated Employee: ${nominatedEmployeeName}
        Department: ${nominatedEmployeeDepartment}
        Voting Period: ${this.getMonthName(votingPeriod.month)} ${votingPeriod.year}
        Reason: ${reason}

        Thank you for participating in our Employee of the Month program!
      `,
      type: 'email',
    };

    await this.sendNotification(message);
  }

  private async sendNotification(message: NotificationMessage): Promise<void> {
    console.log('Sending notification:', message);
  }

  private getMonthName(month: number): string {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return monthNames[month - 1];
  }
}
