import { CosmosClient } from './CosmosClient';
import { EmployeeRepository } from '../../modules/employee/repositories/EmployeeRepository';
import { NominationRepository } from '../../modules/voting/repositories/NominationRepository';
import { VotingPeriodRepository } from '../../modules/voting/repositories/VotingPeriodRepository';
import { WinnerHistoryRepository } from '../../modules/voting/repositories/WinnerHistoryRepository';
import { EligibilityConfigRepository } from '../../modules/configuration/repositories/EligibilityConfigRepository';
import { VotingGroupConfigRepository } from '../../modules/configuration/repositories/VotingGroupConfigRepository';
import { EmployeeDirectoryService } from '../../modules/employee/services/EmployeeDirectoryService';
import { EmployeeService } from '../../modules/employee/employee.service';
import { AzureEmployeeService } from '../AzureEmployeeService';
import { EmployeeSyncService } from '../EmployeeSyncService';
import { VotingGroupService } from '../VotingGroupService';
import { VotingService } from '../../modules/voting/services/VotingService';
import { ValidationService } from '../../modules/voting/services/ValidationService';
import { NotificationService } from '../../modules/voting/services/NotificationService';
import { ConfigurationService } from '../../modules/configuration/configuration.service';
import { AuthService } from '../../modules/auth/auth.service';
import {
  COSMOS_DB_ENDPOINT,
  COSMOS_DB_KEY,
  COSMOS_DB_NAME,
  EMPLOYEE_DIRECTORY_CSV_PATH,
} from '../../config/env.config';

interface Dependencies {
  cosmosClient: CosmosClient;
  employeeRepository: EmployeeRepository;
  nominationRepository: NominationRepository;
  votingPeriodRepository: VotingPeriodRepository;
  winnerHistoryRepository: WinnerHistoryRepository;
  eligibilityConfigRepository: EligibilityConfigRepository;
  votingGroupConfigRepository: VotingGroupConfigRepository;
  employeeService: EmployeeService;
  azureEmployeeService: AzureEmployeeService;
  employeeSyncService: EmployeeSyncService;
  votingService: VotingService;
  validationService: ValidationService;
  notificationService: NotificationService;
  employeeDirectoryService: EmployeeDirectoryService;
  votingGroupService: VotingGroupService;
  configurationService: ConfigurationService;
  authService: AuthService;
}

let dependencies: Dependencies | null = null;

export async function getDependencies(): Promise<Dependencies> {
  if (!dependencies) {
    const endpoint = COSMOS_DB_ENDPOINT;
    const key = COSMOS_DB_KEY;
    const databaseId = COSMOS_DB_NAME;

    if (!endpoint || !key) {
      throw new Error('COSMOS_DB_ENDPOINT and COSMOS_DB_KEY environment variables are required');
    }

    const cosmosClient = new CosmosClient(endpoint, key, databaseId);

    // Initialize database and containers
    await cosmosClient.createDatabaseIfNotExists();
    await cosmosClient.initializeContainers();

    const employeeRepository = new EmployeeRepository(cosmosClient);
    const nominationRepository = new NominationRepository(cosmosClient);
    const votingPeriodRepository = new VotingPeriodRepository(cosmosClient);
    const winnerHistoryRepository = new WinnerHistoryRepository(cosmosClient);
    const eligibilityConfigRepository = new EligibilityConfigRepository(cosmosClient);
    const votingGroupConfigRepository = new VotingGroupConfigRepository(cosmosClient);

    const configurationService = new ConfigurationService(
      eligibilityConfigRepository,
      votingGroupConfigRepository
    );

    const employeeService = new EmployeeService(employeeRepository, configurationService);
    const azureEmployeeService = new AzureEmployeeService();

    // Load configurations from database
    const eligibilityConfig = await eligibilityConfigRepository.getConfig();
    const votingGroupConfig = await votingGroupConfigRepository.getConfig();

    const employeeDirectoryService = new EmployeeDirectoryService(
      EMPLOYEE_DIRECTORY_CSV_PATH || undefined,
      eligibilityConfig
    );
    const votingGroupService = new VotingGroupService(votingGroupConfig);

    const validationService = new ValidationService(nominationRepository, employeeRepository);
    const notificationService = new NotificationService();
    const employeeSyncService = new EmployeeSyncService(
      azureEmployeeService,
      employeeRepository,
      employeeDirectoryService,
      votingGroupService
    );
    const votingService = new VotingService(
      nominationRepository,
      votingPeriodRepository,
      winnerHistoryRepository,
      azureEmployeeService,
      validationService,
      notificationService,
      employeeService,
      configurationService
    );
    const authService = new AuthService(employeeRepository);

    dependencies = {
      cosmosClient,
      employeeRepository,
      nominationRepository,
      votingPeriodRepository,
      winnerHistoryRepository,
      eligibilityConfigRepository,
      votingGroupConfigRepository,
      employeeService,
      azureEmployeeService,
      employeeSyncService,
      votingService,
      validationService,
      notificationService,
      employeeDirectoryService,
      votingGroupService,
      configurationService,
      authService,
    };
  }

  return dependencies!;
}

export function resetDependencies(): void {
  dependencies = null;
}
