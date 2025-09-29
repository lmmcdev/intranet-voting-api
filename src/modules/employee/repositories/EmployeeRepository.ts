import { Employee } from '../models/employee.model';
import { CosmosClient } from '../../../common/utils/CosmosClient';

export class EmployeeRepository {
  private readonly containerName = 'employees';

  constructor(private readonly cosmosClient: CosmosClient) {}

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
      query: 'SELECT * FROM c WHERE c.isActive = true AND (c.excludeFromSync = false OR NOT IS_DEFINED(c.excludeFromSync)) ORDER BY c.fullName',
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

  async delete(id: string): Promise<void> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    await container.item(id, id).delete();
  }

  async findAll(filters?: {
    isActive?: boolean;
    department?: string;
    position?: string;
    location?: string;
  }): Promise<Employee[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    let query = 'SELECT * FROM c';
    const parameters: any[] = [];
    const conditions: string[] = [];

    if (filters?.isActive !== undefined) {
      conditions.push('c.isActive = @isActive');
      parameters.push({ name: '@isActive', value: filters.isActive });
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
}
