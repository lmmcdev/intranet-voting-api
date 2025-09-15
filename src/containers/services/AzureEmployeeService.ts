import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { Employee } from '../models/Employee';

interface AzureUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  department?: string;
  jobTitle?: string;
  accountEnabled: boolean;
}

export class AzureEmployeeService {
  private graphClient?: Client;
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.tenantId = process.env.AZURE_TENANT_ID || '';
    this.clientId = process.env.AZURE_CLIENT_ID || '';
    this.clientSecret = process.env.AZURE_CLIENT_SECRET || '';

    // Only initialize Graph client if we have valid Azure AD configuration
    if (this.tenantId && this.clientId && this.clientSecret && 
        !this.tenantId.includes('your-azure') && 
        !this.clientId.includes('your-azure')) {
      
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
          }
        }
      });
    }
    // If no valid config, graphClient will be undefined and we'll use mock data
  }

  async getAllActiveEmployees(): Promise<Employee[]> {
    // If Azure AD not configured, use mock data
    if (!this.graphClient) {
      console.log('Azure AD not configured, using mock employee data');
      return this.getAllActiveEmployeesMock();
    }

    try {
      // Get users from Azure AD
      const users = await this.graphClient
        .api('/users')
        .select(['id', 'displayName', 'mail', 'userPrincipalName', 'department', 'jobTitle', 'accountEnabled'])
        .filter('accountEnabled eq true')
        .get();

      // Transform Azure users to Employee format
      return users.value.map((user: AzureUser) => this.transformAzureUserToEmployee(user));
    } catch (error) {
      console.error('Error fetching users from Azure AD, falling back to mock data:', error);
      return this.getAllActiveEmployeesMock();
    }
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    // If Azure AD not configured, search in mock data
    if (!this.graphClient) {
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return mockEmployees.find(emp => emp.id === id) || null;
    }

    try {
      const user = await this.graphClient
        .api(`/users/${id}`)
        .select(['id', 'displayName', 'mail', 'userPrincipalName', 'department', 'jobTitle', 'accountEnabled'])
        .get();

      return this.transformAzureUserToEmployee(user);
    } catch (error) {
      if ((error as any).code === 'Request_ResourceNotFound') {
        return null;
      }
      console.error('Error fetching user from Azure AD:', error);
      // Fall back to mock data
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return mockEmployees.find(emp => emp.id === id) || null;
    }
  }

  async getEmployeeByEmail(email: string): Promise<Employee | null> {
    // If Azure AD not configured, search in mock data
    if (!this.graphClient) {
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return mockEmployees.find(emp => emp.email === email) || null;
    }

    try {
      const users = await this.graphClient
        .api('/users')
        .select(['id', 'displayName', 'mail', 'userPrincipalName', 'department', 'jobTitle', 'accountEnabled'])
        .filter(`mail eq '${email}' or userPrincipalName eq '${email}'`)
        .get();

      if (users.value.length === 0) {
        return null;
      }

      return this.transformAzureUserToEmployee(users.value[0]);
    } catch (error) {
      console.error('Error fetching user by email from Azure AD:', error);
      // Fall back to mock data
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return mockEmployees.find(emp => emp.email === email) || null;
    }
  }

  private transformAzureUserToEmployee(azureUser: AzureUser): Employee {
    return {
      id: azureUser.id,
      name: azureUser.displayName,
      email: azureUser.mail || azureUser.userPrincipalName,
      department: azureUser.department || 'Unknown',
      position: azureUser.jobTitle || 'Unknown',
      isActive: azureUser.accountEnabled,
      createdAt: new Date(), // Azure AD doesn't provide creation date via Graph API easily
      updatedAt: new Date()
    };
  }

  // For development/testing - fallback to mock data if Azure AD is not configured
  async getAllActiveEmployeesMock(): Promise<Employee[]> {
    const mockEmployees: Employee[] = [
      {
        id: 'emp-001',
        name: 'John Doe',
        email: 'john.doe@company.com',
        department: 'Engineering',
        position: 'Senior Developer',
        isActive: true,
        createdAt: new Date('2023-01-15'),
        updatedAt: new Date('2023-01-15')
      },
      {
        id: 'emp-002',
        name: 'Jane Smith',
        email: 'jane.smith@company.com',
        department: 'Marketing',
        position: 'Marketing Manager',
        isActive: true,
        createdAt: new Date('2023-02-01'),
        updatedAt: new Date('2023-02-01')
      },
      {
        id: 'emp-003',
        name: 'Bob Johnson',
        email: 'bob.johnson@company.com',
        department: 'HR',
        position: 'HR Specialist',
        isActive: true,
        createdAt: new Date('2023-03-10'),
        updatedAt: new Date('2023-03-10')
      }
    ];

    return mockEmployees;
  }
}