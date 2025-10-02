/**
 * Roles del sistema
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
  GUEST = 'guest',
}

/**
 * Permisos del sistema organizados por módulo
 */
export enum Permission {
  // Permisos de Empleados
  EMPLOYEE_READ = 'employee:read',
  EMPLOYEE_CREATE = 'employee:create',
  EMPLOYEE_UPDATE = 'employee:update',
  EMPLOYEE_DELETE = 'employee:delete',
  EMPLOYEE_SYNC = 'employee:sync',
  EMPLOYEE_MANAGE_ROLES = 'employee:manage_roles',

  // Permisos de Votación
  VOTING_READ = 'voting:read',
  VOTING_CREATE = 'voting:create',
  VOTING_UPDATE = 'voting:update',
  VOTING_DELETE = 'voting:delete',
  VOTING_MANAGE_PERIODS = 'voting:manage_periods',
  VOTING_VIEW_RESULTS = 'voting:view_results',
  VOTING_NOMINATE = 'voting:nominate',
  VOTING_VOTE = 'voting:vote',

  // Permisos de Nominaciones
  NOMINATION_READ = 'nomination:read',
  NOMINATION_CREATE = 'nomination:create',
  NOMINATION_UPDATE = 'nomination:update',
  NOMINATION_DELETE = 'nomination:delete',
  NOMINATION_APPROVE = 'nomination:approve',
  NOMINATION_REJECT = 'nomination:reject',

  // Permisos de Administración
  ADMIN_ACCESS = 'admin:access',
  ADMIN_SYSTEM_CONFIG = 'admin:system_config',
  ADMIN_VIEW_LOGS = 'admin:view_logs',
  ADMIN_MANAGE_USERS = 'admin:manage_users',

  // Permisos de Reportes
  REPORT_VIEW = 'report:view',
  REPORT_EXPORT = 'report:export',
  REPORT_ADVANCED = 'report:advanced',
}

/**
 * Mapeo de roles a permisos
 */
export const RolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // Tiene todos los permisos
    ...Object.values(Permission),
  ],

  [UserRole.ADMIN]: [
    // Permisos de empleados
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_CREATE,
    Permission.EMPLOYEE_UPDATE,
    Permission.EMPLOYEE_SYNC,
    Permission.EMPLOYEE_MANAGE_ROLES,

    // Permisos de votación
    Permission.VOTING_READ,
    Permission.VOTING_CREATE,
    Permission.VOTING_UPDATE,
    Permission.VOTING_MANAGE_PERIODS,
    Permission.VOTING_VIEW_RESULTS,
    Permission.VOTING_NOMINATE,
    Permission.VOTING_VOTE,

    // Permisos de nominaciones
    Permission.NOMINATION_READ,
    Permission.NOMINATION_CREATE,
    Permission.NOMINATION_UPDATE,
    Permission.NOMINATION_APPROVE,
    Permission.NOMINATION_REJECT,

    // Permisos de administración
    Permission.ADMIN_ACCESS,
    Permission.ADMIN_VIEW_LOGS,
    Permission.ADMIN_MANAGE_USERS,

    // Permisos de reportes
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.REPORT_ADVANCED,
  ],

  [UserRole.MODERATOR]: [
    // Permisos de empleados (solo lectura)
    Permission.EMPLOYEE_READ,

    // Permisos de votación
    Permission.VOTING_READ,
    Permission.VOTING_VIEW_RESULTS,
    Permission.VOTING_NOMINATE,
    Permission.VOTING_VOTE,

    // Permisos de nominaciones
    Permission.NOMINATION_READ,
    Permission.NOMINATION_CREATE,
    Permission.NOMINATION_APPROVE,
    Permission.NOMINATION_REJECT,

    // Permisos de reportes
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
  ],

  [UserRole.USER]: [
    // Permisos básicos de empleados
    Permission.EMPLOYEE_READ,

    // Permisos básicos de votación
    Permission.VOTING_READ,
    Permission.VOTING_NOMINATE,
    Permission.VOTING_VOTE,

    // Permisos básicos de nominaciones
    Permission.NOMINATION_READ,
    Permission.NOMINATION_CREATE,

    // Permisos básicos de reportes
    Permission.REPORT_VIEW,
  ],

  [UserRole.GUEST]: [
    // Solo lectura
    Permission.EMPLOYEE_READ,
    Permission.VOTING_READ,
    Permission.NOMINATION_READ,
  ],
};

/**
 * Jerarquía de roles (de mayor a menor privilegio)
 */
export const RoleHierarchy: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 5,
  [UserRole.ADMIN]: 4,
  [UserRole.MODERATOR]: 3,
  [UserRole.USER]: 2,
  [UserRole.GUEST]: 1,
};
