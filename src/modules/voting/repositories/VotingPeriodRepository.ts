import { CosmosClient } from '../../../common/utils/CosmosClient';
import { VotingPeriod, VotingPeriodStatus } from '../../../common/models/VotingPeriod';

export class VotingPeriodRepository {
  private readonly containerName = 'votingPeriods';

  constructor(private readonly cosmosClient: CosmosClient) {}

  async create(votingPeriod: VotingPeriod): Promise<VotingPeriod> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.items.create<VotingPeriod>(votingPeriod);
    return resource as VotingPeriod;
  }

  async findById(id: string): Promise<VotingPeriod | null> {
    try {
      const container = await this.cosmosClient.getContainer(this.containerName);
      const { resource } = await container.item(id, id).read<VotingPeriod>();
      return (resource as VotingPeriod) || null;
    } catch (error) {
      const err = error as { code?: number };
      if (err?.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async findActiveVotingPeriod(): Promise<VotingPeriod | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.status = @status ORDER BY c.createdAt DESC',
      parameters: [{ name: '@status', value: VotingPeriodStatus.ACTIVE }],
    };
    const { resources } = await container.items.query<VotingPeriod>(querySpec).fetchAll();
    return resources.length > 0 ? (resources[0] as VotingPeriod) : null;
  }

  async findByYearAndMonth(year: number, month: number): Promise<VotingPeriod | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.year = @year AND c.month = @month',
      parameters: [
        { name: '@year', value: year },
        { name: '@month', value: month },
      ],
    };
    const { resources } = await container.items.query<VotingPeriod>(querySpec).fetchAll();
    return resources.length > 0 ? (resources[0] as VotingPeriod) : null;
  }

  async findRecentPeriods(limit = 12): Promise<VotingPeriod[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c ORDER BY c.createdAt DESC',
      parameters: [],
    };
    const { resources } = await container.items.query<VotingPeriod>(querySpec).fetchAll();
    return (resources as VotingPeriod[]).slice(0, limit);
  }

  async update(id: string, votingPeriod: VotingPeriod): Promise<VotingPeriod> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.item(id, id).replace<VotingPeriod>(votingPeriod);
    return resource as VotingPeriod;
  }

  async findExpiredActivePeriods(): Promise<VotingPeriod[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const now = new Date().toISOString();
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.status = @status AND c.endDate < @now',
      parameters: [
        { name: '@status', value: VotingPeriodStatus.ACTIVE },
        { name: '@now', value: now },
      ],
    };
    const { resources } = await container.items.query<VotingPeriod>(querySpec).fetchAll();
    return resources as VotingPeriod[];
  }

  async delete(id: string): Promise<void> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    await container.item(id, id).delete();
  }
}
