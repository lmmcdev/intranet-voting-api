import {
  VotingGroupConfig,
  DEFAULT_VOTING_GROUP_CONFIG,
} from '../models/voting-group-config.model';
import { CosmosClient } from '../../../common/utils/CosmosClient';

export class VotingGroupConfigRepository {
  private readonly containerName = 'configuration';
  private readonly configId = 'voting-group';

  constructor(private readonly cosmosClient: CosmosClient) {}

  /**
   * Get the voting group configuration. Returns default config if not found.
   */
  async getConfig(): Promise<VotingGroupConfig> {
    try {
      const container = await this.cosmosClient.getContainer(this.containerName);
      const { resource } = await container
        .item(this.configId, this.configId)
        .read<VotingGroupConfig>();
      return resource || DEFAULT_VOTING_GROUP_CONFIG;
    } catch (error) {
      const err = error as { code?: number };
      if (err?.code === 404) {
        // Config doesn't exist, return default
        return DEFAULT_VOTING_GROUP_CONFIG;
      }
      throw error;
    }
  }

  /**
   * Update or create the voting group configuration
   */
  async upsertConfig(config: Partial<VotingGroupConfig>): Promise<VotingGroupConfig> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    const currentConfig = await this.getConfig();

    const updatedConfig: VotingGroupConfig = {
      ...currentConfig,
      ...config,
      id: this.configId, // Ensure ID is always 'voting-group'
      updatedAt: new Date(),
    };

    // Set createdAt only if it doesn't exist
    if (!updatedConfig.createdAt) {
      updatedConfig.createdAt = new Date();
    }

    const { resource } = await container.items.upsert<VotingGroupConfig>(updatedConfig);
    return resource as VotingGroupConfig;
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<VotingGroupConfig> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    const config: VotingGroupConfig = {
      ...DEFAULT_VOTING_GROUP_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { resource } = await container.items.upsert<VotingGroupConfig>(config);
    return resource as VotingGroupConfig;
  }
}
