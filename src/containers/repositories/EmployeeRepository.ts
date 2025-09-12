import { Employee } from '../models/Employee';
import { CosmosClient } from '../utils/CosmosClient';

export class EmployeeRepository {
  private cosmosClient: CosmosClient;
  private containerName = 'employees';

  constructor(cosmosClient: CosmosClient) {
    this.cosmosClient = cosmosClient;
  }

  async create(employee: Employee): Promise<Employee> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.items.create(employee);
    return resource as Employee;
  }

  async findById(id: string): Promise<Employee | null> {
    try {
      const container = await this.cosmosClient.getContainer(this.containerName);
      const { resource } = await container.item(id, id).read<Employee>();
      return resource || null;
    } catch (error) {
      if ((error as any).code === 404) {
        return null;
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: email }]
    };
    
    const { resources } = await container.items.query<Employee>(querySpec).fetchAll();
    return resources.length > 0 ? resources[0] : null;
  }

  async findActiveEmployees(): Promise<Employee[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.isActive = true ORDER BY c.name',
      parameters: []
    };
    
    const { resources } = await container.items.query<Employee>(querySpec).fetchAll();
    return resources;
  }

  async update(id: string, employee: Employee): Promise<Employee> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.item(id, id).replace(employee);
    return resource as Employee;
  }

  async delete(id: string): Promise<void> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    await container.item(id, id).delete();
  }
}