# Configuration Module

El módulo de configuración permite gestionar dinámicamente las reglas de elegibilidad y los grupos de votación sin necesidad de modificar código o variables de entorno.

## 📋 Tabla de Contenidos

- [Arquitectura](#arquitectura)
- [Configuración de Elegibilidad](#configuración-de-elegibilidad)
- [Configuración de Voting Groups](#configuración-de-voting-groups)
- [API Endpoints](#api-endpoints)
- [Ejemplos de Uso](#ejemplos-de-uso)

---

## Arquitectura

```
configuration/
├── models/
│   ├── eligibility-config.model.ts      # Modelo de elegibilidad
│   └── voting-group-config.model.ts     # Modelo de grupos de votación
├── repositories/
│   ├── EligibilityConfigRepository.ts   # Acceso a datos de elegibilidad
│   └── VotingGroupConfigRepository.ts   # Acceso a datos de voting groups
├── configuration.service.ts             # Lógica de negocio
└── configuration.controller.ts          # Endpoints HTTP
```

### Flujo de datos:
```
HTTP Request → Controller → Service → Repository → Cosmos DB
```

---

## Configuración de Elegibilidad

Define las reglas para determinar si un empleado es elegible para votar.

### Modelo

```typescript
interface EligibilityConfig {
  id: string;                           // Siempre 'eligibility'
  minimumDaysForEligibility: number;    // Días mínimos requeridos (default: 365)
  excludedJobTitles: string[];          // Job titles excluidos
  excludedDepartments: string[];        // Departamentos excluidos
  excludedPositions: string[];          // Posiciones excluidas
  requireActiveStatus: boolean;         // Solo empleados activos (default: true)
  customRules?: {
    allowedCompanyCodes?: string[];     // Solo estos company codes
    excludedCompanyCodes?: string[];    // Company codes excluidos
    minDirectReportsForExclusion?: number; // Excluir managers con X+ reportes
  };
  createdAt?: Date;
  updatedAt?: Date;
}
```

### Valores por defecto

```typescript
{
  id: 'eligibility',
  minimumDaysForEligibility: 365,        // 1 año
  excludedJobTitles: [],
  excludedDepartments: [],
  excludedPositions: [],
  requireActiveStatus: true,
  customRules: {}
}
```

### Reglas de validación

El `EligibilityHelper` valida en orden:

1. **Estado activo** - Si `requireActiveStatus: true`, el empleado debe estar activo
2. **Job title excluido** - Verifica si está en `excludedJobTitles`
3. **Departamento excluido** - Verifica si está en `excludedDepartments`
4. **Posición excluida** - Verifica si está en `excludedPositions`
5. **Company codes permitidos** - Si se define, solo permite ciertos códigos
6. **Company codes excluidos** - Excluye códigos específicos
7. **Managers excluidos** - Excluye si tiene X o más reportes directos
8. **Días de servicio** - Verifica si cumple `minimumDaysForEligibility`

---

## Configuración de Voting Groups

Define cómo agrupar empleados para votaciones.

### Modelo

```typescript
interface VotingGroupConfig {
  id: string;                              // Siempre 'voting-group'
  strategy: 'location' | 'department' | 'custom';

  // Agrupar múltiples departamentos en un voting group
  departmentGroupMappings?: DepartmentGroupMapping[];

  // Agrupar múltiples ubicaciones en un voting group
  locationGroupMappings?: LocationGroupMapping[];

  // Mapeos personalizados legacy
  customMappings?: Record<string, string>;

  // Estrategia de fallback
  fallbackStrategy?: 'location' | 'department' | 'none';

  createdAt?: Date;
  updatedAt?: Date;
}

interface DepartmentGroupMapping {
  groupName: string;       // Nombre del voting group
  departments: string[];   // Departamentos en este grupo
}

interface LocationGroupMapping {
  groupName: string;       // Nombre del voting group
  locations: string[];     // Ubicaciones en este grupo
}
```

### Estrategias

#### 1. **Location** (Por defecto)
Agrupa empleados por su ubicación física. Se puede consolidar múltiples ubicaciones en grupos regionales.

**Simple - Sin agrupación:**
```json
{
  "strategy": "location"
}
```

**Con agrupación de ubicaciones:**
```json
{
  "strategy": "location",
  "locationGroupMappings": [
    {
      "groupName": "Región Norte",
      "locations": ["Tijuana", "Mexicali", "Ensenada"]
    },
    {
      "groupName": "Región Centro",
      "locations": ["Guadalajara", "Zapopan", "León"]
    },
    {
      "groupName": "Región Sur",
      "locations": ["Cancún", "Mérida", "Playa del Carmen"]
    }
  ]
}
```

#### 2. **Department**
Agrupa empleados por departamento, con opción de consolidar departamentos pequeños.

```json
{
  "strategy": "department",
  "departmentGroupMappings": [
    {
      "groupName": "Administrativo",
      "departments": ["HR", "Finance", "Legal", "Contabilidad"]
    },
    {
      "groupName": "Técnico",
      "departments": ["IT", "Development", "QA", "DevOps"]
    }
  ]
}
```

#### 3. **Custom**
Usa mapeos personalizados (locations y/o departments) con estrategia de fallback.

**Ejemplo combinando locations y departments:**
```json
{
  "strategy": "custom",
  "locationGroupMappings": [
    {
      "groupName": "Región Pacífico",
      "locations": ["San Diego", "Los Angeles", "San Francisco"]
    }
  ],
  "departmentGroupMappings": [
    {
      "groupName": "Operaciones",
      "departments": ["Sales", "Marketing", "Customer Support"]
    }
  ],
  "fallbackStrategy": "location"
}
```

**Nota:** En estrategia `custom`, se verifica primero `locationGroupMappings`, luego `departmentGroupMappings`, después `customMappings` legacy, y finalmente se usa `fallbackStrategy`.

---

## API Endpoints

### Eligibility Configuration

#### GET `/configuration/eligibility`
Obtener configuración de elegibilidad actual.

**Response:**
```json
{
  "message": "Eligibility configuration retrieved successfully",
  "config": {
    "id": "eligibility",
    "minimumDaysForEligibility": 365,
    "excludedJobTitles": ["CEO", "VP"],
    "excludedDepartments": [],
    "excludedPositions": [],
    "requireActiveStatus": true,
    "customRules": {}
  }
}
```

#### PUT `/configuration/eligibility`
Actualizar configuración de elegibilidad.

**Request Body:**
```json
{
  "minimumDaysForEligibility": 180,
  "excludedJobTitles": ["CEO", "VP", "Director"],
  "excludedDepartments": ["HR"],
  "requireActiveStatus": true,
  "customRules": {
    "minDirectReportsForExclusion": 5,
    "excludedCompanyCodes": ["EXT", "TEMP"]
  }
}
```

**Response:**
```json
{
  "message": "Eligibility configuration updated successfully",
  "config": { /* updated config */ }
}
```

#### POST `/configuration/eligibility/reset`
Resetear configuración a valores por defecto.

**Response:**
```json
{
  "message": "Eligibility configuration reset to defaults successfully",
  "config": { /* default config */ }
}
```

---

### Voting Group Configuration

#### GET `/configuration/voting-groups`
Obtener configuración de voting groups actual.

**Response:**
```json
{
  "message": "Voting group configuration retrieved successfully",
  "config": {
    "id": "voting-group",
    "strategy": "department",
    "departmentGroupMappings": [
      {
        "groupName": "Administrativo",
        "departments": ["HR", "Finance", "Legal"]
      }
    ],
    "fallbackStrategy": "location"
  }
}
```

#### PUT `/configuration/voting-groups`
Actualizar configuración de voting groups.

**Request Body:**
```json
{
  "strategy": "department",
  "departmentGroupMappings": [
    {
      "groupName": "Administrativo",
      "departments": ["HR", "Finance", "Legal", "Admin"]
    },
    {
      "groupName": "Operaciones",
      "departments": ["Sales", "Marketing", "Customer Support"]
    }
  ],
  "fallbackStrategy": "location"
}
```

**Response:**
```json
{
  "message": "Voting group configuration updated successfully",
  "config": { /* updated config */ }
}
```

#### POST `/configuration/voting-groups/reset`
Resetear configuración a valores por defecto.

---

## Ejemplos de Uso

### Ejemplo 1: Excluir ejecutivos de votación

```bash
curl -X PUT http://localhost:7071/api/configuration/eligibility \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "excludedJobTitles": ["CEO", "President", "VP", "EVP", "SVP"]
  }'
```

### Ejemplo 2: Reducir tiempo de elegibilidad a 6 meses

```bash
curl -X PUT http://localhost:7071/api/configuration/eligibility \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "minimumDaysForEligibility": 180
  }'
```

### Ejemplo 3: Excluir managers con 5+ reportes directos

```bash
curl -X PUT http://localhost:7071/api/configuration/eligibility \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customRules": {
      "minDirectReportsForExclusion": 5
    }
  }'
```

### Ejemplo 4: Agrupar 3 locations en un grupo de votación

```bash
curl -X PUT http://localhost:7071/api/configuration/voting-groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "strategy": "location",
    "locationGroupMappings": [
      {
        "groupName": "Región Pacífico",
        "locations": ["San Diego", "Los Angeles", "San Francisco"]
      }
    ]
  }'
```

### Ejemplo 5: Agrupar múltiples regiones por ubicación

```bash
curl -X PUT http://localhost:7071/api/configuration/voting-groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "strategy": "location",
    "locationGroupMappings": [
      {
        "groupName": "Región Norte",
        "locations": ["Tijuana", "Mexicali", "Ensenada"]
      },
      {
        "groupName": "Región Centro",
        "locations": ["Guadalajara", "Zapopan", "León"]
      },
      {
        "groupName": "Región Sur",
        "locations": ["Cancún", "Mérida", "Playa del Carmen"]
      }
    ]
  }'
```

### Ejemplo 6: Agrupar departamentos pequeños

```bash
curl -X PUT http://localhost:7071/api/configuration/voting-groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "strategy": "department",
    "departmentGroupMappings": [
      {
        "groupName": "Administrativo",
        "departments": ["HR", "Finance", "Legal", "Compliance"]
      },
      {
        "groupName": "Técnico",
        "departments": ["IT", "Development", "QA", "DevOps", "Infrastructure"]
      },
      {
        "groupName": "Comercial",
        "departments": ["Sales", "Marketing", "Business Development"]
      }
    ],
    "fallbackStrategy": "location"
  }'
```

### Ejemplo 7: Configuración mixta (locations + departments)

```bash
# 1. Configurar elegibilidad
curl -X PUT http://localhost:7071/api/configuration/eligibility \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "minimumDaysForEligibility": 365,
    "excludedJobTitles": ["CEO", "President", "VP", "EVP"],
    "excludedDepartments": ["Executive"],
    "requireActiveStatus": true,
    "customRules": {
      "minDirectReportsForExclusion": 10,
      "excludedCompanyCodes": ["EXTERNAL", "CONTRACTOR"]
    }
  }'

# 2. Configurar voting groups
curl -X PUT http://localhost:7071/api/configuration/voting-groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "strategy": "department",
    "departmentGroupMappings": [
      {
        "groupName": "Admin & Finance",
        "departments": ["HR", "Finance", "Accounting", "Legal"]
      },
      {
        "groupName": "Technology",
        "departments": ["IT", "Development", "QA", "DevOps"]
      },
      {
        "groupName": "Business Operations",
        "departments": ["Sales", "Marketing", "Customer Success", "Support"]
      },
      {
        "groupName": "Operations",
        "departments": ["Logistics", "Warehouse", "Procurement"]
      }
    ],
    "fallbackStrategy": "location"
  }'
```

---

## Integración con otros módulos

### EligibilityHelper

El `EligibilityHelper` usa la configuración para validar elegibilidad:

```typescript
import { EligibilityHelper } from './common/utils/EligibilityHelper';
import { eligibilityConfigRepository } from './repositories';

const config = await eligibilityConfigRepository.getConfig();
const isEligible = EligibilityHelper.isVotingEligible(employee, config);
```

### VotingGroupService

El `VotingGroupService` usa la configuración para asignar grupos:

```typescript
import { VotingGroupService } from './common/VotingGroupService';
import { votingGroupConfigRepository } from './repositories';

const config = await votingGroupConfigRepository.getConfig();
const service = new VotingGroupService(config);
const votingGroup = service.assignVotingGroup(employee);
```

### EmployeeSyncService

Durante el sync, ambas configuraciones se aplican automáticamente:

1. Se asigna el `votingGroup` según `VotingGroupConfig`
2. Se calcula `votingEligible` según `EligibilityConfig`

---

## Almacenamiento

Las configuraciones se almacenan en Cosmos DB:

- **Container**: `configuration`
- **Documents**:
  - `eligibility` - Configuración de elegibilidad
  - `voting-group` - Configuración de voting groups

Cada documento usa su `id` como partition key.

---

## Notas importantes

1. **Singleton**: Solo existe una configuración de cada tipo
2. **Defaults**: Si no existe configuración, se usan valores por defecto
3. **Validación**: El servicio valida los datos antes de guardar
4. **Atomicidad**: Las actualizaciones son atómicas (upsert)
5. **Sincronización**: Después de actualizar `VotingGroupConfig`, ejecutar sync de empleados para actualizar sus grupos

---

## TODO

- [ ] Agregar verificación de rol admin para endpoints de configuración
- [ ] Implementar auditoría de cambios en configuración
- [ ] Agregar endpoint para obtener historial de configuraciones
- [ ] Crear UI para administrar configuraciones
- [ ] Agregar validación de departamentos existentes en `departmentGroupMappings`
