import fs from 'fs/promises';
import path from 'path';
import { Employee } from '../models/employee.model';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';
import { EligibilityHelper } from '../../../common/utils/EligibilityHelper';
import { EligibilityConfig, DEFAULT_ELIGIBILITY_CONFIG } from '../../configuration/models/eligibility-config.model';

export interface ExternalEmployeeRecord {
  id: number;
  name: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  positionId?: string;
  companyCode?: string;
  jobTitle?: string;
  homeDepartment?: string;
  department?: string;
  location?: string;
  positionStatus?: string;
  hireDate?: Date;
  rehireDate?: Date;
  reportsTo?: string;
  directReports?: number;
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
  private eligibilityConfig: EligibilityConfig;

  constructor(csvPath?: string, eligibilityConfig?: EligibilityConfig) {
    this.csvPath = csvPath;
    this.eligibilityConfig = eligibilityConfig || DEFAULT_ELIGIBILITY_CONFIG;
  }

  setCsvPath(csvPath?: string): void {
    this.csvPath = csvPath;
    this.recordsCache = null;
    this.nameIndex = null;
  }

  async loadCsvAsEmployees(): Promise<Employee[]> {
    const records = await this.loadRecords();

    if (records.length === 0) {
      return [];
    }

    const employees: Employee[] = records.map(record => {
      const isActive = record.positionStatus === 'A - Active' || record.positionStatus === 'A';

      // Build employee object first for eligibility check
      const employee: Employee = {
        id: record.positionId || randomUUID(),
        fullName: record.name,
        firstName: record.firstName,
        lastName: record.lastName,
        middleName: record.middleName,
        email: '', // Excel doesn't have email, will be filled by Azure AD
        department: record.homeDepartment || '',
        position: record.jobTitle || '',
        positionId: record.positionId,
        companyCode: record.companyCode,
        jobTitle: record.jobTitle,
        location: record.location,
        positionStatus: record.positionStatus,
        hireDate: record.hireDate,
        rehireDate: record.rehireDate,
        reportsTo: record.reportsTo,
        directReportsCount: record.directReports,
        isActive,
        votingEligible: false, // Will be calculated below
        source: 'adp' as const,
        roles: ['user'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Calculate eligibility using configuration
      employee.votingEligible = EligibilityHelper.isVotingEligible(employee, this.eligibilityConfig);

      return employee;
    });

    return employees;
  }

  async enrichCsvEmployeesWithAzure(
    csvEmployees: Employee[],
    azureEmployees: Employee[]
  ): Promise<EmployeeDirectoryMatchResult> {
    if (csvEmployees.length === 0) {
      console.log('[EmployeeDirectoryService] No CSV employees to enrich');
      return {
        enrichedEmployees: [],
        matches: 0,
        unmatchedAzureEmployees: azureEmployees,
        unmatchedExternalRecords: [],
      };
    }

    if (azureEmployees.length === 0) {
      console.log('[EmployeeDirectoryService] No Azure employees available for enrichment');
      return {
        enrichedEmployees: csvEmployees.map(emp => ({ ...emp })),
        matches: 0,
        unmatchedAzureEmployees: [],
        unmatchedExternalRecords: [],
      };
    }

    console.log(
      `[EmployeeDirectoryService] Enriching ${csvEmployees.length} CSV employees with ${azureEmployees.length} Azure AD employees`
    );

    // Build index of Azure employees by name
    const azureIndex = new Map<string, Employee[]>();
    for (const azureEmp of azureEmployees) {
      const keys = this.generateNameKeys(azureEmp?.fullName || '');
      for (const key of keys) {
        if (!key) continue;
        const existing = azureIndex.get(key);
        if (existing) {
          existing.push(azureEmp);
        } else {
          azureIndex.set(key, [azureEmp]);
        }
      }
    }

    const matchedAzureIds = new Set<string>();
    const enrichedEmployees: Employee[] = [];
    const unmatchedCsvEmployees: Employee[] = [];

    for (const csvEmployee of csvEmployees) {
      const azureMatch = this.findMatchingAzureEmployee(csvEmployee, azureIndex);

      if (!azureMatch) {
        unmatchedCsvEmployees.push(csvEmployee);
        enrichedEmployees.push({ ...csvEmployee });
        continue;
      }

      matchedAzureIds.add(azureMatch.id);
      enrichedEmployees.push(this.mergeCsvWithAzure(csvEmployee, azureMatch));
    }

    const unmatchedAzureEmployees = azureEmployees.filter(emp => !matchedAzureIds.has(emp.id));

    console.log(
      `[EmployeeDirectoryService] Enrichment complete: ${matchedAzureIds.size} matches, ${unmatchedCsvEmployees.length} unmatched CSV employees, ${unmatchedAzureEmployees.length} unmatched Azure employees`
    );

    return {
      enrichedEmployees,
      matches: matchedAzureIds.size,
      unmatchedAzureEmployees,
      unmatchedExternalRecords: [], // Not used in this flow
    };
  }

  private findMatchingAzureEmployee(
    csvEmployee: Employee,
    azureIndex: Map<string, Employee[]>
  ): Employee | undefined {
    const csvName = csvEmployee?.fullName || '';
    const candidateKeys = this.generateNameKeys(csvName);

    // Try exact key matches
    for (const key of candidateKeys) {
      if (!key) continue;

      const matches = azureIndex.get(key);
      if (!matches || matches.length === 0) continue;

      if (matches.length === 1) {
        return matches[0];
      }

      // If multiple matches, try to match by department
      const normalizedDepartment = this.normalizeText(csvEmployee.department);
      const departmentMatch = matches.find(azureEmp => {
        const azureDepartment = this.normalizeText(azureEmp.department);
        return (
          !!normalizedDepartment && !!azureDepartment && normalizedDepartment === azureDepartment
        );
      });

      if (departmentMatch) {
        return departmentMatch;
      }

      return matches[0];
    }

    // Try partial name matching
    return this.findPartialAzureMatch(csvName, azureIndex);
  }

  private findPartialAzureMatch(
    csvName: string,
    azureIndex: Map<string, Employee[]>
  ): Employee | undefined {
    const csvNormalized = this.normalizeText(csvName);
    const csvTokens = csvNormalized.split(' ').filter(Boolean);

    if (csvTokens.length < 2) {
      return undefined;
    }

    for (const [, azureEmployees] of azureIndex.entries()) {
      for (const azureEmp of azureEmployees) {
        const azureNormalized = this.normalizeText(azureEmp?.fullName || '');
        const azureTokens = azureNormalized.split(' ').filter(Boolean);

        if (azureTokens.length < 2) continue;

        const isSubset =
          this.isNameSubset(csvTokens, azureTokens) || this.isNameSubset(azureTokens, csvTokens);

        if (isSubset) {
          return azureEmp;
        }
      }
    }

    return undefined;
  }

  private mergeCsvWithAzure(csvEmployee: Employee, azureEmployee: Employee): Employee {
    // Azure AD data takes priority for email and id, CSV data for everything else
    return {
      ...csvEmployee,
      id: azureEmployee.id, // Use Azure AD ID
      email: azureEmployee.email, // Use Azure AD email
      // Keep CSV data for other fields, but use Azure AD as fallback if CSV is empty
      department: csvEmployee.department || azureEmployee.department,
      position: csvEmployee.position || azureEmployee.position,
      location: csvEmployee.location || azureEmployee.location,
      reportsTo: csvEmployee.reportsTo || azureEmployee.reportsTo,
      directReportsCount: csvEmployee.directReportsCount ?? azureEmployee.directReportsCount,
      source: 'adp' as const, // This employee exists in both sources
      roles: azureEmployee.roles || csvEmployee.roles || ['user'],
    };
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
      const fileExtension = path.extname(this.csvPath).toLowerCase();

      let records: ExternalEmployeeRecord[];
      if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        // Parse Excel file
        const buffer = await fs.readFile(this.csvPath);
        records = this.parseExcel(buffer);
      } else {
        // Parse CSV file (legacy support)
        const fileContent = await fs.readFile(this.csvPath, 'utf-8');
        records = this.parseCsv(fileContent);
      }

      this.recordsCache = records;
      return records;
    } catch (error) {
      console.warn(`[EmployeeDirectoryService] Unable to read file at ${this.csvPath}:`, error);
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

    const isActive = record.positionStatus
      ? record.positionStatus === 'A - Active' || record.positionStatus === 'A'
      : employee.isActive;

    const hireDate = record.hireDate || employee.hireDate;
    const rehireDate = record.rehireDate || employee.rehireDate;

    const mergedEmployee: Employee = {
      ...employee,
      firstName: record.firstName || employee.firstName,
      lastName: record.lastName || employee.lastName,
      middleName: record.middleName || employee.middleName,
      department:
        this.preferCsvValue(record.department, employee.department) ?? employee.department,
      position: this.preferCsvValue(record.jobTitle, employee.position) ?? employee.position,
      positionId: record.positionId || employee.positionId,
      companyCode: record.companyCode || employee.companyCode,
      jobTitle: record.jobTitle || employee.jobTitle,
      homeDepartment: record.homeDepartment || employee.homeDepartment,
      location: this.preferCsvValue(record.location, employee.location) ?? employee.location,
      positionStatus: record.positionStatus || employee.positionStatus,
      hireDate,
      rehireDate,
      reportsTo: record.reportsTo?.trim() || employee.reportsTo,
      directReportsCount: directReportsCount ?? employee.directReportsCount,
      isActive,
      votingEligible: false, // Will be calculated below
    };

    // Calculate eligibility using configuration
    mergedEmployee.votingEligible = EligibilityHelper.isVotingEligible(mergedEmployee, this.eligibilityConfig);

    return mergedEmployee;
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

  private parseExcel(buffer: Buffer): ExternalEmployeeRecord[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert sheet to JSON
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

      if (jsonData.length === 0) {
        return [];
      }

      const records: ExternalEmployeeRecord[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        // Extract fields based on the ADP Excel structure
        const lastName = this.cleanValue(row['LEGAL LAST NAME']);
        const firstName = this.cleanValue(row['LEGAL FIRST NAME']);
        const middleName = this.cleanValue(row['LEGAL MIDDLE NAME']);

        if (!lastName || !firstName) {
          continue; // Skip rows without valid name
        }

        // Build full name
        const fullName = middleName
          ? `${firstName} ${middleName} ${lastName}`
          : `${firstName} ${lastName}`;

        // Parse job title to extract position and department
        const jobTitleRaw = this.cleanValue(row['JOB TITLE']);
        const { position, code } = this.parseJobTitle(jobTitleRaw);

        const homeDepartmentRaw = this.cleanValue(row['HOME DEPARTMENT']);
        const { department, departmentCode } = this.parseDepartment(homeDepartmentRaw);

        // Parse dates
        const hireDate = this.parseDate(row['HIRE DATE']);
        const rehireDate = this.parseDate(row['REHIRE DATE']);

        const record: ExternalEmployeeRecord = {
          id: i + 1,
          name: fullName,
          firstName,
          lastName,
          middleName,
          positionId: this.cleanValue(row['POSITION ID']),
          companyCode: this.cleanValue(row['COMPANY CODE']),
          jobTitle: position,
          homeDepartment: department,
          department: department,
          location: this.cleanValue(row['LOCATION']),
          positionStatus: this.cleanValue(row['POSITION STATUS']),
          hireDate,
          rehireDate,
        };

        records.push(record);
      }

      console.log(`[EmployeeDirectoryService] Parsed ${records.length} records from Excel file`);
      return records;
    } catch (error) {
      console.error('[EmployeeDirectoryService] Error parsing Excel file:', error);
      return [];
    }
  }

  private parseJobTitle(jobTitle?: string): { position?: string; code?: string } {
    if (!jobTitle) return {};

    // Format: "CODE - Position"
    const match = jobTitle.match(/^([A-Z]+)\s*-\s*(.+)$/);
    if (match) {
      return {
        code: match[1].trim(),
        position: match[2].trim(),
      };
    }

    return { position: jobTitle };
  }

  private parseDepartment(department?: string): { department?: string; departmentCode?: string } {
    if (!department) return {};

    // Format: "CODE - Department Name"
    const match = department.match(/^([A-Z]+)\s*-\s*(.+)$/);
    if (match) {
      return {
        departmentCode: match[1].trim(),
        department: match[2].trim(),
      };
    }

    return { department };
  }

  private parseDate(dateStr?: string): Date | undefined {
    if (!dateStr || dateStr.trim() === '') return undefined;

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return undefined;
      return date;
    } catch {
      return undefined;
    }
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

  private parseFullName(fullName: string): {
    firstName?: string;
    lastName?: string;
    middleName?: string;
  } {
    if (!fullName) {
      return {};
    }

    const parts = fullName.trim().split(/\s+/);

    if (parts.length === 0) {
      return {};
    }

    if (parts.length === 1) {
      return { firstName: parts[0] };
    }

    if (parts.length === 2) {
      return {
        firstName: parts[0],
        lastName: parts[1],
      };
    }

    // 3 or more parts: first is firstName, rest is compound lastName (Latin American naming convention)
    // e.g., "Alien Tapia Salvador" -> firstName: "Alien", lastName: "Tapia Salvador"
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
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
