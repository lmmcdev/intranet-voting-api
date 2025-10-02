import { CosmosClient } from '../../common/utils/CosmosClient';
import { EligibilityConfigRepository } from './repositories/EligibilityConfigRepository';
import { VotingGroupConfigRepository } from './repositories/VotingGroupConfigRepository';
import { ConfigurationService } from './configuration.service';

/**
 * Configuration Module
 *
 * Provides centralized access to configuration repositories and services.
 * This module manages both eligibility and voting group configurations.
 */
export class ConfigurationModule {
  private static instance: ConfigurationModule;

  private eligibilityConfigRepository: EligibilityConfigRepository;
  private votingGroupConfigRepository: VotingGroupConfigRepository;
  private configurationService: ConfigurationService;

  private constructor(cosmosClient: CosmosClient) {
    this.eligibilityConfigRepository = new EligibilityConfigRepository(cosmosClient);
    this.votingGroupConfigRepository = new VotingGroupConfigRepository(cosmosClient);
    this.configurationService = new ConfigurationService(
      this.eligibilityConfigRepository,
      this.votingGroupConfigRepository
    );
  }

  /**
   * Initialize the configuration module with a Cosmos DB client
   */
  static initialize(cosmosClient: CosmosClient): ConfigurationModule {
    if (!ConfigurationModule.instance) {
      ConfigurationModule.instance = new ConfigurationModule(cosmosClient);
    }
    return ConfigurationModule.instance;
  }

  /**
   * Get the singleton instance of the configuration module
   */
  static getInstance(): ConfigurationModule {
    if (!ConfigurationModule.instance) {
      throw new Error('ConfigurationModule not initialized. Call initialize() first.');
    }
    return ConfigurationModule.instance;
  }

  /**
   * Get the eligibility configuration repository
   */
  getEligibilityConfigRepository(): EligibilityConfigRepository {
    return this.eligibilityConfigRepository;
  }

  /**
   * Get the voting group configuration repository
   */
  getVotingGroupConfigRepository(): VotingGroupConfigRepository {
    return this.votingGroupConfigRepository;
  }

  /**
   * Get the configuration service
   */
  getConfigurationService(): ConfigurationService {
    return this.configurationService;
  }

  /**
   * Reset the module instance (useful for testing)
   */
  static reset(): void {
    ConfigurationModule.instance = undefined as any;
  }
}
