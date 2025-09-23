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
    // First get all nominations for the voting period
    const nominations = await this.findByVotingPeriod(votingPeriodId);
    
    if (nominations.length === 0) {
      return [];
    }

    // Get employee container to fetch employee details
    const employeeContainer = await this.cosmosClient.getContainer('employees');
    
    // Map nominations with employee details
    const nominationsWithEmployee: NominationWithEmployee[] = [];
    
    for (const nomination of nominations) {
      try {
        // Try to get employee details
        const { resource: employee } = await employeeContainer
          .item(nomination.nominatedEmployeeId, nomination.nominatedEmployeeId)
          .read();
        
        nominationsWithEmployee.push({
          ...nomination,
          nominatedEmployee: {
            name: employee?.name || 'Unknown Employee',
            department: employee?.department || 'Unknown',
            position: employee?.position || 'Unknown'
          }
        });
      } catch (error) {
        // If employee not found, use placeholder values
        nominationsWithEmployee.push({
          ...nomination,
          nominatedEmployee: {
            name: 'Unknown Employee',
            department: 'Unknown',
            position: 'Unknown'
          }
        });
      }
    }
    
    return nominationsWithEmployee;
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

  async update(id: string, nomination: Nomination): Promise<Nomination> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.item(id, id).replace(nomination);
    return resource as Nomination;
  }

  async findByNominatorEmail(nominatorEmail: string, votingPeriodId: string): Promise<Nomination | null> {
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

  async delete(id: string): Promise<void> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    await container.item(id, id).delete();
  }
}