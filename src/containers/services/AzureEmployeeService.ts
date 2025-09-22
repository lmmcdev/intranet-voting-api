import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { Employee } from "../models/Employee";
import {
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  AZURE_TENANT_ID,
} from "../../config/env.config";

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
    this.tenantId = AZURE_TENANT_ID || "";
    this.clientId = AZURE_CLIENT_ID || "";
    this.clientSecret = AZURE_CLIENT_SECRET || "";

    // Only initialize Graph client if we have valid Azure AD configuration
    if (
      this.tenantId &&
      this.clientId &&
      !this.tenantId.includes("your-azure") &&
      !this.clientId.includes("your-azure")
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
            const token = await credential.getToken([
              "https://graph.microsoft.com/.default",
            ]);
            return token?.token || "";
          },
        },
      });
    }
    // If no valid config, graphClient will be undefined and we'll use mock data
  }

  async getAllActiveEmployees(): Promise<Employee[]> {
    console.log("Fetching all active employees from Azure AD");
    // If Azure AD not configured, use mock data
    if (!this.graphClient) {
      console.log("Azure AD not configured, using mock employee data");
      return this.getAllActiveEmployeesMock();
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

        console.log(
          `Current total: ${allEmployees.length} employees, hasMore: ${hasMore}`
        );

        // Safety check to prevent infinite loops
        if (allEmployees.length > 10000) {
          console.warn(
            "Reached safety limit of 10000 employees, stopping pagination"
          );
          break;
        }
      }

      console.log(`Fetched ${allEmployees.length} total users from Azure AD`);
      return allEmployees;
    } catch (error) {
      console.error(
        "Error fetching users from Azure AD, falling back to mock data:",
        error
      );
      return this.getAllActiveEmployeesMock();
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
    console.log("Fetching paginated active employees from Azure AD");
    // If Azure AD not configured, use mock data
    if (!this.graphClient) {
      console.log("Azure AD not configured, using mock employee data");
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return {
        employees: mockEmployees,
        hasMore: false,
      };
    }

    const filter = "accountEnabled eq true";

    try {
      let query = this.graphClient
        .api("/users")
        .select([
          "id",
          "displayName",
          "mail",
          "userPrincipalName",
          "department",
          "jobTitle",
          "accountEnabled",
        ])
        .filter(filter)
        .top(pageSize);

      if (skipToken) {
        query = query.skipToken(skipToken);
      }

      const users = await query.get();

      console.log(`Fetched ${users.value.length} users from Azure AD`);

      const employees = users.value
        .filter(
          (user: AzureUser) =>
            user.mail &&
            user.mail.trim() !== "" &&
            user.jobTitle &&
            user.jobTitle.trim() !== ""
        )
        .map((user: AzureUser) => this.transformAzureUserToEmployee(user));

      const nextPageToken = users["@odata.nextLink"]
        ? new URLSearchParams(new URL(users["@odata.nextLink"]).search).get(
            "$skiptoken"
          ) || undefined
        : undefined;

      console.log(`Next page token: ${nextPageToken}`);

      return {
        employees,
        nextPageToken,
        hasMore: !!nextPageToken,
      };
    } catch (error) {
      console.error(
        "Error fetching users from Azure AD, falling back to mock data:",
        error
      );
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return {
        employees: mockEmployees,
        hasMore: false,
      };
    }
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    if (!this.graphClient) {
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return mockEmployees.find((emp) => emp.id === id) || null;
    }

    try {
      const user = await this.graphClient
        .api(`/users/${id}`)
        .select([
          "id",
          "displayName",
          "mail",
          "userPrincipalName",
          "department",
          "jobTitle",
          "accountEnabled",
        ])
        .get();

      return this.transformAzureUserToEmployee(user);
    } catch (error) {
      if ((error as any).code === "Request_ResourceNotFound") {
        return null;
      }
      console.error("Error fetching user from Azure AD:", error);
      // Fall back to mock data
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return mockEmployees.find((emp) => emp.id === id) || null;
    }
  }

  async searchEmployees(
    query: string,
    limit: number = 10
  ): Promise<Employee[]> {
    console.log(`Searching employees with query: "${query}", limit: ${limit}`);

    // If Azure AD not configured, search in mock data
    if (!this.graphClient) {
      console.log("Azure AD not configured, searching mock employee data");
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return this.filterAndSortEmployees(mockEmployees, query, limit);
    }

    try {
      // Get all employees first, then filter client-side for better flexibility
      console.log("Getting all employees to perform client-side search");
      const allEmployees = await this.getAllActiveEmployees();

      console.log(
        `Searching through ${allEmployees.length} employees for "${query}"`
      );

      // Filter and sort client-side with flexible matching
      return this.filterAndSortEmployees(allEmployees, query, limit);
    } catch (error) {
      console.error(
        "Error searching users from Azure AD, falling back to mock data:",
        error
      );
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return this.filterAndSortEmployees(mockEmployees, query, limit);
    }
  }

  private filterAndSortEmployees(
    employees: Employee[],
    query: string,
    limit: number
  ): Employee[] {
    const lowerQuery = query.toLowerCase();

    // Score employees based on match quality
    const scoredEmployees = employees
      .map((emp) => {
        let score = 0;
        const lowerName = emp.name.toLowerCase();
        const lowerEmail = emp.email.toLowerCase();
        const lowerDept = emp.department.toLowerCase();
        const lowerPos = emp.position.toLowerCase();

        // Prioritize exact name matches
        if (lowerName === lowerQuery) score += 1000;
        else if (lowerName.startsWith(lowerQuery)) score += 500;
        else if (lowerName.includes(lowerQuery)) score += 100;

        // Email matches
        if (lowerEmail.startsWith(lowerQuery)) score += 300;
        else if (lowerEmail.includes(lowerQuery)) score += 50;

        // Department and position matches
        if (lowerDept.includes(lowerQuery)) score += 25;
        if (lowerPos.includes(lowerQuery)) score += 25;

        return { employee: emp, score };
      })
      .filter((item) => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || a.employee.name.localeCompare(b.employee.name)
      )
      .slice(0, limit);

    return scoredEmployees.map((item) => item.employee);
  }

  async getEmployeeByEmail(email: string): Promise<Employee | null> {
    // If Azure AD not configured, search in mock data
    if (!this.graphClient) {
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return mockEmployees.find((emp) => emp.email === email) || null;
    }

    try {
      const users = await this.graphClient
        .api("/users")
        .select([
          "id",
          "displayName",
          "mail",
          "userPrincipalName",
          "department",
          "jobTitle",
          "accountEnabled",
        ])
        .filter(`mail eq '${email}' or userPrincipalName eq '${email}'`)
        .get();

      if (users.value.length === 0) {
        return null;
      }

      return this.transformAzureUserToEmployee(users.value[0]);
    } catch (error) {
      console.error("Error fetching user by email from Azure AD:", error);
      // Fall back to mock data
      const mockEmployees = await this.getAllActiveEmployeesMock();
      return mockEmployees.find((emp) => emp.email === email) || null;
    }
  }

  private transformAzureUserToEmployee(azureUser: AzureUser): Employee {
    return {
      id: azureUser.id,
      name: azureUser.displayName,
      email: azureUser.mail || azureUser.userPrincipalName,
      department: azureUser.department || "Unknown",
      position: azureUser.jobTitle || "Unknown",
      isActive: azureUser.accountEnabled,
      createdAt: new Date(), // Azure AD doesn't provide creation date via Graph API easily
      updatedAt: new Date(),
    };
  }

  // For development/testing - fallback to mock data if Azure AD is not configured
  async getAllActiveEmployeesMock(): Promise<Employee[]> {
    const mockEmployees: Employee[] = [
      {
        id: "emp-001",
        name: "John Doe",
        email: "john.doe@company.com",
        department: "Engineering",
        position: "Senior Developer",
        isActive: true,
        createdAt: new Date("2023-01-15"),
        updatedAt: new Date("2023-01-15"),
      },
      {
        id: "emp-002",
        name: "Jane Smith",
        email: "jane.smith@company.com",
        department: "Marketing",
        position: "Marketing Manager",
        isActive: true,
        createdAt: new Date("2023-02-01"),
        updatedAt: new Date("2023-02-01"),
      },
      {
        id: "emp-003",
        name: "Bob Johnson",
        email: "bob.johnson@company.com",
        department: "HR",
        position: "HR Specialist",
        isActive: true,
        createdAt: new Date("2023-03-10"),
        updatedAt: new Date("2023-03-10"),
      },
    ];

    return mockEmployees;
  }

  async getEmployeeCount(): Promise<number> {
    const employees = await this.getAllActiveEmployees();
    return employees.length;
  }
}
