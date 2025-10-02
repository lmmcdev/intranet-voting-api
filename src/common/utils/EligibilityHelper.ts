import { EligibilityConfig } from '../../modules/configuration/models/eligibility-config.model';
import { Employee } from '../../modules/employee/models/employee.model';

export class EligibilityHelper {
  /**
   * Determines if an employee is eligible for voting based on configuration rules
   * @param employee - Employee to check
   * @param config - Eligibility configuration
   * @returns true if employee meets all eligibility criteria
   */
  static isVotingEligible(employee: Employee, config: EligibilityConfig): boolean {
    // Check active status requirement
    if (config.requireActiveStatus && !employee.isActive) {
      return false;
    }

    // Check excluded job titles
    if (employee.jobTitle && config.excludedJobTitles.includes(employee.jobTitle)) {
      return false;
    }

    // Check excluded departments
    if (employee.department && config.excludedDepartments.includes(employee.department)) {
      return false;
    }

    // Check excluded positions
    if (employee.position && config.excludedPositions.includes(employee.position)) {
      return false;
    }

    // Check custom rules
    if (config.customRules) {
      // Check allowed company codes (if specified)
      if (
        config.customRules.allowedCompanyCodes &&
        config.customRules.allowedCompanyCodes.length > 0 &&
        employee.companyCode &&
        !config.customRules.allowedCompanyCodes.includes(employee.companyCode)
      ) {
        return false;
      }

      // Check excluded company codes
      if (
        config.customRules.excludedCompanyCodes &&
        employee.companyCode &&
        config.customRules.excludedCompanyCodes.includes(employee.companyCode)
      ) {
        return false;
      }

      // Check minimum direct reports for exclusion (e.g., exclude managers with X or more reports)
      if (
        config.customRules.minDirectReportsForExclusion !== undefined &&
        employee.directReportsCount !== undefined &&
        employee.directReportsCount >= config.customRules.minDirectReportsForExclusion
      ) {
        return false;
      }
    }

    // Check minimum days of service
    const dateToCheck = employee.rehireDate || employee.hireDate;
    if (!dateToCheck) {
      return false; // No date available, not eligible
    }

    const now = new Date();
    const checkDate = new Date(dateToCheck);
    const daysInMs = config.minimumDaysForEligibility * 24 * 60 * 60 * 1000;
    const timeDiff = now.getTime() - checkDate.getTime();

    return timeDiff >= daysInMs;
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
