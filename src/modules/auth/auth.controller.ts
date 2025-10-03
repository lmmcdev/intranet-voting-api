import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from './auth.service';
import { ResponseHelper } from '../../common/utils/ResponseHelper';
import { getDependencies } from '../../common/utils/Dependencies';
import { LoginCredentials } from './models/auth.model';
import { ChangePasswordRequest } from './models/change-password.model';

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  async login(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'POST') {
        return ResponseHelper.methodNotAllowed();
      }

      const body = (await request.json()) as LoginCredentials;

      if (!body.username || !body.password) {
        return ResponseHelper.badRequest('Username and password are required');
      }

      context.log(`Login attempt for username: ${body.username}`);

      const result = await this.authService.login({
        username: body.username,
        password: body.password,
      });

      if (!result.success) {
        context.warn(`Login failed for username: ${body.username} - ${result.message}`);
        return ResponseHelper.unauthorized(result.message || 'Authentication failed');
      }

      context.log(`Login successful for username: ${body.username}`);

      return ResponseHelper.ok({
        message: 'Login successful',
        token: result.token,
        requirePasswordChange: result.requirePasswordChange,
        user: {
          id: result.employee?.id,
          username: result.employee?.username,
          fullName: result.employee?.fullName,
          email: result.employee?.email,
          roles: result.employee?.roles,
          department: result.employee?.department,
          position: result.employee?.position,
          votingGroup: result.employee?.votingGroup,
        },
      });
    } catch (error) {
      context.error('Error during login:', error);
      return ResponseHelper.internalServerError('Login failed');
    }
  }

  async verifyToken(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ResponseHelper.unauthorized('No token provided');
      }

      const token = authHeader.substring(7);
      const payload = this.authService.verifyToken(token);

      if (!payload) {
        return ResponseHelper.unauthorized('Invalid or expired token');
      }

      return ResponseHelper.ok({
        valid: true,
        payload,
      });
    } catch (error) {
      context.error('Error verifying token:', error);
      return ResponseHelper.internalServerError('Token verification failed');
    }
  }

  async changePassword(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'POST') {
        return ResponseHelper.methodNotAllowed();
      }

      // Verify token
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ResponseHelper.unauthorized('No token provided');
      }

      const token = authHeader.substring(7);
      const payload = this.authService.verifyToken(token);

      if (!payload) {
        return ResponseHelper.unauthorized('Invalid or expired token');
      }

      const body = (await request.json()) as ChangePasswordRequest;

      if (!body.oldPassword || !body.newPassword) {
        return ResponseHelper.badRequest('Old password and new password are required');
      }

      if (body.newPassword.length < 7) {
        return ResponseHelper.badRequest('New password must be at least 7 characters');
      }

      context.log(`Password change attempt for user: ${payload.userId}`);

      const result = await this.authService.changePassword(
        payload.userId,
        body.oldPassword,
        body.newPassword
      );

      if (!result.success) {
        context.warn(`Password change failed for user: ${payload.userId} - ${result.message}`);
        return ResponseHelper.badRequest(result.message || 'Password change failed');
      }

      context.log(`Password changed successfully for user: ${payload.userId}`);

      return ResponseHelper.ok({
        message: result.message || 'Password changed successfully',
      });
    } catch (error) {
      context.error('Error during password change:', error);
      return ResponseHelper.internalServerError('Password change failed');
    }
  }

  async resetPasswordToDefault(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'POST') {
        return ResponseHelper.methodNotAllowed();
      }

      // Verify token and check for admin role
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ResponseHelper.unauthorized('No token provided');
      }

      const token = authHeader.substring(7);
      const payload = this.authService.verifyToken(token);

      if (!payload) {
        return ResponseHelper.unauthorized('Invalid or expired token');
      }

      // Check if user has admin or super_admin role
      const roles = payload.roles || [];
      const isAdmin = roles.includes('admin') || roles.includes('super_admin');

      if (!isAdmin) {
        return ResponseHelper.unauthorized('Only administrators can reset passwords');
      }

      const employeeId = request.params.id;
      if (!employeeId) {
        return ResponseHelper.badRequest('Employee ID is required');
      }

      context.log(`Password reset attempt for employee: ${employeeId} by admin: ${payload.userId}`);

      const result = await this.authService.resetPasswordToDefault(employeeId);

      if (!result.success) {
        context.warn(`Password reset failed for employee: ${employeeId} - ${result.message}`);
        return ResponseHelper.badRequest(result.message || 'Password reset failed');
      }

      context.log(`Password reset successfully for employee: ${employeeId}`);

      return ResponseHelper.ok({
        message: result.message || 'Password reset successfully',
      });
    } catch (error) {
      context.error('Error during password reset:', error);
      return ResponseHelper.internalServerError('Password reset failed');
    }
  }

  async bulkResetPasswords(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'POST') {
        return ResponseHelper.methodNotAllowed();
      }

      // Verify token and check for admin role
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ResponseHelper.unauthorized('No token provided');
      }

      const token = authHeader.substring(7);
      const payload = this.authService.verifyToken(token);

      if (!payload) {
        return ResponseHelper.unauthorized('Invalid or expired token');
      }

      // Check if user has admin or super_admin role
      const roles = payload.roles || [];
      const isAdmin = roles.includes('admin') || roles.includes('super_admin');

      if (!isAdmin) {
        return ResponseHelper.unauthorized('Only administrators can reset passwords');
      }

      // Get optional filters from query params or body
      const filters: {
        isActive?: boolean;
        department?: string;
        position?: string;
        location?: string;
        votingGroup?: string;
      } = {};

      // Try to get filters from body first
      let bodyFilters: any = {};
      try {
        bodyFilters = (await request.json()) || {};
      } catch {
        // No body, use query params
      }

      // Apply filters from body or query params
      if (bodyFilters.isActive !== undefined) {
        filters.isActive = bodyFilters.isActive;
      } else {
        const isActiveParam = request.query.get('isActive');
        if (isActiveParam !== null) {
          filters.isActive = isActiveParam.toLowerCase() === 'true';
        }
      }

      if (bodyFilters.department) {
        filters.department = bodyFilters.department;
      } else {
        const department = request.query.get('department');
        if (department) filters.department = department;
      }

      if (bodyFilters.position) {
        filters.position = bodyFilters.position;
      } else {
        const position = request.query.get('position');
        if (position) filters.position = position;
      }

      if (bodyFilters.location) {
        filters.location = bodyFilters.location;
      } else {
        const location = request.query.get('location');
        if (location) filters.location = location;
      }

      if (bodyFilters.votingGroup) {
        filters.votingGroup = bodyFilters.votingGroup;
      } else {
        const votingGroup = request.query.get('votingGroup');
        if (votingGroup) filters.votingGroup = votingGroup;
      }

      context.log(`Bulk password reset attempt by admin: ${payload.userId} with filters:`, filters);

      const result = await this.authService.bulkResetPasswordsToDefault(filters);

      context.log(
        `Bulk password reset completed: ${result.totalReset} employees updated, ${result.errors.length} errors`
      );

      if (result.totalReset === 0) {
        return ResponseHelper.ok({
          message: 'No employees matched the filters',
          totalReset: 0,
          errors: result.errors,
          defaultPassword: result.defaultPassword,
        });
      }

      return ResponseHelper.ok({
        message: `Successfully reset passwords for ${result.totalReset} employees`,
        totalReset: result.totalReset,
        errors: result.errors,
        defaultPassword: result.defaultPassword,
      });
    } catch (error) {
      context.error('Error during bulk password reset:', error);
      return ResponseHelper.internalServerError('Bulk password reset failed');
    }
  }
}

// Azure Functions endpoints
const loginFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { authService } = await getDependencies();
  const controller = new AuthController(authService);
  return await controller.login(request, context);
};

const verifyTokenFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { authService } = await getDependencies();
  const controller = new AuthController(authService);
  return controller.verifyToken(request, context);
};

const changePasswordFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { authService } = await getDependencies();
  const controller = new AuthController(authService);
  return controller.changePassword(request, context);
};

const resetPasswordToDefaultFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { authService } = await getDependencies();
  const controller = new AuthController(authService);
  return controller.resetPasswordToDefault(request, context);
};

const bulkResetPasswordsFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const { authService } = await getDependencies();
  const controller = new AuthController(authService);
  return controller.bulkResetPasswords(request, context);
};

// Register Azure Functions
app.http('login', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: loginFunction,
});

app.http('verify-token', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/verify',
  handler: verifyTokenFunction,
});

app.http('change-password', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/change-password',
  handler: changePasswordFunction,
});

app.http('reset-password-to-default', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/reset-password/{id}',
  handler: resetPasswordToDefaultFunction,
});

app.http('bulk-reset-passwords', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/bulk-reset-passwords',
  handler: bulkResetPasswordsFunction,
});
