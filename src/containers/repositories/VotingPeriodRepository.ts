import { VotingPeriod, VotingPeriodStatus } from "../models/VotingPeriod";
import { CosmosClient } from "../utils/CosmosClient";

export class VotingPeriodRepository {
  private cosmosClient: CosmosClient;
  private containerName = "votingPeriods";

  constructor(cosmosClient: CosmosClient) {
    this.cosmosClient = cosmosClient;
  }

  async create(votingPeriod: VotingPeriod): Promise<VotingPeriod> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.items.create(votingPeriod);
    return resource as VotingPeriod;
  }

  async findById(id: string): Promise<VotingPeriod | null> {
    try {
      const container = await this.cosmosClient.getContainer(
        this.containerName
      );
      const { resource } = await container.item(id, id).read<VotingPeriod>();
      return resource || null;
    } catch (error) {
      if ((error as any).code === 404) {
        return null;
      }
      throw error;
    }
  }

  async findActiveVotingPeriod(): Promise<VotingPeriod | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query:
        "SELECT * FROM c WHERE c.status = @status ORDER BY c.createdAt DESC",
      parameters: [{ name: "@status", value: VotingPeriodStatus.ACTIVE }],
    };

    const { resources } = await container.items
      .query<VotingPeriod>(querySpec)
      .fetchAll();
    return resources.length > 0 ? resources[0] : null;
  }

  async findByYearAndMonth(
    year: number,
    month: number
  ): Promise<VotingPeriod | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: "SELECT * FROM c WHERE c.year = @year AND c.month = @month",
      parameters: [
        { name: "@year", value: year },
        { name: "@month", value: month },
      ],
    };

    const { resources } = await container.items
      .query<VotingPeriod>(querySpec)
      .fetchAll();
    return resources.length > 0 ? resources[0] : null;
  }

  async findRecentPeriods(limit: number = 12): Promise<VotingPeriod[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: "SELECT * FROM c ORDER BY c.createdAt DESC",
      parameters: [],
    };

    const { resources } = await container.items
      .query<VotingPeriod>(querySpec)
      .fetchAll();
    return resources.slice(0, limit);
  }

  async update(id: string, votingPeriod: VotingPeriod): Promise<VotingPeriod> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.item(id, id).replace(votingPeriod);
    return resource as VotingPeriod;
  }

  async findExpiredActivePeriods(): Promise<VotingPeriod[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const now = new Date().toISOString();
    const querySpec = {
      query: "SELECT * FROM c WHERE c.status = @status AND c.endDate < @now",
      parameters: [
        { name: "@status", value: VotingPeriodStatus.ACTIVE },
        { name: "@now", value: now },
      ],
    };

    const { resources } = await container.items
      .query<VotingPeriod>(querySpec)
      .fetchAll();
    return resources;
  }
}
