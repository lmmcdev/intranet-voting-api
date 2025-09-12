import { Nomination, NominationWithEmployee } from '../models/Nomination';
import { CosmosClient } from '../utils/CosmosClient';

export class NominationRepository {
  private cosmosClient: CosmosClient;
  private containerName = 'nominations';

  constructor(cosmosClient: CosmosClient) {
    this.cosmosClient = cosmosClient;
  }

  async create(nomination: Nomination): Promise<Nomination> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.items.create(nomination);
    return resource as Nomination;
  }

  async findById(id: string): Promise<Nomination | null> {
    try {
      const container = await this.cosmosClient.getContainer(this.containerName);
      const { resource } = await container.item(id, id).read<Nomination>();
      return resource || null;
    } catch (error) {
      if ((error as any).code === 404) {
        return null;
      }
      throw error;
    }
  }

  async findByVotingPeriod(votingPeriodId: string): Promise<Nomination[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.votingPeriodId = @votingPeriodId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@votingPeriodId', value: votingPeriodId }]
    };
    
    const { resources } = await container.items.query<Nomination>(querySpec).fetchAll();
    return resources;
  }

  async findByVotingPeriodWithEmployee(votingPeriodId: string): Promise<NominationWithEmployee[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: `
        SELECT 
          n.*,
          e.name as employeeName,
          e.department as employeeDepartment,
          e.position as employeePosition
        FROM nominations n 
        JOIN employees e ON n.nominatedEmployeeId = e.id
        WHERE n.votingPeriodId = @votingPeriodId 
        ORDER BY n.createdAt DESC
      `,
      parameters: [{ name: '@votingPeriodId', value: votingPeriodId }]
    };
    
    const { resources } = await container.items.query(querySpec).fetchAll();
    
    return resources.map(item => ({
      id: item.id,
      nominatedEmployeeId: item.nominatedEmployeeId,
      nominatorEmail: item.nominatorEmail,
      votingPeriodId: item.votingPeriodId,
      reason: item.reason,
      createdAt: new Date(item.createdAt),
      nominatedEmployee: {
        name: item.employeeName,
        department: item.employeeDepartment,
        position: item.employeePosition
      }
    }));
  }

  async findByNominatorAndPeriod(nominatorEmail: string, votingPeriodId: string): Promise<Nomination | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.nominatorEmail = @nominatorEmail AND c.votingPeriodId = @votingPeriodId',
      parameters: [
        { name: '@nominatorEmail', value: nominatorEmail },
        { name: '@votingPeriodId', value: votingPeriodId }
      ]
    };
    
    const { resources } = await container.items.query<Nomination>(querySpec).fetchAll();
    return resources.length > 0 ? resources[0] : null;
  }

  async countByEmployeeAndPeriod(employeeId: string, votingPeriodId: string): Promise<number> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT VALUE COUNT(1) FROM c WHERE c.nominatedEmployeeId = @employeeId AND c.votingPeriodId = @votingPeriodId',
      parameters: [
        { name: '@employeeId', value: employeeId },
        { name: '@votingPeriodId', value: votingPeriodId }
      ]
    };
    
    const { resources } = await container.items.query<number>(querySpec).fetchAll();
    return resources[0] || 0;
  }
}