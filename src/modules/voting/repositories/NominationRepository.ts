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
   * Find nominations by voting period with offset-based pagination
   *
   * NOTE: We use OFFSET/LIMIT pagination because Cosmos DB Node.js SDK does not support
   * continuation tokens for ORDER BY queries in cross-partition scenarios.
   * This is a known limitation: https://github.com/Azure/azure-sdk-for-js/issues/12308
   *
   * @param votingPeriodId - The voting period ID
   * @param maxItemCount - Number of items per page (default: 10)
   * @param continuationToken - Base64 encoded offset token from previous page
   * @returns Query result with items and continuation token
   */
  async findByVotingPeriodPaginated(
    votingPeriodId: string,
    maxItemCount: number = 10,
    continuationToken?: string
  ): Promise<CosmosQueryResult<Nomination>> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    // Decode continuation token to get offset
    let offset = 0;
    if (continuationToken) {
      try {
        const decoded = Buffer.from(continuationToken, 'base64').toString('utf-8');
        const tokenData = JSON.parse(decoded);
        offset = tokenData.offset || 0;
      } catch (error) {
        console.error('Failed to decode continuation token:', error);
        offset = 0;
      }
    }

    // Query for current page + 1 extra item to check if more exist
    const querySpec = {
      query: `SELECT * FROM c
              WHERE c.votingPeriodId = @votingPeriodId
              ORDER BY c.createdAt DESC
              OFFSET ${offset} LIMIT ${maxItemCount + 1}`,
      parameters: [
        { name: '@votingPeriodId', value: votingPeriodId },
      ],
    };

    const { resources } = await container.items.query<Nomination>(querySpec).fetchAll();

    // Check if there are more results
    const hasMore = resources.length > maxItemCount;
    const nominations = hasMore ? resources.slice(0, maxItemCount) : resources;

    // Create continuation token for next page
    const nextToken = hasMore
      ? Buffer.from(JSON.stringify({ offset: offset + maxItemCount })).toString('base64')
      : undefined;

    console.log('[NominationRepository] Offset pagination result:', {
      offset,
      requestedCount: maxItemCount,
      fetchedCount: resources.length,
      returnedCount: nominations.length,
      hasMore,
      hasContinuationToken: !!nextToken
    });

    return {
      resources: nominations as Nomination[],
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
