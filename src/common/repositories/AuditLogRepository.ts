import { CosmosClient } from '../utils/CosmosClient';
import { AuditLog, AuditEntity, AuditAction } from '../models/AuditLog';

export class AuditLogRepository {
  private readonly containerName = 'auditLogs';

  constructor(private readonly cosmosClient: CosmosClient) {}

  async create(auditLog: AuditLog): Promise<AuditLog> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const { resource } = await container.items.create<AuditLog>(auditLog);
    return resource as AuditLog;
  }

  async findById(id: string): Promise<AuditLog | null> {
    try {
      const container = await this.cosmosClient.getContainer(this.containerName);
      const { resource } = await container.item(id, id).read<AuditLog>();
      return (resource as AuditLog) || null;
    } catch (error) {
      const err = error as { code?: number };
      if (err?.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async findByEntity(entityType: AuditEntity, entityId: string): Promise<AuditLog[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query:
        'SELECT * FROM c WHERE c.entityType = @entityType AND c.entityId = @entityId ORDER BY c.timestamp DESC',
      parameters: [
        { name: '@entityType', value: entityType },
        { name: '@entityId', value: entityId },
      ],
    };
    const { resources } = await container.items.query<AuditLog>(querySpec).fetchAll();
    return resources as AuditLog[];
  }

  async findByEntityType(entityType: AuditEntity, limit = 100): Promise<AuditLog[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT TOP @limit * FROM c WHERE c.entityType = @entityType ORDER BY c.timestamp DESC',
      parameters: [
        { name: '@entityType', value: entityType },
        { name: '@limit', value: limit },
      ],
    };
    const { resources } = await container.items.query<AuditLog>(querySpec).fetchAll();
    return resources as AuditLog[];
  }

  async findByUser(userId: string, limit = 100): Promise<AuditLog[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT TOP @limit * FROM c WHERE c.userId = @userId ORDER BY c.timestamp DESC',
      parameters: [
        { name: '@userId', value: userId },
        { name: '@limit', value: limit },
      ],
    };
    const { resources } = await container.items.query<AuditLog>(querySpec).fetchAll();
    return resources as AuditLog[];
  }

  async findByAction(action: AuditAction, limit = 100): Promise<AuditLog[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT TOP @limit * FROM c WHERE c.action = @action ORDER BY c.timestamp DESC',
      parameters: [
        { name: '@action', value: action },
        { name: '@limit', value: limit },
      ],
    };
    const { resources } = await container.items.query<AuditLog>(querySpec).fetchAll();
    return resources as AuditLog[];
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query:
        'SELECT * FROM c WHERE c.timestamp >= @startDate AND c.timestamp <= @endDate ORDER BY c.timestamp DESC',
      parameters: [
        { name: '@startDate', value: startDate.toISOString() },
        { name: '@endDate', value: endDate.toISOString() },
      ],
    };
    const { resources } = await container.items.query<AuditLog>(querySpec).fetchAll();
    return resources as AuditLog[];
  }

  async findRecent(limit = 100): Promise<AuditLog[]> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    const querySpec = {
      query: 'SELECT TOP @limit * FROM c ORDER BY c.timestamp DESC',
      parameters: [{ name: '@limit', value: limit }],
    };
    const { resources } = await container.items.query<AuditLog>(querySpec).fetchAll();
    return resources as AuditLog[];
  }

  async delete(id: string): Promise<void> {
    const container = await this.cosmosClient.getContainer(this.containerName);
    await container.item(id, id).delete();
  }
}
