import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { EmployeeSyncService } from '../../common/EmployeeSyncService';
import { ResponseHelper } from '../../common/utils/ResponseHelper';
import { getDependencies } from '../../common/utils/Dependencies';
import { AuthHelper } from '../../common/utils/AuthHelper';
import { VotingGroupConfig } from '../configuration/models/voting-group-config.model';

export class EmployeeSyncController {
  private employeeSyncService: EmployeeSyncService;

  constructor(employeeSyncService: EmployeeSyncService) {
    this.employeeSyncService = employeeSyncService;
  }

  async syncAllEmployees(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'POST') {
        return ResponseHelper.methodNotAllowed();
      }

      /*   const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      } */

      context.log('Starting employee sync from CSV to Cosmos DB');
      const syncResult = await this.employeeSyncService.syncEmployeesFromAzure();

      context.log('Sync completed:', {
        newUsers: syncResult.newUsers,
        updatedUsers: syncResult.updatedUsers,
        totalProcessed: syncResult.totalProcessed,
        errors: syncResult.errors.length,
      });

      return ResponseHelper.ok({
        message: 'Employee sync completed',
        result: syncResult,
      });
    } catch (error) {
      context.error('Error during employee sync:', error);
      return ResponseHelper.internalServerError('Employee sync failed');
    }
  }

  async syncSingleEmployee(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'POST') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const employeeId = request.params.id;
      if (!employeeId) {
        return ResponseHelper.badRequest('Employee ID is required');
      }

      context.log(`Starting sync for employee: ${employeeId}`);
      const syncResult = await this.employeeSyncService.syncSingleEmployee(employeeId);

      if (syncResult.success) {
        context.log(`Employee sync completed for ${employeeId}:`, syncResult.message);
        return ResponseHelper.ok({
          message: syncResult.message,
          employee: syncResult.employee,
          matchedWithExternal: syncResult.matchedWithExternal ?? false,
        });
      } else {
        context.warn(`Employee sync failed for ${employeeId}:`, syncResult.message);
        return ResponseHelper.badRequest(syncResult.message);
      }
    } catch (error) {
      context.error('Error during single employee sync:', error);
      return ResponseHelper.internalServerError('Employee sync failed');
    }
  }

  async getSyncStatus(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const { azureEmployeeService, employeeRepository } = await getDependencies();

      const [azureCount, cosmosCount] = await Promise.all([
        azureEmployeeService.getEmployeeCount(),
        employeeRepository.count(),
      ]);

      return ResponseHelper.ok({
        azureEmployeeCount: azureCount,
        cosmosEmployeeCount: cosmosCount,
        syncNeeded: azureCount !== cosmosCount,
        lastSyncTime: null, // This could be stored in config or a separate table
      });
    } catch (error) {
      context.error('Error getting sync status:', error);
      return ResponseHelper.internalServerError('Failed to get sync status');
    }
  }

  async updateVotingGroups(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'POST') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      // Parse request body - now expects VotingGroupConfig
      const body = (await request.json()) as VotingGroupConfig;

      if (!body.strategy) {
        return ResponseHelper.badRequest('Strategy is required');
      }

      // Validate strategy
      const validStrategies = ['location', 'department', 'custom'];
      if (!validStrategies.includes(body.strategy)) {
        return ResponseHelper.badRequest(
          `Invalid strategy. Must be one of: ${validStrategies.join(', ')}`
        );
      }

      context.log('Updating voting groups with config:', body);

      const updateResult = await this.employeeSyncService.updateVotingGroups(body);

      if (updateResult.success) {
        context.log(`Voting groups updated: ${updateResult.totalUpdated} employees modified`);
        return ResponseHelper.ok({
          message: 'Voting groups updated successfully',
          result: updateResult,
        });
      } else {
        context.warn('Voting group update completed with errors:', updateResult.errors);
        const errorMessage = `Voting group update failed: ${updateResult.errors.join(', ')}`;
        return ResponseHelper.badRequest(errorMessage);
      }
    } catch (error) {
      context.error('Error updating voting groups:', error);
      return ResponseHelper.internalServerError('Failed to update voting groups');
    }
  }
}

// Azure Functions endpoints
const syncAllEmployeesFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { employeeSyncService } = await getDependencies();
  const controller = new EmployeeSyncController(employeeSyncService);
  return controller.syncAllEmployees(request, context);
};

const syncSingleEmployeeFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { employeeSyncService } = await getDependencies();
  const controller = new EmployeeSyncController(employeeSyncService);
  return controller.syncSingleEmployee(request, context);
};

const getSyncStatusFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { employeeSyncService } = await getDependencies();
  const controller = new EmployeeSyncController(employeeSyncService);
  return controller.getSyncStatus(request, context);
};

const updateVotingGroupsFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { employeeSyncService } = await getDependencies();
  const controller = new EmployeeSyncController(employeeSyncService);
  return controller.updateVotingGroups(request, context);
};

// Register Azure Functions
app.http('sync-all-employees', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees/sync',
  handler: syncAllEmployeesFunction,
});

app.http('sync-single-employee', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees/{id}/sync',
  handler: syncSingleEmployeeFunction,
});

app.http('get-sync-status', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees/sync/status',
  handler: getSyncStatusFunction,
});

app.http('update-voting-groups', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'employees/voting-groups/update',
  handler: updateVotingGroupsFunction,
});
