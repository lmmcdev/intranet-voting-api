import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { Employee } from '../modules/employee/models/employee.model';
import { AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID } from '../config/env.config';

interface AzureUser {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  mail: string;
  userPrincipalName: string;
  businessPhones?: string[];
  mobilePhone?: string;
  officeLocation?: string;
  preferredLanguage?: string;
  department?: string;
  jobTitle?: string;
  companyName?: string;
  employeeType?: string;
  division?: string;
  accountEnabled?: boolean;
}

export class AzureEmployeeService {
  private graphClient?: Client;
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.tenantId = AZURE_TENANT_ID || '';
    this.clientId = AZURE_CLIENT_ID || '';
    this.clientSecret = AZURE_CLIENT_SECRET || '';

    // Only initialize Graph client if we have valid Azure AD configuration
    if (
      this.tenantId &&
      this.clientId &&
      !this.tenantId.includes('your-azure') &&
      !this.clientId.includes('your-azure')
    ) {
      // Create credential
      const credential = new ClientSecretCredential(
        this.tenantId,
        this.clientId,
        this.clientSecret
      );

      // Initialize Graph client with credential
      this.graphClient = Client.initWithMiddleware({
        authProvider: {
          getAccessToken: async () => {
            const token = await credential.getToken(['https://graph.microsoft.com/.default']);
            return token?.token || '';
          },
        },
      });
    }
    // If no valid config, graphClient will be undefined and we'll use mock data
  }

  async getAllActiveEmployees(): Promise<Employee[]> {
    console.log('Fetching all active employees from Azure AD');
    // If Azure AD not configured, return empty array
    if (!this.graphClient) {
      console.log('Azure AD not configured, no employee data available');
      return [];
    }

    try {
      const allEmployees: Employee[] = [];
      let nextPageToken: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const result: {
          employees: Employee[];
          nextPageToken?: string;
          hasMore: boolean;
        } = await this.getAllActiveEmployeesPaginated(999, nextPageToken);
        allEmployees.push(...result.employees);
        nextPageToken = result.nextPageToken;
        hasMore = result.hasMore;

        console.log(`Current total: ${allEmployees.length} employees, hasMore: ${hasMore}`);

        // Safety check to prevent infinite loops
        if (allEmployees.length > 10000) {
          console.warn('Reached safety limit of 10000 employees, stopping pagination');
          break;
        }
      }

      console.log(`Fetched ${allEmployees.length} total users from Azure AD`);
      return allEmployees;
    } catch (error) {
      console.error('Error fetching users from Azure AD:', error);
      return [];
    }
  }

  async getAllActiveEmployeesPaginated(
    pageSize: number = 50,
    skipToken?: string
  ): Promise<{
    employees: Employee[];
    nextPageToken?: string;
    hasMore: boolean;
  }> {
    console.log('Fetching paginated active employees from Azure AD');
    // If Azure AD not configured, return empty array
    if (!this.graphClient) {
      console.log('Azure AD not configured, no employee data available');
      return {
        employees: [],
        hasMore: false,
      };
    }

    const filter = 'accountEnabled eq true';

    try {
      // Build query with pagination
      let query = this.graphClient.api('/users')
        .filter(filter)
        .select([
          'id',
          'displayName',
          'givenName',
          'surname',
          'mail',
          'userPrincipalName',
          'department',
          'jobTitle',
          'officeLocation',
          'companyName',
          'employeeType',
          'division',
          'accountEnabled'
        ])
        .top(pageSize);

      if (skipToken) {
        query = query.skipToken(skipToken);
      }

      const result = await query.get();
      const users = result.value ?? [];

      console.log(`Fetched ${users.length} users from Azure AD`);

      // Count excluded users for reporting
      const burgosDentalUsers = users.filter((user: AzureUser) =>
        user.mail && user.mail.toLowerCase().includes('burgosdental.com')
      );

      const testUsers = users.filter((user: AzureUser) =>
        user.mail && user.mail.toLowerCase().includes('testuser')
      );

      if (burgosDentalUsers.length > 0) {
        console.log(`Excluding ${burgosDentalUsers.length} burgosdental.com users`);
      }

      if (testUsers.length > 0) {
        console.log(`Excluding ${testUsers.length} testuser accounts`);
      }

      // Log first few user names for debugging
      console.log('First 5 Azure AD users (after domain filtering):');
      const filteredUsers = users.filter((user: AzureUser) =>
        user.mail &&
        user.mail.trim() !== '' &&
        !user.mail.toLowerCase().includes('burgosdental.com') &&
        !user.mail.toLowerCase().includes('testuser')
      );

      filteredUsers.slice(0, 5).forEach((user: AzureUser) => {
        console.log(`  - "${user.displayName}" (${user.mail})`);
      });

      const employees = filteredUsers
        .map((user: AzureUser) => this.transformAzureUserToEmployee(user));

      const totalExcluded = burgosDentalUsers.length + testUsers.length;
      console.log(`Filtered to ${employees.length} employees (excluded ${totalExcluded} users: ${burgosDentalUsers.length} burgosdental.com + ${testUsers.length} testuser)`);

      // Log first few employee names for debugging
      console.log('First 5 transformed employees:');
      employees.slice(0, 5).forEach((emp: Employee) => {
        console.log(`  - "${emp.fullName}" (${emp.email})`);
      });

      const nextPageToken = result['@odata.nextLink']
        ? new URLSearchParams(new URL(result['@odata.nextLink']).search).get('$skiptoken') ||
          undefined
        : undefined;

      console.log(`Next page token: ${nextPageToken}`);

      return {
        employees,
        nextPageToken,
        hasMore: !!nextPageToken,
      };
    } catch (error) {
      console.error('Error fetching users from Azure AD:', error);
      return {
        employees: [],
        hasMore: false,
      };
    }
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    if (!this.graphClient) {
      return null;
    }

    try {
      const user = await this.graphClient
        .api(`/users/${id}`)
        .select([
          'id',
          'displayName',
          'givenName',
          'surname',
          'mail',
          'userPrincipalName',
          'department',
          'jobTitle',
          'officeLocation',
          'companyName',
          'employeeType',
          'division',
          'accountEnabled',
        ])
        .get();

      return this.transformAzureUserToEmployee(user);
    } catch (error) {
      if ((error as any).code === 'Request_ResourceNotFound') {
        return null;
      }
      console.error('Error fetching user from Azure AD:', error);
      return null;
    }
  }

  async searchEmployees(query: string, limit: number = 10): Promise<Employee[]> {
    console.log(`Searching employees with query: "${query}", limit: ${limit}`);

    // If Azure AD not configured, return empty array
    if (!this.graphClient) {
      console.log('Azure AD not configured, no employee data available');
      return [];
    }

    try {
      // Get all employees first, then filter client-side for better flexibility
      console.log('Getting all employees to perform client-side search');
      const allEmployees = await this.getAllActiveEmployees();

      console.log(`Searching through ${allEmployees.length} employees for "${query}"`);

      // Filter and sort client-side with flexible matching
      return this.filterAndSortEmployees(allEmployees, query, limit);
    } catch (error) {
      console.error('Error searching users from Azure AD:', error);
      return [];
    }
  }

  private filterAndSortEmployees(employees: Employee[], query: string, limit: number): Employee[] {
    const lowerQuery = query.toLowerCase();

    // Score employees based on match quality
    const scoredEmployees = employees
      .map(emp => {
        let score = 0;
        const lowerFullName = emp.fullName?.toLowerCase();
        const lowerEmail = emp.email?.toLowerCase();
        const lowerDept = emp.department?.toLowerCase();
        const lowerPos = emp.position?.toLowerCase();

        // Prioritize exact name matches
        if (lowerFullName === lowerQuery) score += 1000;
        else if (lowerFullName?.startsWith(lowerQuery)) score += 500;
        else if (lowerFullName?.includes(lowerQuery)) score += 100;

        // Email matches
        if (lowerEmail?.startsWith(lowerQuery)) score += 300;
        else if (lowerEmail?.includes(lowerQuery)) score += 50;

        // Department and position matches
        if (lowerDept.includes(lowerQuery)) score += 25;
        if (lowerPos.includes(lowerQuery)) score += 25;

        return { employee: emp, score };
      })
      .filter(item => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || a.employee.fullName?.localeCompare(b.employee.fullName ?? '') || 0
      )
      .slice(0, limit);

    return scoredEmployees.map(item => item.employee);
  }

  async getEmployeeByEmail(email: string): Promise<Employee | null> {
    // If Azure AD not configured, return null
    if (!this.graphClient) {
      return null;
    }

    try {
      const users = await this.graphClient
        .api('/users')
        .select([
          'id',
          'displayName',
          'givenName',
          'surname',
          'mail',
          'userPrincipalName',
          'department',
          'jobTitle',
          'officeLocation',
          'companyName',
          'employeeType',
          'division',
          'accountEnabled',
        ])
        .filter(`mail eq '${email}' or userPrincipalName eq '${email}'`)
        .get();

      if (users.value.length === 0) {
        return null;
      }

      return this.transformAzureUserToEmployee(users.value[0]);
    } catch (error) {
      console.error('Error fetching user by email from Azure AD:', error);
      return null;
    }
  }

  private transformAzureUserToEmployee(azureUser: AzureUser): Employee {
    const firstName = azureUser.givenName?.trim() || '';
    const lastName = azureUser.surname?.trim() || '';
    const constructedFullName = `${firstName} ${lastName}`.trim();

    return {
      id: azureUser.id,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      fullName: constructedFullName || azureUser.displayName,
      email: (azureUser.mail || azureUser.userPrincipalName).toLowerCase(),
      department: azureUser.department || azureUser.division || azureUser.companyName || azureUser.employeeType || 'Unknown',
      position: azureUser.jobTitle || 'Unknown',
      isActive: azureUser.accountEnabled ?? true,
      location: azureUser.officeLocation || 'Unknown',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getEmployeeCount(): Promise<number> {
    const employees = await this.getAllActiveEmployees();
    return employees.length;
  }
}
