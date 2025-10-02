import { EligibilityConfig, DEFAULT_ELIGIBILITY_CONFIG } from '../models/eligibility-config.model';
import { CosmosClient } from '../../../common/utils/CosmosClient';

export class EligibilityConfigRepository {
  private readonly containerName = 'configuration';
  private readonly configId = 'eligibility';

  constructor(private readonly cosmosClient: CosmosClient) {}

  /**
   * Get the eligibility configuration. Returns default config if not found.
   */
  async getConfig(): Promise<EligibilityConfig> {
    try {
      const container = await this.cosmosClient.getContainer(this.containerName);
      const { resource } = await container.item(this.configId, this.configId).read<EligibilityConfig>();
      return resource || DEFAULT_ELIGIBILITY_CONFIG;
    } catch (error) {
      const err = error as { code?: number };
      if (err?.code === 404) {
        // Config doesn't exist, return default
        return DEFAULT_ELIGIBILITY_CONFIG;
      }
      throw error;
    }
  }

  /**
   * Update or create the eligibility configuration
   */
  async upsertConfig(config: Partial<EligibilityConfig>): Promise<EligibilityConfig> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    const currentConfig = await this.getConfig();

    const updatedConfig: EligibilityConfig = {
      ...currentConfig,
      ...config,
      id: this.configId, // Ensure ID is always 'eligibility'
      updatedAt: new Date(),
    };

    // Set createdAt only if it doesn't exist
    if (!updatedConfig.createdAt) {
      updatedConfig.createdAt = new Date();
    }

    const { resource } = await container.items.upsert<EligibilityConfig>(updatedConfig);
    return resource as EligibilityConfig;
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<EligibilityConfig> {
    const container = await this.cosmosClient.getContainer(this.containerName);

    const config: EligibilityConfig = {
      ...DEFAULT_ELIGIBILITY_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { resource } = await container.items.upsert<EligibilityConfig>(config);
    return resource as EligibilityConfig;
  }
}
