import 'reflect-metadata';
import { HttpRequest, InvocationContext, HttpResponseInit } from '@azure/functions';
import { JWT_SECRET } from '../../config/env.config';
import jwt from 'jsonwebtoken';
import { TokenPayload } from '../../modules/auth/models/auth.model';
import { AuthorizationService } from '../services/AuthorizationService';
import { Permission } from '../constants/roles.constants';
import { AUTH_METADATA_KEY, AuthMetadata } from '../../modules/auth/decorators/auth.decorators';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  username?: string;
  name?: string;
  roles: string[];
  votingGroup?: string;
}

export class AuthMiddleware {
  static async validateToken(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<AuthenticatedUser | null> {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        context.log('No Authorization header or invalid format');
        return null;
      }

      const token = authHeader.substring(7);

      // Verify token using JWT_SECRET
      const decoded = jwt.verify(token, JWT_SECRET || 'default-secret') as TokenPayload;

      if (!decoded || !decoded.userId) {
        context.log('Invalid token payload');
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        username: decoded.username,
        name: decoded.username,
        roles: decoded.roles || ['user'],
        votingGroup: decoded.votingGroup,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        context.log('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        context.log('Invalid token:', error.message);
      } else {
        context.error('Error validating token:', error);
      }
      return null;
    }
  }

  /**
   * Valida autenticación y autorización basada en decoradores
   */
  static async validateAuthorization(
    request: HttpRequest,
    context: InvocationContext,
    target: any,
    methodName: string,
    resourceOwnerId?: string
  ): Promise<{ user: AuthenticatedUser | null; response?: HttpResponseInit }> {
    // Verificar si el endpoint es público
    const isPublic = Reflect.getMetadata('auth:public', target, methodName);
    if (isPublic) {
      return { user: null };
    }

    // Validar token
    const user = await this.validateToken(request, context);
    if (!user) {
      return {
        user: null,
        response: {
          status: 401,
          jsonBody: {
            error: 'Unauthorized',
            message: 'Authentication required',
          },
        },
      };
    }

    // Obtener metadatos de autorización
    const authMetadata: AuthMetadata = Reflect.getMetadata(AUTH_METADATA_KEY, target, methodName);

    // Si no hay metadatos, solo requiere autenticación
    if (!authMetadata) {
      return { user };
    }

    // Verificar ownership si está configurado
    const ownershipParam = Reflect.getMetadata('auth:ownership', target, methodName);
    const allowOwnership = !!ownershipParam;

    // Autorizar basado en roles y permisos
    const authResult = AuthorizationService.authorize(user, {
      roles: authMetadata.roles,
      permissions: authMetadata.permissions,
      requireAll: authMetadata.requireAll,
      allowOwnership,
      ownerId: resourceOwnerId,
    });

    if (!authResult.authorized) {
      return {
        user,
        response: {
          status: 403,
          jsonBody: {
            error: 'Forbidden',
            message: authResult.message,
            missingRoles: authResult.missingRoles,
            missingPermissions: authResult.missingPermissions,
          },
        },
      };
    }

    return { user };
  }

  /**
   * Verifica si el usuario tiene un rol específico (mantener para compatibilidad)
   */
  static hasRole(user: AuthenticatedUser, requiredRole: string): boolean {
    return user.roles.includes(requiredRole);
  }

  /**
   * Verifica si el usuario tiene al menos uno de los roles (mantener para compatibilidad)
   */
  static hasAnyRole(user: AuthenticatedUser, requiredRoles: string[]): boolean {
    return requiredRoles.some(role => user.roles.includes(role));
  }

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  static hasPermission(user: AuthenticatedUser, permission: Permission): boolean {
    return AuthorizationService.hasPermission(user, permission);
  }

  /**
   * Verifica si el usuario tiene al menos uno de los permisos
   */
  static hasAnyPermission(user: AuthenticatedUser, permissions: Permission[]): boolean {
    return AuthorizationService.hasAnyPermission(user, permissions);
  }

  /**
   * Obtiene todos los permisos del usuario
   */
  static getUserPermissions(user: AuthenticatedUser): Permission[] {
    return AuthorizationService.getUserPermissions(user);
  }
}
