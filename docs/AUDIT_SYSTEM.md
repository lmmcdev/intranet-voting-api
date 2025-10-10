# Sistema de Auditoría - Intranet Voting API

## 📋 Descripción General

El sistema de auditoría registra automáticamente todas las acciones importantes realizadas en la aplicación, incluyendo quién realizó la acción, cuándo y qué cambios específicos se hicieron.

## 🎯 Entidades Auditadas

### Voting Periods
- ✅ Actualización de periodo (`UPDATE`)
- ✅ Cierre de periodo (`CLOSE`)
- ✅ Reset de periodo (`RESET`)

### Employees
- ✅ Actualización de información (`UPDATE`)

## 📊 Estructura de un Log de Auditoría

```typescript
{
  id: string;                    // ID único del log
  entityType: AuditEntity;       // Tipo de entidad (voting_period, employee, etc.)
  entityId: string;              // ID de la entidad modificada
  action: AuditAction;           // Acción realizada (update, close, reset, etc.)
  userId: string;                // ID del usuario que realizó la acción
  userName: string;              // Nombre del usuario
  userEmail?: string;            // Email del usuario
  timestamp: Date;               // Fecha y hora de la acción
  changes?: AuditChange[];       // Cambios específicos realizados
  metadata?: Record<string, any>; // Información adicional contextual
}
```

### Ejemplo de Log - Cierre de Periodo

```json
{
  "id": "1699876543210abc",
  "entityType": "voting_period",
  "entityId": "1699876543210xyz",
  "action": "close",
  "userId": "admin@lmmc.com",
  "userName": "Juan Pérez",
  "userEmail": "admin@lmmc.com",
  "timestamp": "2025-10-10T15:30:00.000Z",
  "changes": [
    {
      "field": "status",
      "oldValue": "active",
      "newValue": "closed"
    }
  ],
  "metadata": {
    "year": 2024,
    "month": 10,
    "closedAt": "2025-10-10T15:30:00.000Z"
  }
}
```

### Ejemplo de Log - Actualización de Periodo

```json
{
  "id": "1699876543211def",
  "entityType": "voting_period",
  "entityId": "1699876543210xyz",
  "action": "update",
  "userId": "admin@lmmc.com",
  "userName": "María González",
  "userEmail": "admin@lmmc.com",
  "timestamp": "2025-10-10T14:20:00.000Z",
  "changes": [
    {
      "field": "endDate",
      "oldValue": "2024-10-31T23:59:59.000Z",
      "newValue": "2024-11-05T23:59:59.000Z"
    },
    {
      "field": "description",
      "oldValue": null,
      "newValue": "Periodo extendido por solicitud del equipo"
    }
  ],
  "metadata": {
    "year": 2024,
    "month": 10,
    "status": "active"
  }
}
```

### Ejemplo de Log - Reset de Periodo

```json
{
  "id": "1699876543212ghi",
  "entityType": "voting_period",
  "entityId": "1699876543210xyz",
  "action": "reset",
  "userId": "superadmin@lmmc.com",
  "userName": "Admin Principal",
  "userEmail": "superadmin@lmmc.com",
  "timestamp": "2025-10-10T16:00:00.000Z",
  "metadata": {
    "year": 2024,
    "month": 10,
    "nominationsDeleted": 45,
    "winnersDeleted": 3
  }
}
```

## 🔌 Endpoints de API

### 1. Obtener Logs de Auditoría

**Endpoint:** `GET /api/audit/logs`

**Acceso:** Solo administradores

**Query Parameters:**
- `entityType` (opcional): Filtrar por tipo de entidad (`voting_period`, `employee`, `nomination`, `winner`)
- `entityId` (opcional): ID de la entidad específica
- `userId` (opcional): ID del usuario que realizó la acción
- `action` (opcional): Tipo de acción (`create`, `update`, `delete`, `close`, `reset`)
- `limit` (opcional): Número máximo de resultados (default: 100, max: 100)

**Ejemplos de Uso:**

```bash
# Obtener los últimos 50 logs de auditoría
GET /api/audit/logs?limit=50

# Obtener todos los logs de voting periods
GET /api/audit/logs?entityType=voting_period

# Obtener el historial de un periodo específico
GET /api/audit/logs?entityType=voting_period&entityId=1699876543210xyz

# Obtener todas las acciones de un usuario
GET /api/audit/logs?userId=admin@lmmc.com

# Obtener todos los cierres de periodo
GET /api/audit/logs?action=close

# Combinar filtros
GET /api/audit/logs?entityType=voting_period&action=update&limit=20
```

**Respuesta Exitosa (200):**
```json
[
  {
    "id": "...",
    "entityType": "voting_period",
    "entityId": "...",
    "action": "update",
    "userId": "...",
    "userName": "...",
    "userEmail": "...",
    "timestamp": "...",
    "changes": [...],
    "metadata": {...}
  }
]
```

### 2. Obtener Logs por Rango de Fechas

**Endpoint:** `GET /api/audit/logs/date-range`

**Acceso:** Solo administradores

**Query Parameters (Requeridos):**
- `startDate`: Fecha inicio (formato ISO 8601: YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss.sssZ)
- `endDate`: Fecha fin (formato ISO 8601)

**Ejemplos de Uso:**

```bash
# Obtener logs de todo el mes de octubre 2024
GET /api/audit/logs/date-range?startDate=2024-10-01&endDate=2024-10-31

# Obtener logs de las últimas 24 horas
GET /api/audit/logs/date-range?startDate=2025-10-09T15:30:00.000Z&endDate=2025-10-10T15:30:00.000Z

# Obtener logs del último trimestre
GET /api/audit/logs/date-range?startDate=2024-07-01&endDate=2024-09-30
```

## 💡 Casos de Uso

### 1. Investigar quién cerró un periodo de votación

```bash
# Buscar el periodo específico
GET /api/audit/logs?entityType=voting_period&entityId={PERIOD_ID}&action=close
```

### 2. Ver todo lo que un usuario ha modificado

```bash
# Obtener todas las acciones de un usuario
GET /api/audit/logs?userId=usuario@lmmc.com&limit=100
```

### 3. Auditoría de cambios en un mes específico

```bash
# Obtener todos los cambios de octubre 2024
GET /api/audit/logs/date-range?startDate=2024-10-01&endDate=2024-10-31
```

### 4. Monitorear resets de periodos

```bash
# Ver todos los resets (acción crítica)
GET /api/audit/logs?action=reset
```

### 5. Historial completo de un periodo de votación

```bash
# Ver todo el historial de un periodo específico
GET /api/audit/logs?entityType=voting_period&entityId={PERIOD_ID}
```

## 🔒 Seguridad

- ✅ Solo usuarios con rol `admin` pueden acceder a los logs de auditoría
- ✅ Los logs son inmutables (no se pueden modificar ni eliminar vía API)
- ✅ Si el registro de auditoría falla, la operación principal continúa (no bloquea)
- ✅ Los errores de auditoría se registran en console para debugging

## 📦 Almacenamiento

- Los logs se almacenan en Cosmos DB en el container `auditLogs`
- Partition key: `/id`
- Los logs se mantienen indefinidamente (considerar política de retención futura)

## 🔧 Configuración en Código

### Para agregar auditoría a nuevas operaciones:

```typescript
// En el servicio
import { AuditService } from '../../common/services/AuditService';
import { AuditEntity, AuditAction } from '../../common/models/AuditLog';

// Agregar al constructor
constructor(
  // ... otros parámetros
  private auditService?: AuditService
) {}

// En el método que quieres auditar
async miMetodo(
  id: string,
  data: any,
  userContext?: { userId: string; userName: string; userEmail?: string }
) {
  // ... lógica del método

  // Registrar en auditoría
  if (this.auditService && userContext) {
    try {
      await this.auditService.log({
        entityType: AuditEntity.VOTING_PERIOD,
        entityId: id,
        action: AuditAction.UPDATE,
        userId: userContext.userId,
        userName: userContext.userName,
        userEmail: userContext.userEmail,
        changes: [...], // opcional
        metadata: {...}, // opcional
      });
    } catch (error) {
      console.error('Failed to log audit:', error);
    }
  }

  return result;
}
```

### En el controlador:

```typescript
async miEndpoint(request: HttpRequest, context: InvocationContext) {
  const authResult = await AuthHelper.requireAuth(request, context);
  const user = authResult.user;

  await this.service.miMetodo(id, data, {
    userId: user.userId,
    userName: user.username || user.email || 'unknown',
    userEmail: user.email || undefined,
  });
}
```

## 📈 Tipos de Acciones Disponibles

```typescript
enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  CLOSE = 'close',
  RESET = 'reset',
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate',
  STATUS_CHANGE = 'status_change',
}
```

## 🎯 Tipos de Entidades Disponibles

```typescript
enum AuditEntity {
  VOTING_PERIOD = 'voting_period',
  EMPLOYEE = 'employee',
  NOMINATION = 'nomination',
  WINNER = 'winner',
}
```

## 🚀 Próximas Mejoras (Futuro)

- [ ] Dashboard de auditoría en el frontend
- [ ] Notificaciones para acciones críticas (resets, etc.)
- [ ] Exportación de logs a Excel/CSV
- [ ] Política de retención automática de logs antiguos
- [ ] Búsqueda full-text en logs
- [ ] Métricas y estadísticas de uso

---

**Creado:** 2025-10-10
**Versión:** 1.0
