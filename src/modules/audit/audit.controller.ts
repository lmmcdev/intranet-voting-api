import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ResponseHelper } from '../../common/utils/ResponseHelper';
import { getDependencies } from '../../common/utils/Dependencies';
import { AuthHelper } from '../../common/utils/AuthHelper';
import { AuditEntity, AuditAction } from '../../common/models/AuditLog';

export class AuditController {
  private dependencies: any;

  constructor(dependencies: any) {
    this.dependencies = dependencies;
  }

  async getAuditLogs(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      // Only admins can view audit logs
      const user = authResult.user;
      if (!user.roles?.includes('admin')) {
        return ResponseHelper.forbidden('Admin access required');
      }

      const entityType = request.query.get('entityType') as AuditEntity | null;
      const entityId = request.query.get('entityId');
      const userId = request.query.get('userId');
      const action = request.query.get('action') as AuditAction | null;
      const limit = request.query.get('limit') ? parseInt(request.query.get('limit')!) : 100;

      let logs;

      if (entityType && entityId) {
        // Get logs for specific entity
        logs = await this.dependencies.auditService.getEntityAuditLogs(entityType, entityId);
      } else if (entityType) {
        // Get logs by entity type
        logs = await this.dependencies.auditService.getAuditLogsByEntityType(entityType, limit);
      } else if (userId) {
        // Get logs by user
        logs = await this.dependencies.auditService.getUserAuditLogs(userId, limit);
      } else if (action) {
        // Get logs by action
        logs = await this.dependencies.auditService.getAuditLogsByAction(action, limit);
      } else {
        // Get recent logs
        logs = await this.dependencies.auditService.getRecentAuditLogs(limit);
      }

      return ResponseHelper.ok(logs);
    } catch (error) {
      context.error('Error getting audit logs:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError();
    }
  }

  async getAuditLogsByDateRange(
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

      // Only admins can view audit logs
      const user = authResult.user;
      if (!user.roles?.includes('admin')) {
        return ResponseHelper.forbidden('Admin access required');
      }

      const startDateStr = request.query.get('startDate');
      const endDateStr = request.query.get('endDate');

      if (!startDateStr || !endDateStr) {
        return ResponseHelper.badRequest('startDate and endDate are required');
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return ResponseHelper.badRequest('Invalid date format');
      }

      const logs = await this.dependencies.auditService.getAuditLogsByDateRange(
        startDate,
        endDate
      );

      return ResponseHelper.ok(logs);
    } catch (error) {
      context.error('Error getting audit logs by date range:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError();
    }
  }
}

// Azure Functions endpoints
const getAuditLogsFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new AuditController(dependencies);
  return controller.getAuditLogs(request, context);
};

const getAuditLogsByDateRangeFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new AuditController(dependencies);
  return controller.getAuditLogsByDateRange(request, context);
};

// Register Azure Functions
app.http('get-audit-logs', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'audit/logs',
  handler: getAuditLogsFunction,
});

app.http('get-audit-logs-by-date-range', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'audit/logs/date-range',
  handler: getAuditLogsByDateRangeFunction,
});
