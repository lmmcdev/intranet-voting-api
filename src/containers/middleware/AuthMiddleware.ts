import { HttpRequest, InvocationContext } from "@azure/functions";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  roles: string[];
}

export class AuthMiddleware {
  private static readonly AZURE_AD_JWKS_URI = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
  private static readonly ISSUER = 'https://login.microsoftonline.com/{tenant-id}/v2.0';

  static async validateToken(request: HttpRequest, context: InvocationContext): Promise<AuthenticatedUser | null> {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        context.log('No Authorization header or invalid format');
        return null;
      }

      const token = authHeader.substring(7);
      
      // For local development, you can decode without verification
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
        const decoded = jwt.decode(token) as any;
        if (decoded) {
          return {
            userId: decoded.sub || decoded.oid || 'dev-user',
            email: decoded.email || decoded.preferred_username || decoded.upn || decoded.unique_name || 'dev@example.com',
            name: decoded.name || 'Dev User',
            roles: decoded.roles || decoded.groups || ['user']
          };
        }
      }

      // In production, verify the token properly
      // This is a simplified version - in production you should:
      // 1. Fetch and cache JWKS from Azure AD
      // 2. Verify token signature using the public key
      // 3. Validate issuer, audience, expiration, etc.
      
      const decoded = jwt.decode(token) as any;
      if (!decoded) {
        context.log('Failed to decode JWT token');
        return null;
      }

      // Basic validation - expand this for production
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        context.log('Token has expired');
        return null;
      }

      return {
        userId: decoded.sub || decoded.oid || decoded.userId,
        email: decoded.email || decoded.preferred_username || decoded.upn || decoded.unique_name || decoded.username,
        name: decoded.name || (decoded.given_name && decoded.family_name ? `${decoded.given_name} ${decoded.family_name}` : decoded.given_name || decoded.family_name) || 'Unknown User',
        roles: decoded.roles || decoded.groups || []
      };

    } catch (error) {
      context.error('Error validating token:', error);
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