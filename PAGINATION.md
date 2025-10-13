# 📖 Paginación con Cosmos DB Continuation Tokens

## 🎯 ¿Qué Implementamos?

Hemos implementado paginación nativa de Cosmos DB usando **Continuation Tokens** en lugar de OFFSET/LIMIT.

## ✅ Ventajas vs OFFSET/LIMIT

| Característica | OFFSET/LIMIT | Continuation Tokens |
|----------------|--------------|---------------------|
| **Costo RUs**  | Alto (lee todos los docs hasta offset) | Bajo (solo lee página actual) |
| **Performance**| Lento en páginas profundas | Rápido en cualquier página |
| **Eficiencia** | ❌ O(n) donde n=offset+limit | ✅ O(limit) |
| **Ejemplo**    | Para leer items 1000-1010, lee 1010 items | Para leer items 1000-1010, solo lee 10 items |

### Ejemplo de Costos:

```sql
-- ❌ MALO: Lee 1010 documentos, cobra 1010 RUs
SELECT * FROM c OFFSET 1000 LIMIT 10

-- ✅ BUENO: Lee 10 documentos, cobra ~10 RUs
-- Usa continuation token desde página anterior
```

## 🔧 Archivos Creados/Modificados

### 1. Modelo de Paginación
📄 `src/common/models/Pagination.ts`

```typescript
export interface PaginationParams {
  limit?: number;               // Items por página (default: 10, max: 100)
  continuationToken?: string;   // Token de página anterior
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    itemCount: number;           // Items en página actual
    itemsPerPage: number;        // Items solicitados
    continuationToken: string | null;  // Token para siguiente página
    hasNextPage: boolean;        // ¿Hay más páginas?
  }
}
```

### 2. Repository con Paginación
📄 `src/modules/voting/repositories/NominationRepository.ts`

```typescript
async findByVotingPeriodPaginated(
  votingPeriodId: string,
  maxItemCount: number = 10,
  continuationToken?: string
): Promise<CosmosQueryResult<Nomination>> {
  const queryIterator = container.items.query<Nomination>(querySpec, {
    maxItemCount,           // Límite de items
    continuationToken,      // Token de continuación
  });

  // fetchNext() solo trae la siguiente página
  const { resources, continuationToken: nextToken, hasMoreResults }
    = await queryIterator.fetchNext();

  return {
    resources,              // Items de esta página
    continuationToken: nextToken,  // Token para siguiente
    hasMoreResults,         // ¿Hay más?
  };
}
```

### 3. Service Layer
📄 `src/modules/voting/services/VotingService.ts`

```typescript
async getNominationsForCurrentPeriodPaginated(
  pagination: PaginationParams = {}
): Promise<PaginatedResponse<NominationWithEmployee>> {
  // 1. Parse parámetros
  const { limit, continuationToken } = parsePaginationParams(pagination);

  // 2. Query con paginación nativa
  const result = await this.nominationRepository.findByVotingPeriodPaginated(
    currentPeriod.id,
    limit,
    continuationToken
  );

  // 3. Enriquecer con datos de empleados
  const nominationsWithEmployee = await enrichNominations(result.resources);

  // 4. Calcular metadata
  const meta = calculatePaginationMeta(
    nominationsWithEmployee.length,
    limit,
    result.continuationToken
  );

  return { data: nominationsWithEmployee, meta };
}
```

### 4. Controller/Endpoint
📄 `src/modules/voting/voting.controller.ts`

```typescript
// Endpoint: GET /api/nominations/current-period

async getNominationsForCurrentPeriodPaginated(request, context) {
  // Extraer query params
  const limit = request.query.get('limit');
  const continuationToken = request.query.get('continuationToken');

  // Llamar service
  const result = await votingService.getNominationsForCurrentPeriodPaginated({
    limit: limit ? parseInt(limit) : undefined,
    continuationToken: continuationToken || undefined,
  });

  return ResponseHelper.ok(result);
}
```

## 🚀 Cómo Usar

### Paso 1: Primera Página

```http
GET /api/nominations/current-period?limit=10
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "nom-001",
      "nominatedEmployeeId": "emp-123",
      "nominatorUserName": "John Doe",
      "reason": "Great teamwork",
      "createdAt": "2025-10-13T10:00:00Z",
      "nominatedEmployee": {
        "fullName": "Jane Smith",
        "department": "Engineering",
        "position": "Senior Developer"
      }
    }
    // ... 9 más (total 10 items)
  ],
  "meta": {
    "itemCount": 10,
    "itemsPerPage": 10,
    "continuationToken": "W3sidG9rZW4iOiIrUklEOn...",  // ← Guardar este token!
    "hasNextPage": true
  }
}
```

### Paso 2: Segunda Página

```http
GET /api/nominations/current-period?limit=10&continuationToken=W3sidG9rZW4iOiIrUklEOn...
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    // ... siguientes 10 items
  ],
  "meta": {
    "itemCount": 10,
    "itemsPerPage": 10,
    "continuationToken": "X8sidZ9rZW5iOjErUklFPn...",  // ← Nuevo token
    "hasNextPage": true
  }
}
```

### Paso 3: Última Página

```http
GET /api/nominations/current-period?limit=10&continuationToken=X8sidZ9rZW5iOjErUklFPn...
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    // ... últimos items (puede ser menos de 10)
  ],
  "meta": {
    "itemCount": 5,
    "itemsPerPage": 10,
    "continuationToken": null,  // ← No hay más páginas
    "hasNextPage": false
  }
}
```

## 🔄 Flujo Visual

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │
       │ 1. GET /nominations/current-period?limit=10
       │
       v
┌──────────────────┐      ┌──────────────┐      ┌────────────┐
│   Controller     │─────>│   Service    │─────>│ Repository │
│                  │      │              │      │            │
│ Parse params:    │      │ Validate &   │      │ Query with │
│ - limit=10       │      │ Process      │      │ Cosmos SDK │
│ - token=null     │      │              │      │ pagination │
└──────────────────┘      └──────────────┘      └────────────┘
       │                                                │
       │                                                │
       v                                                v
  ┌────────────────────────────────────────────────────────┐
  │ Cosmos DB: Ejecuta query con maxItemCount=10          │
  │ SELECT * FROM c WHERE c.votingPeriodId = @id          │
  │ ORDER BY c.createdAt DESC                              │
  │ (Lee solo 10 docs, NO lee todos y salta!)             │
  └────────────────────────────────────────────────────────┘
       │
       │ Retorna: {resources: [...], continuationToken: "ABC"}
       │
       v
┌──────────────────┐
│    Respuesta     │
│ {                │
│   data: [10],    │
│   meta: {        │
│     token: "ABC",│
│     hasNext:true │
│   }              │
│ }                │
└──────────────────┘
```

## 📊 Ejemplo con Frontend

```typescript
// React/Vue/Angular example
class NominationsList {
  async loadFirstPage() {
    const response = await fetch('/api/nominations/current-period?limit=10');
    const result = await response.json();

    this.nominations = result.data;
    this.continuationToken = result.meta.continuationToken;
    this.hasNextPage = result.meta.hasNextPage;
  }

  async loadNextPage() {
    if (!this.hasNextPage) return;

    const url = `/api/nominations/current-period?limit=10&continuationToken=${this.continuationToken}`;
    const response = await fetch(url);
    const result = await response.json();

    this.nominations = [...this.nominations, ...result.data]; // Append
    this.continuationToken = result.meta.continuationToken;
    this.hasNextPage = result.meta.hasNextPage;
  }
}
```

## ⚙️ Configuración

### Límites por Defecto

```typescript
// src/common/models/Pagination.ts
export const DEFAULT_LIMIT = 10;   // Límite por defecto
export const MAX_LIMIT = 100;      // Límite máximo permitido
```

### Validación Automática

```typescript
// Si el cliente pide limit=1000, se ajusta automáticamente a 100
const { limit } = parsePaginationParams({ limit: 1000 });
console.log(limit); // 100
```

## 🎨 Formato de Respuesta Estándar

Todos los endpoints paginados siguen este formato:

```typescript
{
  "success": true,
  "data": T[],           // Array de items
  "meta": {
    "itemCount": number,         // Items en esta página
    "itemsPerPage": number,      // Límite solicitado
    "continuationToken": string | null,  // Token para siguiente
    "hasNextPage": boolean       // ¿Hay más?
  }
}
```

## 🔍 Endpoint Disponible

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/nominations/current-period` | Nominaciones del período actual con paginación |

### Query Parameters

- `limit` (opcional): Número de items por página (default: 10, max: 100)
- `continuationToken` (opcional): Token de la página anterior

### Ejemplos

```bash
# Primera página (10 items)
curl "https://your-api.azurewebsites.net/api/nominations/current-period?limit=10"

# Segunda página
curl "https://your-api.azurewebsites.net/api/nominations/current-period?limit=10&continuationToken=ABC123"

# Página grande (50 items)
curl "https://your-api.azurewebsites.net/api/nominations/current-period?limit=50"
```

## 🚀 Próximos Pasos (Futuros Endpoints)

Puedes agregar paginación a otros endpoints usando el mismo patrón:

1. **Winner History**: `GET /api/voting/winners/history?limit=20&continuationToken=XYZ`
2. **Voting Periods**: `GET /api/voting-periods?limit=10&continuationToken=ABC`
3. **Employees**: `GET /api/employees?limit=50&continuationToken=DEF`

## 📝 Notas Importantes

1. **Los tokens expiran**: Los continuation tokens de Cosmos DB tienen una validez limitada (generalmente 24 horas)
2. **No son retrocompatibles**: Si cambias la query (filtros, orden), el token deja de funcionar
3. **No puedes saltar páginas**: Debes ir de página en página secuencialmente
4. **No hay "página total"**: Cosmos DB no sabe cuántos items totales hay sin leer todos
5. **Eficiente y económico**: Pagas solo por lo que lees

## ❓ FAQ

**P: ¿Puedo ir a la página 5 directamente?**
R: No, debes ir página por página (1→2→3→4→5) guardando los tokens.

**P: ¿Puedo ordenar diferente?**
R: Sí, pero debes especificarlo en el query. Cambiar el orden invalida los tokens anteriores.

**P: ¿Cuánto cuesta en RUs?**
R: Aproximadamente 1 RU por documento leído (mucho más barato que OFFSET/LIMIT).

**P: ¿Funciona con filtros complejos?**
R: Sí, cualquier query SQL de Cosmos DB soporta paginación.

---

✨ **Implementado por:** Claude Code
📅 **Fecha:** 2025-10-13
🚀 **Versión:** 1.0.0
