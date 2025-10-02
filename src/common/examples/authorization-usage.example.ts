/**
 * EJEMPLOS DE USO DEL SISTEMA DE AUTORIZACIÓN
 *
 * Este archivo contiene ejemplos de cómo usar el sistema de roles y permisos
 * en los controladores de Azure Functions.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { UserRole, Permission } from '../constants/roles.constants';
import {
  RequireRoles,
  RequirePermissions,
  Public,
  RequireOwnership,
} from '../../modules/auth/decorators/auth.decorators';

/**
 * EJEMPLO 1: Endpoint público (no requiere autenticación)
 */
export class PublicController {
  @Public()
  async healthCheck(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    return {
      status: 200,
      jsonBody: { status: 'ok', message: 'Service is running' },
    };
  }
}

/**
 * EJEMPLO 2: Endpoint que requiere autenticación (cualquier usuario autenticado)
 */
export class AuthenticatedController {
  async getProfile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const user = await AuthMiddleware.validateToken(request, context);

    if (!user) {
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized', message: 'Authentication required' },
      };
    }

    return {
      status: 200,
      jsonBody: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        roles: user.roles,
        permissions: AuthMiddleware.getUserPermissions(user),
      },
    };
  }
}

/**
 * EJEMPLO 3: Endpoint que requiere roles específicos
 */
export class AdminController {
  @RequireRoles([UserRole.ADMIN, UserRole.SUPER_ADMIN])
  async deleteEmployee(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    const { user, response } = await AuthMiddleware.validateAuthorization(
      request,
      context,
      this,
      'deleteEmployee'
    );

    if (response) return response;

    const employeeId = request.params.id;

    // Lógica de eliminación
    return {
      status: 200,
      jsonBody: { message: 'Employee deleted successfully', employeeId },
    };
  }

  @RequireRoles([UserRole.SUPER_ADMIN], true) // requireAll = true
  async systemConfiguration(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    const { user, response } = await AuthMiddleware.validateAuthorization(
      request,
      context,
      this,
      'systemConfiguration'
    );

    if (response) return response;

    return {
      status: 200,
      jsonBody: { message: 'System configuration updated' },
    };
  }
}

/**
 * EJEMPLO 4: Endpoint que requiere permisos específicos
 */
export class VotingController {
  @RequirePermissions([Permission.VOTING_CREATE])
  async createVotingPeriod(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    const { user, response } = await AuthMiddleware.validateAuthorization(
      request,
      context,
      this,
      'createVotingPeriod'
    );

    if (response) return response;

    const body = await request.json();

    return {
      status: 201,
      jsonBody: { message: 'Voting period created', data: body },
    };
  }

  @RequirePermissions([Permission.VOTING_VOTE])
  async submitVote(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const { user, response } = await AuthMiddleware.validateAuthorization(
      request,
      context,
      this,
      'submitVote'
    );

    if (response) return response;

    return {
      status: 200,
      jsonBody: { message: 'Vote submitted successfully', voterId: user?.userId },
    };
  }
}

/**
 * EJEMPLO 5: Endpoint con validación de ownership (el usuario solo puede modificar sus propios datos)
 */
export class UserProfileController {
  @RequireOwnership('userId')
  async updateOwnProfile(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    const targetUserId = request.params.userId;

    const { user, response } = await AuthMiddleware.validateAuthorization(
      request,
      context,
      this,
      'updateOwnProfile',
      targetUserId
    );

    if (response) return response;

    const body = await request.json();

    return {
      status: 200,
      jsonBody: { message: 'Profile updated', userId: targetUserId },
    };
  }
}

/**
 * EJEMPLO 6: Validación manual de permisos en el código
 */
export class ManualAuthController {
  async complexOperation(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    const user = await AuthMiddleware.validateToken(request, context);

    if (!user) {
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized' },
      };
    }

    // Verificar permiso específico
    if (!AuthMiddleware.hasPermission(user, Permission.EMPLOYEE_UPDATE)) {
      return {
        status: 403,
        jsonBody: { error: 'Forbidden', message: 'Missing employee:update permission' },
      };
    }

    // Verificar múltiples permisos
    const requiredPermissions = [Permission.VOTING_MANAGE_PERIODS, Permission.VOTING_VIEW_RESULTS];
    if (!AuthMiddleware.hasAnyPermission(user, requiredPermissions)) {
      return {
        status: 403,
        jsonBody: { error: 'Forbidden', message: 'Missing voting permissions' },
      };
    }

    return {
      status: 200,
      jsonBody: { message: 'Operation completed' },
    };
  }
}

/**
 * EJEMPLO 7: Registro de funciones en Azure Functions
 */

// Función pública
app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const controller = new PublicController();
    return controller.healthCheck(request, context);
  },
});

// Función con autenticación básica
app.http('profile', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const controller = new AuthenticatedController();
    return controller.getProfile(request, context);
  },
});

// Función con roles requeridos
app.http('admin-delete-employee', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'admin/employees/{id}',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const controller = new AdminController();
    return controller.deleteEmployee(request, context);
  },
});

// Función con permisos requeridos
app.http('voting-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'voting/periods',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const controller = new VotingController();
    return controller.createVotingPeriod(request, context);
  },
});

// Función con ownership
app.http('user-update-profile', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'users/{userId}/profile',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const controller = new UserProfileController();
    return controller.updateOwnProfile(request, context);
  },
});
