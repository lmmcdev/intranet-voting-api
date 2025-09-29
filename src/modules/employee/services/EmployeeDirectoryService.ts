import fs from 'fs/promises';
import path from 'path';
import { Employee } from '../models/employee.model';

export interface ExternalEmployeeRecord {
  id: number;
  name: string;
  reportsTo?: string;
  jobTitle?: string;
  directReports?: number;
  department?: string;
  location?: string;
}

export interface EmployeeDirectoryMatchResult {
  enrichedEmployees: Employee[];
  matches: number;
  unmatchedAzureEmployees: Employee[];
  unmatchedExternalRecords: ExternalEmployeeRecord[];
}

export class EmployeeDirectoryService {
  private csvPath?: string;
  private recordsCache: ExternalEmployeeRecord[] | null = null;
  private nameIndex: Map<string, ExternalEmployeeRecord[]> | null = null;

  constructor(csvPath?: string) {
    this.csvPath = csvPath;
  }

  setCsvPath(csvPath?: string): void {
    this.csvPath = csvPath;
    this.recordsCache = null;
    this.nameIndex = null;
  }

  async matchEmployees(employees: Employee[]): Promise<EmployeeDirectoryMatchResult> {
    if (employees.length === 0) {
      return {
        enrichedEmployees: [],
        matches: 0,
        unmatchedAzureEmployees: [],
        unmatchedExternalRecords: [],
      };
    }

    const records = await this.loadRecords();
    console.log(`[EmployeeDirectoryService] Loaded ${records.length} records from CSV`);

    // Log first few CSV names for debugging
    console.log('First 5 CSV records after name transformation:');
    records.slice(0, 5).forEach(record => {
      console.log(`  - "${record.name}"`);
    });

    if (records.length === 0) {
      // console.log('[EmployeeDirectoryService] No CSV records found - skipping merge');
      return {
        enrichedEmployees: employees.map(employee => ({ ...employee })),
        matches: 0,
        unmatchedAzureEmployees: employees,
        unmatchedExternalRecords: [],
      };
    }

    const index = await this.buildIndex(records);
    const matchedRecordIds = new Set<number>();
    const enrichedEmployees: Employee[] = [];
    const unmatchedAzureEmployees: Employee[] = [];

    for (const employee of employees) {
      const match = this.findMatchingRecord(employee, index);

      if (!match) {
        /*   console.log(
          `[EmployeeDirectoryService] No CSV match found for Azure employee: "${employee.fullName}" (${employee.email})`
        ); */
        unmatchedAzureEmployees.push(employee);
        enrichedEmployees.push({ ...employee });
        continue;
      }

      /*      console.log(
        `[EmployeeDirectoryService] Matched Azure employee "${employee.fullName}" with CSV record "${match.name}"`
      ); */
      matchedRecordIds.add(match.id);
      enrichedEmployees.push(this.mergeEmployeeWithExternal(employee, match));
    }

    const unmatchedExternalRecords = records.filter(record => !matchedRecordIds.has(record.id));

    /*    console.log(
      `[EmployeeDirectoryService] Matching complete: ${matchedRecordIds.size} matches, ${unmatchedAzureEmployees.length} unmatched Azure employees, ${unmatchedExternalRecords.length} unmatched CSV records`
    ); */

    if (unmatchedExternalRecords.length > 0) {
      console.log('[EmployeeDirectoryService] Unmatched CSV records:');
      unmatchedExternalRecords.slice(0, 10).forEach(record => {
        console.log(`  - "${record.name}"`);
      });
      if (unmatchedExternalRecords.length > 10) {
        console.log(`  ... and ${unmatchedExternalRecords.length - 10} more`);
      }
    }

    // Export analysis CSV files
    await this.exportAnalysisFiles(
      employees,
      records,
      matchedRecordIds,
      unmatchedAzureEmployees,
      unmatchedExternalRecords
    );

    return {
      enrichedEmployees,
      matches: matchedRecordIds.size,
      unmatchedAzureEmployees,
      unmatchedExternalRecords,
    };
  }

  private async loadRecords(): Promise<ExternalEmployeeRecord[]> {
    if (this.recordsCache) {
      return this.recordsCache;
    }

    if (!this.csvPath) {
      return [];
    }

    try {
      const fileContent = await fs.readFile(this.csvPath, 'utf-8');
      const records = this.parseCsv(fileContent);
      this.recordsCache = records;
      return records;
    } catch (error) {
      console.warn(`[EmployeeDirectoryService] Unable to read CSV file at ${this.csvPath}:`, error);
      return [];
    }
  }

  private async buildIndex(
    records: ExternalEmployeeRecord[]
  ): Promise<Map<string, ExternalEmployeeRecord[]>> {
    if (this.nameIndex) {
      return this.nameIndex;
    }

    const index = new Map<string, ExternalEmployeeRecord[]>();

    for (const record of records) {
      const keys = this.generateNameKeys(record.name);

      for (const key of keys) {
        if (!key) {
          continue;
        }
        const existing = index.get(key);
        if (existing) {
          existing.push(record);
        } else {
          index.set(key, [record]);
        }
      }
    }

    this.nameIndex = index;
    return index;
  }

  private findMatchingRecord(
    employee: Employee,
    index: Map<string, ExternalEmployeeRecord[]>
  ): ExternalEmployeeRecord | undefined {
    const employeeName = employee?.fullName || '';
    const candidateKeys = this.generateNameKeys(employeeName);

    // First try exact key matches
    for (const key of candidateKeys) {
      if (!key) {
        continue;
      }

      const matches = index.get(key);
      if (!matches || matches.length === 0) {
        continue;
      }

      if (matches.length === 1) {
        return matches[0];
      }

      const normalizedDepartment = this.normalizeText(employee.department);
      const departmentMatch = matches.find(record => {
        const recordDepartment = this.normalizeText(record.department);
        return (
          !!normalizedDepartment && !!recordDepartment && normalizedDepartment === recordDepartment
        );
      });

      if (departmentMatch) {
        return departmentMatch;
      }

      return matches[0];
    }

    // If no exact match, try partial name matching
    return this.findPartialNameMatch(employeeName, index);
  }

  private findPartialNameMatch(
    employeeName: string,
    index: Map<string, ExternalEmployeeRecord[]>
  ): ExternalEmployeeRecord | undefined {
    const employeeNormalized = this.normalizeText(employeeName);
    const employeeTokens = employeeNormalized.split(' ').filter(Boolean);

    if (employeeTokens.length < 2) {
      return undefined; // Need at least first and last name
    }

    //onsole.log(`[EmployeeDirectoryService] Trying partial match for: "${employeeName}"`);

    // Check all records for partial matches
    for (const [key, records] of index.entries()) {
      for (const record of records) {
        const recordNormalized = this.normalizeText(record.name);
        const recordTokens = recordNormalized.split(' ').filter(Boolean);

        if (recordTokens.length < 2) {
          continue; // Need at least first and last name
        }

        // Check if one name is a subset of the other
        const isSubset =
          this.isNameSubset(employeeTokens, recordTokens) ||
          this.isNameSubset(recordTokens, employeeTokens);

        if (isSubset) {
          console.log(
            `[EmployeeDirectoryService] Partial match found: "${employeeName}" <-> "${record.name}"`
          );
          return record;
        }
      }
    }

    return undefined;
  }

  private isNameSubset(tokens1: string[], tokens2: string[]): boolean {
    // Check if tokens1 is a subset of tokens2
    // For "Marielis Gomez" to match "Marielis Gomez Perez"
    const shorter = tokens1.length <= tokens2.length ? tokens1 : tokens2;
    const longer = tokens1.length <= tokens2.length ? tokens2 : tokens1;

    // All tokens from shorter array must be found in longer array
    return shorter.every(token => longer.includes(token));
  }

  private mergeEmployeeWithExternal(employee: Employee, record: ExternalEmployeeRecord): Employee {
    const directReportsCount =
      typeof record.directReports === 'number' && !Number.isNaN(record.directReports)
        ? record.directReports
        : undefined;

    return {
      ...employee,
      department:
        this.preferCsvValue(record.department, employee.department) ?? employee.department,
      position: this.preferCsvValue(record.jobTitle, employee.position) ?? employee.position,
      location: this.preferCsvValue(record.location, employee.location) ?? employee.location,
      reportsTo: record.reportsTo?.trim() || employee.reportsTo,
      directReportsCount: directReportsCount ?? employee.directReportsCount,
    };
  }

  private preferCsvValue(csvValue?: string, azureValue?: string): string | undefined {
    const cleanedCsvValue = this.cleanValue(csvValue);
    const cleanedAzureValue = this.cleanValue(azureValue);

    // CSV data is primary - use it if available and not empty
    if (cleanedCsvValue && cleanedCsvValue.trim() !== '') {
      return cleanedCsvValue;
    }

    // Fall back to Azure AD data if CSV is empty/missing
    return cleanedAzureValue || undefined;
  }

  private cleanValue(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  }

  private parseCsv(content: string): ExternalEmployeeRecord[] {
    const lines = content
      .split(/\r?\n/)
      .map(line => line.replace(/^\uFEFF/, ''))
      .filter(line => line.trim().length > 0);

    if (lines.length <= 1) {
      return [];
    }

    const headerCells = this.splitCsvLine(lines[0]);
    const headerMap = headerCells.map(cell => this.normalizeHeader(cell));

    const getValue = (cells: string[], key: string): string | undefined => {
      const normalizedKey = this.normalizeHeader(key);
      const index = headerMap.findIndex(header => header === normalizedKey);
      if (index === -1 || index >= cells.length) {
        return undefined;
      }
      return this.cleanValue(cells[index]);
    };

    const records: ExternalEmployeeRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = this.splitCsvLine(lines[i]);
      if (cells.every(cell => this.cleanValue(cell) === undefined)) {
        continue;
      }

      const name = getValue(cells, 'Name');
      if (!name) {
        continue;
      }

      const transformedName = this.transformNameToAzureFormat(name);

      const record: ExternalEmployeeRecord = {
        id: i,
        name: transformedName,
      };

      const reportsTo = getValue(cells, 'Reports To');
      const jobTitle = getValue(cells, 'Job Title');
      const directReportsRaw = getValue(cells, 'Number of Direct Reports');
      const department = getValue(cells, 'Department');
      const location = getValue(cells, 'Location');

      if (reportsTo) {
        record.reportsTo = this.transformNameToAzureFormat(reportsTo);
      }
      if (jobTitle) {
        record.jobTitle = jobTitle;
      }
      if (department) {
        record.department = department;
      }
      if (location) {
        record.location = location;
      }

      if (directReportsRaw) {
        const parsed = parseInt(directReportsRaw, 10);
        if (!Number.isNaN(parsed)) {
          record.directReports = parsed;
        }
      }

      records.push(record);
    }

    return records;
  }

  private transformNameToAzureFormat(name: string): string {
    // Transform "Last, First" format to "First Last" format
    if (name.includes(',')) {
      const parts = name.split(',');
      if (parts.length === 2) {
        const lastName = parts[0].trim();
        const firstName = parts[1].trim();
        const transformedName = `${firstName} ${lastName}`;
        console.log(
          `[EmployeeDirectoryService] Transformed name: "${name}" -> "${transformedName}"`
        );
        return transformedName;
      }
    }

    // Return as-is if not in "Last, First" format
    return name;
  }

  private splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    cells.push(current.trim());
    return cells;
  }

  private normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private generateNameKeys(name: string): string[] {
    const keys = new Set<string>();
    const cleanedName = this.cleanValue(name);

    if (!cleanedName) {
      return [];
    }

    keys.add(this.buildNameKey(cleanedName));

    if (cleanedName.includes(',')) {
      const parts = cleanedName.split(',');
      if (parts.length === 2) {
        const flipped = `${parts[1].trim()} ${parts[0].trim()}`;
        keys.add(this.buildNameKey(flipped));
      }
    }

    return Array.from(keys).filter(key => key.length > 0);
  }

  private buildNameKey(name: string): string {
    const normalized = this.normalizeText(name);
    if (!normalized) {
      return '';
    }
    const tokens = normalized.split(' ').filter(Boolean);
    tokens.sort();
    return tokens.join(' ');
  }

  private normalizeText(value?: string): string {
    if (!value) {
      return '';
    }

    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .join(' ');
  }

  private async exportAnalysisFiles(
    azureEmployees: Employee[],
    csvRecords: ExternalEmployeeRecord[],
    matchedRecordIds: Set<number>,
    unmatchedAzureEmployees: Employee[],
    unmatchedCsvRecords: ExternalEmployeeRecord[]
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputDir = './analysis';

      // Create output directory if it doesn't exist
      try {
        await fs.mkdir(outputDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      // Get all matched employees (those that were enriched)
      const matchedEmployees = azureEmployees.filter((_, index) => {
        // An employee is matched if it's not in the unmatched list
        return !unmatchedAzureEmployees.includes(azureEmployees[index]);
      });

      await this.exportMatchedEmployeesCSV(
        path.join(outputDir, `matched-employees-${timestamp}.csv`),
        matchedEmployees,
        csvRecords,
        matchedRecordIds
      );

      // Export unmatched Azure employees
      await this.exportUnmatchedAzureCSV(
        path.join(outputDir, `unmatched-azure-${timestamp}.csv`),
        unmatchedAzureEmployees
      );

      // Export unmatched CSV records
      await this.exportUnmatchedCSVRecordsCSV(
        path.join(outputDir, `unmatched-csv-${timestamp}.csv`),
        unmatchedCsvRecords
      );

      console.log(`[EmployeeDirectoryService] Analysis CSV files exported to ${outputDir}/`);
      console.log(`  - matched-employees-${timestamp}.csv (${matchedEmployees.length} records)`);
      console.log(
        `  - unmatched-azure-${timestamp}.csv (${unmatchedAzureEmployees.length} records)`
      );
      console.log(`  - unmatched-csv-${timestamp}.csv (${unmatchedCsvRecords.length} records)`);
    } catch (error) {
      console.warn('[EmployeeDirectoryService] Failed to export analysis files:', error);
    }
  }

  private async exportMatchedEmployeesCSV(
    filePath: string,
    employees: Employee[],
    csvRecords: ExternalEmployeeRecord[],
    matchedRecordIds: Set<number>
  ): Promise<void> {
    const headers = [
      'Azure_FullName',
      'Azure_Email',
      'Azure_Department',
      'Azure_Position',
      'Azure_Location',
      'CSV_Name',
      'CSV_Department',
      'CSV_JobTitle',
      'CSV_Location',
      'CSV_ReportsTo',
    ].join(',');

    const rows = [];
    rows.push(headers);

    for (const employee of employees) {
      // Find the matching CSV record
      const matchedRecord = csvRecords.find(record => {
        if (!matchedRecordIds.has(record.id)) return false;
        // Additional check to ensure this employee actually matches this record
        const index = this.nameIndex;
        if (index) {
          const candidateKeys = this.generateNameKeys(employee?.fullName || '');
          for (const key of candidateKeys) {
            const matches = index.get(key);
            if (matches?.some(match => match.id === record.id)) {
              return true;
            }
          }
        }
        return false;
      });

      if (matchedRecord) {
        const row = [
          `"${employee.fullName || ''}"`,
          `"${employee.email || ''}"`,
          `"${employee.department || ''}"`,
          `"${employee.position || ''}"`,
          `"${employee.location || ''}"`,
          `"${matchedRecord.name || ''}"`,
          `"${matchedRecord.department || ''}"`,
          `"${matchedRecord.jobTitle || ''}"`,
          `"${matchedRecord.location || ''}"`,
          `"${matchedRecord.reportsTo || ''}"`,
        ].join(',');
        rows.push(row);
      }
    }

    await fs.writeFile(filePath, rows.join('\n'), 'utf-8');
  }

  private async exportUnmatchedAzureCSV(filePath: string, employees: Employee[]): Promise<void> {
    const headers = ['FullName', 'Email', 'Department', 'Position', 'Location'].join(',');

    const rows = [];
    rows.push(headers);

    employees.forEach(employee => {
      const row = [
        `"${employee.fullName || ''}"`,
        `"${employee.email || ''}"`,
        `"${employee.department || ''}"`,
        `"${employee.position || ''}"`,
        `"${employee.location || ''}"`,
      ].join(',');
      rows.push(row);
    });

    await fs.writeFile(filePath, rows.join('\n'), 'utf-8');
  }

  private async exportUnmatchedCSVRecordsCSV(
    filePath: string,
    records: ExternalEmployeeRecord[]
  ): Promise<void> {
    const headers = [
      'Name',
      'Department',
      'JobTitle',
      'Location',
      'ReportsTo',
      'DirectReports',
    ].join(',');

    const rows = [];
    rows.push(headers);

    records.forEach(record => {
      const row = [
        `"${record.name || ''}"`,
        `"${record.department || ''}"`,
        `"${record.jobTitle || ''}"`,
        `"${record.location || ''}"`,
        `"${record.reportsTo || ''}"`,
        `"${record.directReports || ''}"`,
      ].join(',');
      rows.push(row);
    });

    await fs.writeFile(filePath, rows.join('\n'), 'utf-8');
  }
}
