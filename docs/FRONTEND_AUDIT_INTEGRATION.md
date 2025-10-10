# Integración de Auditoría con el Frontend

## 🎯 Endpoint Principal para el Frontend

### **Obtener Historial de Auditoría de un Periodo**

```
GET /api/voting/{votingPeriodId}/audit-history
```

**Autenticación:** Requerida (cualquier usuario autenticado)

**Ejemplo de Uso:**
```javascript
// Para el periodo vp-2025-10
GET /api/voting/vp-2025-10/audit-history
```

## 📊 Respuesta Esperada

```json
[
  {
    "id": "1728567890123abc",
    "entityType": "voting_period",
    "entityId": "vp-2025-10",
    "action": "update",
    "userId": "admin@lmmc.com",
    "userName": "María González",
    "userEmail": "admin@lmmc.com",
    "timestamp": "2025-10-03T14:20:00.000Z",
    "changes": [
      {
        "field": "endDate",
        "oldValue": "2025-10-31T23:59:59.000Z",
        "newValue": "2025-10-10T23:59:59.000Z"
      }
    ],
    "metadata": {
      "year": 2025,
      "month": 10,
      "status": "closed"
    }
  },
  {
    "id": "1728667890456def",
    "entityType": "voting_period",
    "entityId": "vp-2025-10",
    "action": "close",
    "userId": "admin@lmmc.com",
    "userName": "Juan Pérez",
    "userEmail": "admin@lmmc.com",
    "timestamp": "2025-10-10T16:30:00.000Z",
    "changes": [
      {
        "field": "status",
        "oldValue": "active",
        "newValue": "closed"
      }
    ],
    "metadata": {
      "year": 2025,
      "month": 10,
      "closedAt": "2025-10-10T16:30:00.000Z"
    }
  }
]
```

## 🎨 Componente React de Ejemplo

```typescript
import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  userName: string;
  userEmail?: string;
  timestamp: string;
  changes?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  metadata?: Record<string, any>;
}

interface VotingPeriodAuditHistoryProps {
  votingPeriodId: string;
}

const VotingPeriodAuditHistory: React.FC<VotingPeriodAuditHistoryProps> = ({
  votingPeriodId
}) => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditHistory();
  }, [votingPeriodId]);

  const fetchAuditHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/voting/${votingPeriodId}/audit-history`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al cargar el historial de auditoría');
      }

      const data = await response.json();
      setAuditLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      create: 'Creación',
      update: 'Actualización',
      delete: 'Eliminación',
      close: 'Cierre',
      reset: 'Reinicio',
      activate: 'Activación',
      deactivate: 'Desactivación',
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string): string => {
    const colors: Record<string, string> = {
      create: 'bg-green-100 text-green-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
      close: 'bg-yellow-100 text-yellow-800',
      reset: 'bg-orange-100 text-orange-800',
      activate: 'bg-green-100 text-green-800',
      deactivate: 'bg-gray-100 text-gray-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const formatFieldName = (field: string): string => {
    const names: Record<string, string> = {
      status: 'Estado',
      startDate: 'Fecha de inicio',
      endDate: 'Fecha de fin',
      year: 'Año',
      month: 'Mes',
      description: 'Descripción',
    };
    return names[field] || field;
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';

    // Si es una fecha ISO
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return format(new Date(value), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
    }

    // Si es un estado
    const statusLabels: Record<string, string> = {
      active: 'Activo',
      closed: 'Cerrado',
      pending: 'Pendiente',
    };

    if (typeof value === 'string' && statusLabels[value]) {
      return statusLabels[value];
    }

    return String(value);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando historial...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (auditLogs.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">No hay historial de auditoría para este periodo</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        Historial de Cambios
      </h3>

      <div className="space-y-3">
        {auditLogs.map((log) => (
          <div
            key={log.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getActionColor(
                      log.action
                    )}`}
                  >
                    {getActionLabel(log.action)}
                  </span>
                  <span className="text-sm text-gray-600">
                    {format(new Date(log.timestamp), "d 'de' MMMM 'de' yyyy, HH:mm", {
                      locale: es,
                    })}
                  </span>
                </div>

                {/* User Info */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium text-sm">
                      {log.userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.userName}
                    </p>
                    {log.userEmail && (
                      <p className="text-xs text-gray-500">{log.userEmail}</p>
                    )}
                  </div>
                </div>

                {/* Changes */}
                {log.changes && log.changes.length > 0 && (
                  <div className="bg-gray-50 rounded-md p-3 space-y-2">
                    <p className="text-xs font-medium text-gray-700 uppercase">
                      Cambios realizados:
                    </p>
                    {log.changes.map((change, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium text-gray-700">
                          {formatFieldName(change.field)}:
                        </span>
                        <div className="ml-4 mt-1 grid grid-cols-2 gap-2">
                          <div className="bg-red-50 p-2 rounded">
                            <p className="text-xs text-gray-600 mb-1">Antes:</p>
                            <p className="text-sm text-gray-900">
                              {formatValue(change.oldValue)}
                            </p>
                          </div>
                          <div className="bg-green-50 p-2 rounded">
                            <p className="text-xs text-gray-600 mb-1">Después:</p>
                            <p className="text-sm text-gray-900">
                              {formatValue(change.newValue)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Metadata for Reset action */}
                {log.action === 'reset' && log.metadata && (
                  <div className="bg-orange-50 rounded-md p-3 mt-2">
                    <p className="text-xs font-medium text-orange-700 uppercase mb-2">
                      Detalles del reinicio:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {log.metadata.nominationsDeleted !== undefined && (
                        <div>
                          <span className="text-gray-600">Nominaciones eliminadas:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {log.metadata.nominationsDeleted}
                          </span>
                        </div>
                      )}
                      {log.metadata.winnersDeleted !== undefined && (
                        <div>
                          <span className="text-gray-600">Ganadores eliminados:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {log.metadata.winnersDeleted}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VotingPeriodAuditHistory;
```

## 🎯 Uso del Componente

```typescript
// En tu página de detalles de periodo de votación
import VotingPeriodAuditHistory from './components/VotingPeriodAuditHistory';

function VotingPeriodDetails() {
  const votingPeriodId = 'vp-2025-10'; // o desde tus props/params

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        Detalles del Periodo - October 2025
      </h1>

      {/* Información del periodo */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* ... detalles del periodo ... */}
      </div>

      {/* Historial de auditoría */}
      <div className="mt-8">
        <VotingPeriodAuditHistory votingPeriodId={votingPeriodId} />
      </div>
    </div>
  );
}
```

## 🎨 Versión Simplificada (Solo Lista)

```typescript
const SimpleAuditHistory: React.FC<{ votingPeriodId: string }> = ({ votingPeriodId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    fetch(`/api/voting/${votingPeriodId}/audit-history`)
      .then(res => res.json())
      .then(setLogs);
  }, [votingPeriodId]);

  return (
    <div className="space-y-2">
      <h4 className="font-semibold">Historial de Cambios</h4>
      {logs.length === 0 ? (
        <p className="text-gray-500 text-sm">Sin cambios registrados</p>
      ) : (
        <ul className="space-y-1">
          {logs.map(log => (
            <li key={log.id} className="text-sm flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                {log.action}
              </span>
              <span className="text-gray-600">
                {log.userName} - {new Date(log.timestamp).toLocaleDateString('es')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

## 📱 Vista Responsive

El componente está diseñado para ser responsive. En móviles, los cambios se muestran en columnas verticales en lugar de horizontales.

```css
/* Agregar esto si usas CSS puro */
@media (max-width: 640px) {
  .changes-grid {
    grid-template-columns: 1fr !important;
  }
}
```

## 🔔 Notificaciones en Tiempo Real (Opcional)

Si quieres actualizar el historial en tiempo real cuando se hacen cambios:

```typescript
// Usar polling simple
useEffect(() => {
  const interval = setInterval(() => {
    fetchAuditHistory();
  }, 30000); // cada 30 segundos

  return () => clearInterval(interval);
}, [votingPeriodId]);
```

## 📊 Datos de Ejemplo para Pruebas

```json
[
  {
    "id": "1",
    "entityType": "voting_period",
    "entityId": "vp-2025-10",
    "action": "close",
    "userId": "admin@lmmc.com",
    "userName": "Juan Admin",
    "userEmail": "admin@lmmc.com",
    "timestamp": "2025-10-10T16:30:00.000Z",
    "changes": [
      {
        "field": "status",
        "oldValue": "active",
        "newValue": "closed"
      }
    ],
    "metadata": {
      "year": 2025,
      "month": 10,
      "closedAt": "2025-10-10T16:30:00.000Z"
    }
  }
]
```

---

**Creado:** 2025-10-10
**Endpoint:** `GET /api/voting/{votingPeriodId}/audit-history`
