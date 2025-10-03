import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ConfigurationService } from './configuration.service';
import { ResponseHelper } from '../../common/utils/ResponseHelper';
import { AuthHelper } from '../../common/utils/AuthHelper';
import { getDependencies } from '../../common/utils/Dependencies';
import { EligibilityConfig } from './models/eligibility-config.model';
import { VotingGroupConfig } from './models/voting-group-config.model';

export class ConfigurationController {
  constructor(private configurationService: ConfigurationService) {}

  async getEligibilityConfig(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const config = await this.configurationService.getEligibilityConfig();

      return ResponseHelper.ok({
        message: 'Eligibility configuration retrieved successfully',
        config,
      });
    } catch (error) {
      context.error('Error getting eligibility configuration:', error);
      return ResponseHelper.internalServerError('Failed to get eligibility configuration');
    }
  }

  async updateEligibilityConfig(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'PUT') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      // TODO: Add admin role check here
      // if (!authResult.user.isAdmin) {
      //   return ResponseHelper.forbidden('Only administrators can update configuration');
      // }

      const body = (await request.json()) as Partial<EligibilityConfig>;

      const updatedConfig = await this.configurationService.updateEligibilityConfig(body);

      context.log('Eligibility configuration updated:', updatedConfig);

      // Automatically update all employees' eligibility based on new configuration
      try {
        const { employeeSyncService } = await getDependencies();
        context.log('Updating employee eligibility based on new configuration...');

        const updateResult = await employeeSyncService.updateEligibility(updatedConfig);

        context.log(`Eligibility updated for ${updateResult.totalUpdated} employees`);

        return ResponseHelper.ok({
          message: 'Eligibility configuration updated successfully',
          config: updatedConfig,
          employeesUpdated: updateResult.totalUpdated,
          updateErrors: updateResult.errors,
        });
      } catch (syncError) {
        context.warn('Eligibility configuration saved but employee update failed:', syncError);
        return ResponseHelper.ok({
          message: 'Eligibility configuration updated, but employee update failed',
          config: updatedConfig,
          warning: 'Employees may need manual eligibility update',
        });
      }
    } catch (error) {
      context.error('Error updating eligibility configuration:', error);
      return ResponseHelper.internalServerError('Failed to update eligibility configuration');
    }
  }

  async resetEligibilityConfig(
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

      // TODO: Add admin role check here
      // if (!authResult.user.isAdmin) {
      //   return ResponseHelper.forbidden('Only administrators can reset configuration');
      // }

      const resetConfig = await this.configurationService.resetEligibilityConfig();

      context.log('Eligibility configuration reset to defaults');

      return ResponseHelper.ok({
        message: 'Eligibility configuration reset to defaults successfully',
        config: resetConfig,
      });
    } catch (error) {
      context.error('Error resetting eligibility configuration:', error);
      return ResponseHelper.internalServerError('Failed to reset eligibility configuration');
    }
  }

  async getVotingGroupConfig(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const config = await this.configurationService.getVotingGroupConfig();

      return ResponseHelper.ok({
        message: 'Voting group configuration retrieved successfully',
        config,
      });
    } catch (error) {
      context.error('Error getting voting group configuration:', error);
      return ResponseHelper.internalServerError('Failed to get voting group configuration');
    }
  }

  async updateVotingGroupConfig(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'PUT') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      // TODO: Add admin role check here

      const body = (await request.json()) as Partial<VotingGroupConfig>;

      const updatedConfig = await this.configurationService.updateVotingGroupConfig(body);

      context.log('Voting group configuration updated:', updatedConfig);

      // Automatically update all employees' voting groups based on new configuration
      try {
        const { employeeSyncService } = await getDependencies();
        context.log('Updating employee voting groups based on new configuration...');

        const updateResult = await employeeSyncService.updateVotingGroups(updatedConfig);

        context.log(`Voting groups updated for ${updateResult.totalUpdated} employees`);

        return ResponseHelper.ok({
          message: 'Voting group configuration updated successfully',
          config: updatedConfig,
          employeesUpdated: updateResult.totalUpdated,
          updateErrors: updateResult.errors,
        });
      } catch (syncError) {
        context.warn('Voting group configuration saved but employee update failed:', syncError);
        return ResponseHelper.ok({
          message: 'Voting group configuration updated, but employee update failed',
          config: updatedConfig,
          warning: 'Employees may need manual voting group update',
        });
      }
    } catch (error) {
      context.error('Error updating voting group configuration:', error);
      return ResponseHelper.internalServerError('Failed to update voting group configuration');
    }
  }

  async resetVotingGroupConfig(
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

      // TODO: Add admin role check here

      const resetConfig = await this.configurationService.resetVotingGroupConfig();

      context.log('Voting group configuration reset to defaults');

      return ResponseHelper.ok({
        message: 'Voting group configuration reset to defaults successfully',
        config: resetConfig,
      });
    } catch (error) {
      context.error('Error resetting voting group configuration:', error);
      return ResponseHelper.internalServerError('Failed to reset voting group configuration');
    }
  }
}

// Azure Functions endpoints - Consolidated handlers
const eligibilityConfigHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { configurationService } = await getDependencies();
  const controller = new ConfigurationController(configurationService);

  switch (request.method) {
    case 'GET':
      return controller.getEligibilityConfig(request, context);
    case 'PUT':
      return controller.updateEligibilityConfig(request, context);
    default:
      return ResponseHelper.methodNotAllowed();
  }
};

const eligibilityConfigResetHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { configurationService } = await getDependencies();
  const controller = new ConfigurationController(configurationService);
  return controller.resetEligibilityConfig(request, context);
};

const votingGroupConfigHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { configurationService } = await getDependencies();
  const controller = new ConfigurationController(configurationService);

  switch (request.method) {
    case 'GET':
      return controller.getVotingGroupConfig(request, context);
    case 'PUT':
      return controller.updateVotingGroupConfig(request, context);
    default:
      return ResponseHelper.methodNotAllowed();
  }
};

const votingGroupConfigResetHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { configurationService } = await getDependencies();
  const controller = new ConfigurationController(configurationService);
  return controller.resetVotingGroupConfig(request, context);
};

// Register Azure Functions
app.http('eligibility-config', {
  methods: ['GET', 'PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'configuration/eligibility',
  handler: eligibilityConfigHandler,
});

app.http('eligibility-config-reset', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'configuration/eligibility/reset',
  handler: eligibilityConfigResetHandler,
});

app.http('voting-group-config', {
  methods: ['GET', 'PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'configuration/voting-groups',
  handler: votingGroupConfigHandler,
});

app.http('voting-group-config-reset', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'configuration/voting-groups/reset',
  handler: votingGroupConfigResetHandler,
});
