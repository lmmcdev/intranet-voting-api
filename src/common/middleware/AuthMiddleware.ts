import { HttpRequest, InvocationContext } from '@azure/functions';
import { JWT_SECRET } from '../../config/env.config';
import jwt from 'jsonwebtoken';
import { TokenPayload } from '../../modules/auth/models/auth.model';

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

  static hasRole(user: AuthenticatedUser, requiredRole: string): boolean {
    return user.roles.includes(requiredRole);
  }

  static hasAnyRole(user: AuthenticatedUser, requiredRoles: string[]): boolean {
    return requiredRoles.some(role => user.roles.includes(role));
  }
}