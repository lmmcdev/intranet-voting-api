import { CosmosClient } from '../../../common/utils/CosmosClient';
import { Nomination, NominationWithEmployee } from '../../../common/models/Nomination';
import { Employee } from '../../employee/models/employee.model';
import { CosmosQueryResult } from '../../../common/models/Pagination';

export class NominationRepository {
  private readonly containerName = 'nominations';

  constructor(private readonly cosmosClient: CosmosClient) {}

  async create(nomination: Nomination): Promise<Nomination> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.items.create<Nomination>(nomination);
    return resource as Nomination;
  }

  async findById(id: string): Promise<Nomination | null> {
    try {
      const container = await this.cosmosClient.getContainer(this.containerName);
      const { resource } = await container.item(id, id).read<Nomination>();
      return (resource as Nomination) || null;
    } catch (error) {
      const err = error as { code?: number };
      if (err?.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async findByVotingPeriod(votingPeriodId: string): Promise<Nomination[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.votingPeriodId = @votingPeriodId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@votingPeriodId', value: votingPeriodId }],
    };
    const { resources } = await container.items.query<Nomination>(querySpec).fetchAll();
    return resources as Nomination[];
  }

  /**
   * Find nominations by voting period with efficient offset-based pagination
   * Uses OFFSET/LIMIT which is well-supported in Cosmos DB SQL API
   *
   * @param votingPeriodId - The voting period ID
   * @param maxItemCount - Number of items per page (default: 10)
   * @param offset - Number of items to skip (calculated from continuation token)
   * @returns Query result with items and continuation token
   */
  async findByVotingPeriodPaginated(
    votingPeriodId: string,
    maxItemCount: number = 10,
    offset: number = 0
  ): Promise<CosmosQueryResult<Nomination>> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    // Fetch items with OFFSET/LIMIT
    const querySpec = {
      query: `SELECT * FROM c
              WHERE c.votingPeriodId = @votingPeriodId
              ORDER BY c.createdAt DESC
              OFFSET @offset LIMIT @limit`,
      parameters: [
        { name: '@votingPeriodId', value: votingPeriodId },
        { name: '@offset', value: offset },
        { name: '@limit', value: maxItemCount },
      ],
    };

    const { resources } = await container.items.query<Nomination>(querySpec).fetchAll();

    // Check if there are more results by fetching one extra item at next offset
    const checkMoreSpec = {
      query: `SELECT TOP 1 c.id FROM c
              WHERE c.votingPeriodId = @votingPeriodId
              ORDER BY c.createdAt DESC
              OFFSET @nextOffset LIMIT 1`,
      parameters: [
        { name: '@votingPeriodId', value: votingPeriodId },
        { name: '@nextOffset', value: offset + maxItemCount },
      ],
    };

    const { resources: nextPageCheck } = await container.items.query(checkMoreSpec).fetchAll();
    const hasMore = nextPageCheck.length > 0;

    // Create continuation token (next offset as base64)
    const nextToken = hasMore
      ? Buffer.from(JSON.stringify({ offset: offset + maxItemCount })).toString('base64')
      : undefined;

    return {
      resources: resources as Nomination[],
      continuationToken: nextToken,
      hasMoreResults: hasMore,
    };
  }

  async findByVotingPeriodWithEmployee(votingPeriodId: string): Promise<NominationWithEmployee[]> {
    const nominations = await this.findByVotingPeriod(votingPeriodId);
    if (nominations.length === 0) {
      return [];
    }

    const employeeContainer = await this.cosmosClient.getContainer('employees');
    const nominationsWithEmployee: NominationWithEmployee[] = [];

    for (const nomination of nominations) {
      try {
        const { resource: employee } = await employeeContainer
          .item(nomination.nominatedEmployeeId, nomination.nominatedEmployeeId)
          .read<Employee>();

        nominationsWithEmployee.push({
          ...nomination,
          nominatedEmployee: {
            fullName: employee?.fullName ?? 'Unknown Employee',
            department: employee?.department ?? 'Unknown',
            position: employee?.position ?? 'Unknown',
          },
        });
      } catch (error) {
        nominationsWithEmployee.push({
          ...nomination,
          nominatedEmployee: {
            fullName: 'Unknown Employee',
            department: 'Unknown',
            position: 'Unknown',
          },
        });
      }
    }

    return nominationsWithEmployee;
  }

  async findByNominatorAndPeriod(
    nominatorUserName: string,
    votingPeriodId: string
  ): Promise<Nomination | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query:
        'SELECT * FROM c WHERE c.nominatorUserName = @nominatorUserName AND c.votingPeriodId = @votingPeriodId',
      parameters: [
        { name: '@nominatorUserName', value: nominatorUserName },
        { name: '@votingPeriodId', value: votingPeriodId },
      ],
    };
    const { resources } = await container.items.query<Nomination>(querySpec).fetchAll();
    return resources.length > 0 ? (resources[0] as Nomination) : null;
  }

  async countByEmployeeAndPeriod(employeeId: string, votingPeriodId: string): Promise<number> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query:
        'SELECT VALUE COUNT(1) FROM c WHERE c.nominatedEmployeeId = @employeeId AND c.votingPeriodId = @votingPeriodId',
      parameters: [
        { name: '@employeeId', value: employeeId },
        { name: '@votingPeriodId', value: votingPeriodId },
      ],
    };
    const { resources } = await container.items.query<number>(querySpec).fetchAll();
    return (resources[0] as number) || 0;
  }

  async update(id: string, nomination: Nomination): Promise<Nomination> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.item(id, id).replace<Nomination>(nomination);
    return resource as Nomination;
  }

  async findByNominatorUsername(
    nominatorUserName: string,
    votingPeriodId: string
  ): Promise<Nomination | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query:
        'SELECT * FROM c WHERE c.nominatorUserName = @nominatorUserName AND c.votingPeriodId = @votingPeriodId',
      parameters: [
        { name: '@nominatorUserName', value: nominatorUserName },
        { name: '@votingPeriodId', value: votingPeriodId },
      ],
    };
    const { resources } = await container.items.query<Nomination>(querySpec).fetchAll();
    return resources.length > 0 ? (resources[0] as Nomination) : null;
  }

  async delete(id: string): Promise<void> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    await container.item(id, id).delete();
  }

  async findByPeriodAndEmployeeId(
    employeeId: string,
    votingPeriodId: string
  ): Promise<Nomination[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query:
        'SELECT * FROM c WHERE c.nominatedEmployeeId = @employeeId AND c.votingPeriodId = @votingPeriodId',
      parameters: [
        { name: '@employeeId', value: employeeId },
        { name: '@votingPeriodId', value: votingPeriodId },
      ],
    };
    const { resources } = await container.items.query<Nomination>(querySpec).fetchAll();
    return resources as Nomination[];
  }
}
