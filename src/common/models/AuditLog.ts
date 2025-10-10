export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  CLOSE = 'close',
  RESET = 'reset',
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate',
  STATUS_CHANGE = 'status_change',
}

export enum AuditEntity {
  VOTING_PERIOD = 'voting_period',
  EMPLOYEE = 'employee',
  NOMINATION = 'nomination',
  WINNER = 'winner',
}

export interface AuditLog {
  id: string;
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  userId: string;
  userName: string;
  userEmail?: string;
  timestamp: Date;
  changes?: AuditChange[];
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface CreateAuditLogDto {
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  userId: string;
  userName: string;
  userEmail?: string;
  changes?: AuditChange[];
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}
