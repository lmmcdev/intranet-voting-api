export class EligibilityHelper {
  /**
   * Determines if an employee is eligible for voting based on their hire/rehire date
   * @param hireDate - Original hire date
   * @param rehireDate - Rehire date (takes priority if present)
   * @returns true if employee has been with company for more than 1 year
   */
  static isVotingEligible(hireDate?: Date, rehireDate?: Date, jobTitle?: string): boolean {
    // Use rehireDate if available, otherwise use hireDate
    const dateToCheck = rehireDate || hireDate;

    if (!dateToCheck) {
      return false; // No date available, not eligible
    }

    // Calculate time difference in milliseconds
    const now = new Date();
    const checkDate = new Date(dateToCheck);
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
    const timeDiff = now.getTime() - checkDate.getTime();

    // Employee must have more than 1 year of service
    return timeDiff > oneYearInMs;
  }

  /**
   * Calculates years of service for an employee
   * @param hireDate - Original hire date
   * @param rehireDate - Rehire date (takes priority if present)
   * @returns Number of years of service (rounded down)
   */
  static getYearsOfService(hireDate?: Date, rehireDate?: Date): number {
    const dateToCheck = rehireDate || hireDate;

    if (!dateToCheck) {
      return 0;
    }

    const now = new Date();
    const checkDate = new Date(dateToCheck);
    const timeDiff = now.getTime() - checkDate.getTime();
    const yearsOfService = timeDiff / (365 * 24 * 60 * 60 * 1000);

    return Math.floor(yearsOfService);
  }
}
