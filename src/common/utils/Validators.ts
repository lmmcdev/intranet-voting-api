export class Validators {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidId(id: string): boolean {
    return typeof id === 'string' && id.trim().length > 0;
  }

  static isValidString(value: string, minLength: number = 1, maxLength: number = 1000): boolean {
    return typeof value === 'string' && 
           value.trim().length >= minLength && 
           value.trim().length <= maxLength;
  }

  static isValidNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value);
  }

  static isValidYear(year: number): boolean {
    const currentYear = new Date().getFullYear();
    return year >= 2020 && year <= currentYear + 1;
  }

  static isValidMonth(month: number): boolean {
    return month >= 1 && month <= 12;
  }

  static isValidDate(date: any): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  static sanitizeString(value: string): string {
    return value.trim().replace(/[<>\"']/g, '');
  }

  static isValidDepartment(department: string): boolean {
    const validDepartments = [
      'Engineering',
      'Sales',
      'Marketing',
      'HR',
      'Finance',
      'Operations',
      'Customer Support',
      'Product',
      'Design',
      'Legal'
    ];
    return validDepartments.includes(department);
  }

  static isCompanyEmail(email: string): boolean {
    const companyDomain = process.env.COMPANY_EMAIL_DOMAIN || 'company.com';
    return email.endsWith(`@${companyDomain}`);
  }
}