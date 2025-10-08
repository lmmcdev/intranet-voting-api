import { CosmosClient } from '../../../common/utils/CosmosClient';
import { WinnerHistory, WinnerType } from '../../../common/models/WinnerHistory';

export class WinnerHistoryRepository {
  private readonly containerName = 'winnerHistory';

  constructor(private readonly cosmosClient: CosmosClient) {}

  async create(winner: WinnerHistory): Promise<WinnerHistory> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.items.create<WinnerHistory>(winner);
    return resource as WinnerHistory;
  }

  async findAll(): Promise<WinnerHistory[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c ORDER BY c.createdAt DESC',
    };
    const { resources } = await container.items.query<WinnerHistory>(querySpec).fetchAll();
    return resources as WinnerHistory[];
  }

  async findByVotingPeriod(votingPeriodId: string): Promise<WinnerHistory[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.votingPeriodId = @votingPeriodId',
      parameters: [{ name: '@votingPeriodId', value: votingPeriodId }],
    };
    const { resources } = await container.items.query<WinnerHistory>(querySpec).fetchAll();
    // Sort in memory by rank
    return (resources as WinnerHistory[]).sort((a, b) => a.rank - b.rank);
  }

  async findByYear(year: number): Promise<WinnerHistory[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.year = @year',
      parameters: [{ name: '@year', value: year }],
    };
    const { resources } = await container.items.query<WinnerHistory>(querySpec).fetchAll();
    // Sort in memory by month DESC, then rank ASC
    return (resources as WinnerHistory[]).sort((a, b) => {
      if (b.month !== a.month) {
        return b.month - a.month;
      }
      return a.rank - b.rank;
    });
  }

  async findByYearAndMonth(year: number, month: number): Promise<WinnerHistory[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.year = @year AND c.month = @month',
      parameters: [
        { name: '@year', value: year },
        { name: '@month', value: month },
      ],
    };
    const { resources } = await container.items.query<WinnerHistory>(querySpec).fetchAll();
    // Sort in memory by rank
    return (resources as WinnerHistory[]).sort((a, b) => a.rank - b.rank);
  }

  async deleteByVotingPeriod(votingPeriodId: string): Promise<void> {
    const winners = await this.findByVotingPeriod(votingPeriodId);
    const container = await this.cosmosClient.getContainer(this.containerName);

    for (const winner of winners) {
      await container.item(winner.id, winner.id).delete();
    }
  }

  async findGeneralWinners(): Promise<WinnerHistory[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.winnerType = @winnerType ORDER BY c.createdAt DESC',
      parameters: [{ name: '@winnerType', value: WinnerType.GENERAL }],
    };
    const { resources } = await container.items.query<WinnerHistory>(querySpec).fetchAll();
    return resources as WinnerHistory[];
  }

  async findGroupWinners(): Promise<WinnerHistory[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.winnerType = @winnerType ORDER BY c.createdAt DESC',
      parameters: [{ name: '@winnerType', value: WinnerType.BY_GROUP }],
    };
    const { resources } = await container.items.query<WinnerHistory>(querySpec).fetchAll();
    return resources as WinnerHistory[];
  }

  async findGeneralWinnerByPeriod(votingPeriodId: string): Promise<WinnerHistory | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query:
        'SELECT * FROM c WHERE c.votingPeriodId = @votingPeriodId AND c.winnerType = @winnerType',
      parameters: [
        { name: '@votingPeriodId', value: votingPeriodId },
        { name: '@winnerType', value: WinnerType.GENERAL },
      ],
    };
    const { resources } = await container.items.query<WinnerHistory>(querySpec).fetchAll();
    return resources.length > 0 ? (resources[0] as WinnerHistory) : null;
  }

  async findGroupWinnersByPeriod(votingPeriodId: string): Promise<WinnerHistory[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query:
        'SELECT * FROM c WHERE c.votingPeriodId = @votingPeriodId AND c.winnerType = @winnerType',
      parameters: [
        { name: '@votingPeriodId', value: votingPeriodId },
        { name: '@winnerType', value: WinnerType.BY_GROUP },
      ],
    };
    const { resources } = await container.items.query<WinnerHistory>(querySpec).fetchAll();
    // Sort in memory by rank
    return (resources as WinnerHistory[]).sort((a, b) => a.rank - b.rank);
  }

  async findYearlyWinners(): Promise<WinnerHistory[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.isYearlyWinner = true ORDER BY c.year DESC',
    };
    const { resources } = await container.items.query<WinnerHistory>(querySpec).fetchAll();
    return resources as WinnerHistory[];
  }

  async findYearlyWinnerByYear(year: number): Promise<WinnerHistory | null> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.isYearlyWinner = true AND c.year = @year',
      parameters: [{ name: '@year', value: year }],
    };
    const { resources } = await container.items.query<WinnerHistory>(querySpec).fetchAll();
    return resources.length > 0 ? (resources[0] as WinnerHistory) : null;
  }

  async markAsYearlyWinner(winnerId: string): Promise<WinnerHistory> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource: winner } = await container.item(winnerId, winnerId).read<WinnerHistory>();

    if (!winner) {
      throw new Error('Winner not found');
    }

    // Remove yearly winner flag from other winners of the same year
    const existingYearlyWinner = await this.findYearlyWinnerByYear(winner.year);
    if (existingYearlyWinner && existingYearlyWinner.id !== winnerId) {
      const updatedExisting = { ...existingYearlyWinner, isYearlyWinner: false };
      await container
        .item(existingYearlyWinner.id, existingYearlyWinner.id)
        .replace(updatedExisting);
    }

    // Mark the new yearly winner
    const updatedWinner = { ...winner, isYearlyWinner: true };
    const { resource } = await container.item(winnerId, winnerId).replace<WinnerHistory>(updatedWinner);
    return resource as WinnerHistory;
  }

  async unmarkAsYearlyWinner(winnerId: string): Promise<WinnerHistory> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource: winner } = await container.item(winnerId, winnerId).read<WinnerHistory>();

    if (!winner) {
      throw new Error('Winner not found');
    }

    const updatedWinner = { ...winner, isYearlyWinner: false };
    const { resource } = await container.item(winnerId, winnerId).replace<WinnerHistory>(updatedWinner);
    return resource as WinnerHistory;
  }
}
