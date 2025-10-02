import {
  CosmosClient as CosmosSDKClient,
  Container,
  Database,
  PartitionKeyKind,
} from "@azure/cosmos";

export class CosmosClient {
  private client: CosmosSDKClient;
  private database: Database;
  private databaseId: string;

  constructor(endpoint: string, key: string, databaseId: string) {
    const options: any = { endpoint, key };
    
    // For local emulator, disable SSL verification
    if (endpoint.startsWith('http://localhost') || endpoint.startsWith('http://127.0.0.1')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    
    this.client = new CosmosSDKClient(options);
    this.databaseId = databaseId;
    this.database = this.client.database(databaseId);
  }

  async getContainer(containerId: string): Promise<Container> {
    const { container } = await this.database.containers.createIfNotExists({
      id: containerId,
      partitionKey: {
        paths: ["/id"],
        kind: PartitionKeyKind.Hash
      },
    });
    return container;
  }

  async createDatabaseIfNotExists(): Promise<void> {
    await this.client.databases.createIfNotExists({
      id: this.databaseId,
    });
  }

  async initializeContainers(): Promise<void> {
    const containers = ["employees", "nominations", "votingPeriods"];

    for (const containerId of containers) {
      await this.getContainer(containerId);
    }
  }
}
