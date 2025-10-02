import { EligibilityConfigRepository } from './repositories/EligibilityConfigRepository';
import { VotingGroupConfigRepository } from './repositories/VotingGroupConfigRepository';
import { EligibilityConfig } from './models/eligibility-config.model';
import { VotingGroupConfig } from './models/voting-group-config.model';

export class ConfigurationService {
  constructor(
    private eligibilityConfigRepository: EligibilityConfigRepository,
    private votingGroupConfigRepository: VotingGroupConfigRepository
  ) {}

  // Eligibility Configuration Methods
  async getEligibilityConfig(): Promise<EligibilityConfig> {
    return this.eligibilityConfigRepository.getConfig();
  }

  async updateEligibilityConfig(config: Partial<EligibilityConfig>): Promise<EligibilityConfig> {
    // Validate input
    if (config.minimumDaysForEligibility !== undefined && config.minimumDaysForEligibility < 0) {
      throw new Error('minimumDaysForEligibility must be >= 0');
    }

    return this.eligibilityConfigRepository.upsertConfig(config);
  }

  async resetEligibilityConfig(): Promise<EligibilityConfig> {
    return this.eligibilityConfigRepository.resetToDefaults();
  }

  // Voting Group Configuration Methods
  async getVotingGroupConfig(): Promise<VotingGroupConfig> {
    return this.votingGroupConfigRepository.getConfig();
  }

  async updateVotingGroupConfig(config: Partial<VotingGroupConfig>): Promise<VotingGroupConfig> {
    // Validate strategy
    if (config.strategy && !['location', 'department', 'custom'].includes(config.strategy)) {
      throw new Error('strategy must be one of: location, department, custom');
    }

    return this.votingGroupConfigRepository.upsertConfig(config);
  }

  async resetVotingGroupConfig(): Promise<VotingGroupConfig> {
    return this.votingGroupConfigRepository.resetToDefaults();
  }
}
