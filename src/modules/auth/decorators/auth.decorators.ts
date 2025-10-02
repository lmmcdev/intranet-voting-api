import 'reflect-metadata';
import { UserRole, Permission } from '../../../common/constants/roles.constants';

/**
 * Metadatos para almacenar información de autorización
 */
export interface AuthMetadata {
  roles?: UserRole[];
  permissions?: Permission[];
  requireAll?: boolean; // Si true, requiere todos los roles/permisos; si false, requiere al menos uno
}

/**
 * Símbolo único para almacenar metadatos de autorización
 */
export const AUTH_METADATA_KEY = Symbol('auth:metadata');

/**
 * Decorador para requerir roles específicos en un endpoint
 * @param roles - Roles requeridos
 * @param requireAll - Si true, requiere todos los roles; si false, requiere al menos uno (default: false)
 *
 * @example
 * ```typescript
 * @RequireRoles([UserRole.ADMIN, UserRole.SUPER_ADMIN])
 * async deleteEmployee(req: HttpRequest, context: InvocationContext) {
 *   // Solo admins y super admins pueden acceder
 * }
 * ```
 */
export function RequireRoles(roles: UserRole[], requireAll: boolean = false) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const metadata: AuthMetadata =
      Reflect.getMetadata(AUTH_METADATA_KEY, target, propertyKey) || {};
    metadata.roles = roles;
    metadata.requireAll = requireAll;
    Reflect.defineMetadata(AUTH_METADATA_KEY, metadata, target, propertyKey);
    return descriptor;
  };
}

/**
 * Decorador para requerir permisos específicos en un endpoint
 * @param permissions - Permisos requeridos
 * @param requireAll - Si true, requiere todos los permisos; si false, requiere al menos uno (default: false)
 *
 * @example
 * ```typescript
 * @RequirePermissions([Permission.EMPLOYEE_DELETE])
 * async deleteEmployee(req: HttpRequest, context: InvocationContext) {
 *   // Solo usuarios con permiso de eliminación pueden acceder
 * }
 * ```
 */
export function RequirePermissions(permissions: Permission[], requireAll: boolean = false) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const metadata: AuthMetadata =
      Reflect.getMetadata(AUTH_METADATA_KEY, target, propertyKey) || {};
    metadata.permissions = permissions;
    metadata.requireAll = requireAll;
    Reflect.defineMetadata(AUTH_METADATA_KEY, metadata, target, propertyKey);
    return descriptor;
  };
}

/**
 * Decorador para marcar un endpoint como público (no requiere autenticación)
 *
 * @example
 * ```typescript
 * @Public()
 * async healthCheck(req: HttpRequest, context: InvocationContext) {
 *   // Endpoint público
 * }
 * ```
 */
export function Public() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('auth:public', true, target, propertyKey);
    return descriptor;
  };
}

/**
 * Decorador para verificar que el usuario autenticado es el mismo que se está modificando
 * @param paramName - Nombre del parámetro en la request que contiene el userId
 *
 * @example
 * ```typescript
 * @RequireOwnership('userId')
 * async updateProfile(req: HttpRequest, context: InvocationContext) {
 *   // Solo el usuario puede modificar su propio perfil
 * }
 * ```
 */
export function RequireOwnership(paramName: string = 'userId') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('auth:ownership', paramName, target, propertyKey);
    return descriptor;
  };
}
