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
