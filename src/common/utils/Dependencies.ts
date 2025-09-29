import { CosmosClient } from "./CosmosClient";
import { EmployeeRepository } from "../../modules/employee/repositories/EmployeeRepository";
import { NominationRepository } from "../../modules/voting/repositories/NominationRepository";
import { VotingPeriodRepository } from "../../modules/voting/repositories/VotingPeriodRepository";
import { EmployeeDirectoryService } from "../../modules/employee/services/EmployeeDirectoryService";
import { EmployeeService } from "../../modules/employee/employee.service";
import { AzureEmployeeService } from "../AzureEmployeeService";
import { EmployeeSyncService } from "../EmployeeSyncService";
import { VotingService } from "../VotingService";
import { ValidationService } from "../ValidationService";
import { NotificationService } from "../NotificationService";
import {
  COSMOS_DB_ENDPOINT,
  COSMOS_DB_KEY,
  COSMOS_DB_NAME,
} from "../../config/env.config";
import { EMPLOYEE_DIRECTORY_CSV_PATH } from "../../config/env.config";

interface Dependencies {
  cosmosClient: CosmosClient;
  employeeRepository: EmployeeRepository;
  nominationRepository: NominationRepository;
  votingPeriodRepository: VotingPeriodRepository;
  employeeService: EmployeeService;
  azureEmployeeService: AzureEmployeeService;
  employeeSyncService: EmployeeSyncService;
  votingService: VotingService;
  validationService: ValidationService;
  notificationService: NotificationService;
  employeeDirectoryService: EmployeeDirectoryService;
}

let dependencies: Dependencies | null = null;

export async function getDependencies(): Promise<Dependencies> {
  if (!dependencies) {
    const endpoint = COSMOS_DB_ENDPOINT;
    const key = COSMOS_DB_KEY;
    const databaseId = COSMOS_DB_NAME;

    if (!endpoint || !key) {
      throw new Error(
        "COSMOS_DB_ENDPOINT and COSMOS_DB_KEY environment variables are required"
      );
    }

    const cosmosClient = new CosmosClient(endpoint, key, databaseId);

    // Initialize database and containers
    await cosmosClient.createDatabaseIfNotExists();
    await cosmosClient.initializeContainers();

    const employeeRepository = new EmployeeRepository(cosmosClient);
    const nominationRepository = new NominationRepository(cosmosClient);
    const votingPeriodRepository = new VotingPeriodRepository(cosmosClient);

    const employeeService = new EmployeeService(employeeRepository);
    const azureEmployeeService = new AzureEmployeeService();
    const employeeDirectoryService = new EmployeeDirectoryService(
      EMPLOYEE_DIRECTORY_CSV_PATH || undefined
    );
    const validationService = new ValidationService(
      nominationRepository,
      azureEmployeeService
    );
    const notificationService = new NotificationService();
    const employeeSyncService = new EmployeeSyncService(
      azureEmployeeService,
      employeeRepository,
      employeeDirectoryService
    );
    const votingService = new VotingService(
      nominationRepository,
      votingPeriodRepository,
      azureEmployeeService,
      validationService,
      notificationService
    );

    dependencies = {
      cosmosClient,
      employeeRepository,
      nominationRepository,
      votingPeriodRepository,
      employeeService,
      azureEmployeeService,
      employeeSyncService,
      votingService,
      validationService,
      notificationService,
      employeeDirectoryService,
    };
  }

  return dependencies;
}

export function resetDependencies(): void {
  dependencies = null;
}
