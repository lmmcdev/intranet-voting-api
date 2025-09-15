import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AuthMiddleware, AuthenticatedUser } from "../middleware/AuthMiddleware";
import { ResponseHelper } from "./ResponseHelper";

type AuthResult<T = AuthenticatedUser> = 
  | { success: true; user: T }
  | { success: false; response: HttpResponseInit };

export class AuthHelper {
  static async requireAuth(
    request: HttpRequest,
    context: InvocationContext,
    requiredRoles: string[] = []
  ): Promise<AuthResult> {
    const user = await AuthMiddleware.validateToken(request, context);
    
    if (!user) {
      return { success: false, response: ResponseHelper.unauthorized("Authentication required") };
    }

    if (requiredRoles.length > 0 && !AuthMiddleware.hasAnyRole(user, requiredRoles)) {
      return { success: false, response: ResponseHelper.forbidden("Insufficient permissions") };
    }

    return { success: true, user };
  }

  static async requireRole(
    request: HttpRequest,
    context: InvocationContext,
    role: string
  ): Promise<AuthResult> {
    return this.requireAuth(request, context, [role]);
  }

  static extractUserFromRequest(request: HttpRequest): AuthenticatedUser | null {
    // This assumes the user was previously validated and stored in request context
    // In Azure Functions, you might store it differently
    return (request as any)._user || null;
  }
}