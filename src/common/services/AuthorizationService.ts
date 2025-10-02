import { UserRole, Permission, RolePermissions, RoleHierarchy } from '../constants/roles.constants';
import { AuthenticatedUser } from '../middleware/AuthMiddleware';

export interface AuthorizationResult {
  authorized: boolean;
  message?: string;
  missingPermissions?: Permission[];
  missingRoles?: UserRole[];
}

/**
 * Servicio de autorización para validar roles y permisos
 */
export class AuthorizationService {
  /**
   * Verifica si un usuario tiene un rol específico
   */
  static hasRole(user: AuthenticatedUser, role: UserRole): boolean {
    if (!user || !user.roles) return false;
    return user.roles.includes(role);
  }

  /**
   * Verifica si un usuario tiene al menos uno de los roles especificados
   */
  static hasAnyRole(user: AuthenticatedUser, roles: UserRole[]): boolean {
    if (!user || !user.roles || roles.length === 0) return false;
    return roles.some(role => user.roles.includes(role));
  }

  /**
   * Verifica si un usuario tiene todos los roles especificados
   */
  static hasAllRoles(user: AuthenticatedUser, roles: UserRole[]): boolean {
    if (!user || !user.roles || roles.length === 0) return false;
    return roles.every(role => user.roles.includes(role));
  }

  /**
   * Obtiene todos los permisos de un usuario basados en sus roles
   */
  static getUserPermissions(user: AuthenticatedUser): Permission[] {
    if (!user || !user.roles) return [];

    const permissions = new Set<Permission>();

    user.roles.forEach(role => {
      const rolePerms = RolePermissions[role as UserRole];
      if (rolePerms) {
        rolePerms.forEach(perm => permissions.add(perm));
      }
    });

    return Array.from(permissions);
  }

  /**
   * Verifica si un usuario tiene un permiso específico
   */
  static hasPermission(user: AuthenticatedUser, permission: Permission): boolean {
    const userPermissions = this.getUserPermissions(user);
    return userPermissions.includes(permission);
  }

  /**
   * Verifica si un usuario tiene al menos uno de los permisos especificados
   */
  static hasAnyPermission(user: AuthenticatedUser, permissions: Permission[]): boolean {
    if (!permissions || permissions.length === 0) return false;
    const userPermissions = this.getUserPermissions(user);
    return permissions.some(perm => userPermissions.includes(perm));
  }

  /**
   * Verifica si un usuario tiene todos los permisos especificados
   */
  static hasAllPermissions(user: AuthenticatedUser, permissions: Permission[]): boolean {
    if (!permissions || permissions.length === 0) return false;
    const userPermissions = this.getUserPermissions(user);
    return permissions.every(perm => userPermissions.includes(perm));
  }

  /**
   * Verifica la autorización completa basada en roles y permisos
   */
  static authorize(
    user: AuthenticatedUser | null,
    options: {
      roles?: UserRole[];
      permissions?: Permission[];
      requireAll?: boolean;
      allowOwnership?: boolean;
      ownerId?: string;
    }
  ): AuthorizationResult {
    if (!user) {
      return {
        authorized: false,
        message: 'User not authenticated',
      };
    }

    // Verificar ownership si está habilitado
    if (options.allowOwnership && options.ownerId) {
      if (user.userId === options.ownerId) {
        return { authorized: true };
      }
    }

    // Verificar roles
    if (options.roles && options.roles.length > 0) {
      const hasRequiredRoles = options.requireAll
        ? this.hasAllRoles(user, options.roles)
        : this.hasAnyRole(user, options.roles);

      if (!hasRequiredRoles) {
        const missingRoles = options.roles.filter(role => !user.roles.includes(role));
        return {
          authorized: false,
          message: `User lacks required role(s): ${missingRoles.join(', ')}`,
          missingRoles,
        };
      }
    }

    // Verificar permisos
    if (options.permissions && options.permissions.length > 0) {
      const hasRequiredPermissions = options.requireAll
        ? this.hasAllPermissions(user, options.permissions)
        : this.hasAnyPermission(user, options.permissions);

      if (!hasRequiredPermissions) {
        const userPermissions = this.getUserPermissions(user);
        const missingPermissions = options.permissions.filter(
          perm => !userPermissions.includes(perm)
        );
        return {
          authorized: false,
          message: `User lacks required permission(s): ${missingPermissions.join(', ')}`,
          missingPermissions,
        };
      }
    }

    return { authorized: true };
  }

  /**
   * Verifica si un usuario tiene un rol con nivel superior o igual al especificado
   */
  static hasRoleLevel(user: AuthenticatedUser, minRole: UserRole): boolean {
    if (!user || !user.roles) return false;

    const minLevel = RoleHierarchy[minRole];
    return user.roles.some(role => {
      const userLevel = RoleHierarchy[role as UserRole];
      return userLevel >= minLevel;
    });
  }

  /**
   * Obtiene el nivel de rol más alto del usuario
   */
  static getHighestRoleLevel(user: AuthenticatedUser): number {
    if (!user || !user.roles || user.roles.length === 0) return 0;

    return Math.max(
      ...user.roles.map(role => RoleHierarchy[role as UserRole] || 0)
    );
  }

  /**
   * Verifica si el usuario puede realizar una acción sobre otro usuario
   * Basado en jerarquía de roles
   */
  static canManageUser(actor: AuthenticatedUser, targetUser: AuthenticatedUser): boolean {
    const actorLevel = this.getHighestRoleLevel(actor);
    const targetLevel = this.getHighestRoleLevel(targetUser);

    // Solo puede gestionar usuarios de nivel inferior
    return actorLevel > targetLevel;
  }

  /**
   * Verifica permisos de recurso específico
   */
  static canAccessResource(
    user: AuthenticatedUser,
    resourceOwnerId: string,
    requiredPermission: Permission
  ): boolean {
    // Si es el dueño del recurso, puede acceder
    if (user.userId === resourceOwnerId) return true;

    // Si no, debe tener el permiso requerido
    return this.hasPermission(user, requiredPermission);
  }
}
