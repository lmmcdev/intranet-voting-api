import { AuditLogRepository } from '../repositories/AuditLogRepository';
import {
  AuditLog,
  AuditEntity,
  AuditAction,
  CreateAuditLogDto,
  AuditChange,
} from '../models/AuditLog';

export class AuditService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  /**
   * Create an audit log entry
   */
  async log(data: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog: AuditLog = {
      id: this.generateId(),
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
      timestamp: new Date(),
      changes: data.changes,
      metadata: data.metadata,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    };

    return await this.auditLogRepository.create(auditLog);
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityAuditLogs(entityType: AuditEntity, entityId: string): Promise<AuditLog[]> {
    return await this.auditLogRepository.findByEntity(entityType, entityId);
  }

  /**
   * Get audit logs by entity type
   */
  async getAuditLogsByEntityType(entityType: AuditEntity, limit = 100): Promise<AuditLog[]> {
    return await this.auditLogRepository.findByEntityType(entityType, limit);
  }

  /**
   * Get audit logs by user
   */
  async getUserAuditLogs(userId: string, limit = 100): Promise<AuditLog[]> {
    return await this.auditLogRepository.findByUser(userId, limit);
  }

  /**
   * Get audit logs by action
   */
  async getAuditLogsByAction(action: AuditAction, limit = 100): Promise<AuditLog[]> {
    return await this.auditLogRepository.findByAction(action, limit);
  }

  /**
   * Get audit logs by date range
   */
  async getAuditLogsByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    return await this.auditLogRepository.findByDateRange(startDate, endDate);
  }

  /**
   * Get recent audit logs
   */
  async getRecentAuditLogs(limit = 100): Promise<AuditLog[]> {
    return await this.auditLogRepository.findRecent(limit);
  }

  /**
   * Helper to detect changes between old and new objects
   */
  detectChanges(oldObject: any, newObject: any, fieldsToTrack?: string[]): AuditChange[] {
    const changes: AuditChange[] = [];

    if (!oldObject || !newObject) {
      return changes;
    }

    const fields = fieldsToTrack || Object.keys(newObject);

    for (const field of fields) {
      // Skip internal fields
      if (field === 'id' || field === 'updatedAt' || field === 'createdAt') {
        continue;
      }

      const oldValue = oldObject[field];
      const newValue = newObject[field];

      // Compare values (handle dates, objects, etc.)
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field,
          oldValue: this.sanitizeValue(oldValue),
          newValue: this.sanitizeValue(newValue),
        });
      }
    }

    return changes;
  }

  /**
   * Sanitize sensitive values before logging
   */
  private sanitizeValue(value: any): any {
    if (value === undefined) return null;
    if (value === null) return null;

    // Handle dates
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle objects (stringify for logging)
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return value;
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}
