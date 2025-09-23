export class DateHelper {
  static getMonthStart(year: number, month: number): Date {
    return new Date(year, month - 1, 1);
  }

  static getMonthEnd(year: number, month: number): Date {
    return new Date(year, month, 0, 23, 59, 59, 999);
  }

  static getCurrentMonth(): { year: number; month: number } {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1
    };
  }

  static getNextMonth(): { year: number; month: number } {
    const now = new Date();
    const nextMonth = now.getMonth() + 1;
    
    if (nextMonth === 12) {
      return {
        year: now.getFullYear() + 1,
        month: 1
      };
    }
    
    return {
      year: now.getFullYear(),
      month: nextMonth + 1
    };
  }

  static getPreviousMonth(): { year: number; month: number } {
    const now = new Date();
    const prevMonth = now.getMonth() - 1;
    
    if (prevMonth === -1) {
      return {
        year: now.getFullYear() - 1,
        month: 12
      };
    }
    
    return {
      year: now.getFullYear(),
      month: prevMonth + 1
    };
  }

  static formatMonthYear(year: number, month: number): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[month - 1]} ${year}`;
  }

  static isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
    return date >= startDate && date <= endDate;
  }

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }
}