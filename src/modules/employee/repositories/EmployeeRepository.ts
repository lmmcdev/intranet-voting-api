import { Employee } from '../models/employee.model';
import { CosmosClient } from '../../../common/utils/CosmosClient';
import { SEARCH_CASE_SENSITIVE, SEARCH_DEFAULT_LIMIT } from '../../../config/env.config';

export class EmployeeRepository {
  private readonly containerName = 'employees';

  constructor(private readonly cosmosClient: CosmosClient) {}

  async countAll(): Promise<number> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT COUNT(1) FROM c',
      parameters: [],
    };
    const { resources } = await container.items.query<{ $1: number }>(querySpec).fetchAll();
    return resources.length > 0 ? resources[0].$1 : 0;
  }

  async create(employee: Employee): Promise<Employee> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.items.create<Employee>(employee);
    return resource as Employee;
  }

  async findById(id: string): Promise<Employee | null> {
    try {
      const container = await this.cosmosClient.getContainer(this.containerName);
      const { resource } = await container.item(id, id).read<Employee>();
      return (resource as Employee) || null;
    } catch (error) {
      const err = error as { code?: number };
      if (err?.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: email }],
    };
    const { resources } = await container.items.query<Employee>(querySpec).fetchAll();
    return resources.length > 0 ? (resources[0] as Employee) : null;
  }

  async findByUsername(username: string): Promise<Employee | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.username = @username',
      parameters: [{ name: '@username', value: username }],
    };
    const { resources } = await container.items.query<Employee>(querySpec).fetchAll();
    return resources.length > 0 ? (resources[0] as Employee) : null;
  }

  async findActiveEmployees(): Promise<Employee[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.isActive = true ORDER BY c.fullName',
      parameters: [],
    };
    const { resources } = await container.items.query<Employee>(querySpec).fetchAll();
    return resources as Employee[];
  }

  async findSyncableEmployees(): Promise<Employee[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query:
        'SELECT * FROM c WHERE c.isActive = true AND (c.excludeFromSync = false OR NOT IS_DEFINED(c.excludeFromSync)) ORDER BY c.fullName',
      parameters: [],
    };
    const { resources } = await container.items.query<Employee>(querySpec).fetchAll();
    return resources as Employee[];
  }

  async update(id: string, employee: Employee): Promise<Employee> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.item(id, id).replace<Employee>(employee);
    return resource as Employee;
  }

  async partialUpdate(id: string, updates: Partial<Employee>): Promise<Employee | null> {
    try {
      const existingEmployee = await this.findById(id);
      if (!existingEmployee) {
        return null;
      }

      const updatedEmployee: Employee = {
        ...existingEmployee,
        ...updates,
        id: existingEmployee.id, // Ensure ID cannot be changed
        updatedAt: new Date(),
      };

      return await this.update(id, updatedEmployee);
    } catch (error) {
      console.error(`Failed to partial update employee ${id}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    await container.item(id, id).delete();
  }

  async findAll(filters?: {
    isActive?: boolean;
    department?: string;
    position?: string;
    location?: string;
    votingGroup?: string;
    votingEligible?: boolean;
  }): Promise<Employee[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    let query = 'SELECT * FROM c';
    const parameters: any[] = [];
    const conditions: string[] = [];

    if (filters?.isActive !== undefined) {
      conditions.push('c.isActive = @isActive');
      parameters.push({ name: '@isActive', value: filters.isActive });
    } else {
      // Default to only active employees if isActive filter is not provided
      conditions.push('c.isActive = true');
    }

    if (filters?.department) {
      conditions.push('c.department = @department');
      parameters.push({ name: '@department', value: filters.department });
    }

    if (filters?.position) {
      conditions.push('c.position = @position');
      parameters.push({ name: '@position', value: filters.position });
    }

    if (filters?.location) {
      conditions.push('c.location = @location');
      parameters.push({ name: '@location', value: filters.location });
    }

    if (filters?.votingGroup) {
      conditions.push('c.votingGroup = @votingGroup');
      parameters.push({ name: '@votingGroup', value: filters.votingGroup });
    }

    if (filters?.votingEligible !== undefined) {
      conditions.push('c.votingEligible = @votingEligible');
      parameters.push({ name: '@votingEligible', value: filters.votingEligible });
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY c.fullName';

    const querySpec = {
      query,
      parameters,
    };

    const { resources } = await container.items.query<Employee>(querySpec).fetchAll();
    return resources as Employee[];
  }

  async count(): Promise<number> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT VALUE COUNT(1) FROM c',
      parameters: [],
    };
    const { resources } = await container.items.query<number>(querySpec).fetchAll();
    return resources.length > 0 ? (resources[0] as number) : 0;
  }

  async updateSyncStatus(id: string, excludeFromSync: boolean): Promise<Employee | null> {
    try {
      const employee = await this.findById(id);
      if (!employee) {
        return null;
      }

      const updatedEmployee = {
        ...employee,
        excludeFromSync,
        updatedAt: new Date(),
      };

      return await this.update(id, updatedEmployee);
    } catch (error) {
      console.error(`Failed to update sync status for employee ${id}:`, error);
      throw error;
    }
  }

  async findExcludedFromSync(): Promise<Employee[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.excludeFromSync = true ORDER BY c.fullName',
      parameters: [],
    };
    const { resources } = await container.items.query<Employee>(querySpec).fetchAll();
    return resources as Employee[];
  }

  async searchByFullName(searchTerm: string, limit?: number): Promise<Employee[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    const searchLimit = limit || SEARCH_DEFAULT_LIMIT;
    const caseSensitive = SEARCH_CASE_SENSITIVE;

    // Build query based on case sensitivity setting
    const query = caseSensitive
      ? `SELECT TOP @limit * FROM c WHERE CONTAINS(c.fullName, @searchTerm) ORDER BY c.fullName`
      : `SELECT TOP @limit * FROM c WHERE CONTAINS(UPPER(c.fullName), UPPER(@searchTerm)) ORDER BY c.fullName`;

    const querySpec = {
      query,
      parameters: [
        { name: '@searchTerm', value: searchTerm },
        { name: '@limit', value: searchLimit },
      ],
    };

    const { resources } = await container.items.query<Employee>(querySpec).fetchAll();
    return resources as Employee[];
  }

  async searchByFullNameWithWildcard(pattern: string): Promise<Employee[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    // Using LIKE operator for pattern matching with wildcards
    const querySpec = {
      query: `
        SELECT * FROM c
        WHERE UPPER(c.fullName) LIKE UPPER(@pattern)
        ORDER BY c.fullName
      `,
      parameters: [{ name: '@pattern', value: pattern }],
    };

    const { resources } = await container.items.query<Employee>(querySpec).fetchAll();
    return resources as Employee[];
  }

  async deleteAll(): Promise<number> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    // Get all employee IDs first
    const querySpec = {
      query: 'SELECT c.id FROM c',
      parameters: [],
    };

    const { resources } = await container.items.query<{ id: string }>(querySpec).fetchAll();

    let deletedCount = 0;

    // Delete each employee individually
    for (const item of resources) {
      try {
        await container.item(item.id, item.id).delete();
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete employee ${item.id}:`, error);
      }
    }

    console.log(`Deleted ${deletedCount} employees from database`);
    return deletedCount;
  }

  async getDistinctVotingGroups(): Promise<string[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    const querySpec = {
      query: `
        SELECT DISTINCT VALUE c.votingGroup
        FROM c
        WHERE IS_DEFINED(c.votingGroup) AND c.votingGroup != null AND c.votingGroup != ""
        ORDER BY c.votingGroup
      `,
      parameters: [],
    };

    const { resources } = await container.items.query<string>(querySpec).fetchAll();
    return resources;
  }
}
