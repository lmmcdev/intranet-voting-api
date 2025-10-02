# Sistema de Autorización - Guía Rápida

## Archivos Creados

### 1. Constantes y Tipos
- [`src/common/constants/roles.constants.ts`](src/common/constants/roles.constants.ts) - Define roles, permisos y su mapeo

### 2. Decoradores
- [`src/common/decorators/auth.decorators.ts`](src/common/decorators/auth.decorators.ts) - Decoradores para protección de endpoints

### 3. Servicios
- [`src/common/services/AuthorizationService.ts`](src/common/services/AuthorizationService.ts) - Lógica de autorización y validación

### 4. Middleware (Actualizado)
- [`src/common/middleware/AuthMiddleware.ts`](src/common/middleware/AuthMiddleware.ts) - Middleware extendido con autorización

### 5. Ejemplos y Documentación
- [`src/common/examples/authorization-usage.example.ts`](src/common/examples/authorization-usage.example.ts) - Ejemplos prácticos
- [`docs/AUTHORIZATION.md`](docs/AUTHORIZATION.md) - Documentación completa

## Uso Rápido

### 1. Instalar Dependencias
```bash
npm install reflect-metadata
```

### 2. Roles Disponibles
```typescript
UserRole.SUPER_ADMIN  // Todos los permisos
UserRole.ADMIN        // Gestión completa excepto sistema
UserRole.MODERATOR    // Aprobación y reportes
UserRole.USER         // Operaciones básicas
UserRole.GUEST        // Solo lectura
```

### 3. Ejemplos de Uso

#### Endpoint Público
```typescript
import { Public } from '../common/decorators/auth.decorators';

@Public()
async healthCheck(req: HttpRequest, ctx: InvocationContext) {
  return { status: 200, jsonBody: { status: 'ok' } };
}
```

#### Requiere Roles
```typescript
import { RequireRoles } from '../common/decorators/auth.decorators';
import { UserRole } from '../common/constants/roles.constants';
import { AuthMiddleware } from '../common/middleware/AuthMiddleware';

@RequireRoles([UserRole.ADMIN, UserRole.SUPER_ADMIN])
async deleteEmployee(req: HttpRequest, ctx: InvocationContext) {
  const { user, response } = await AuthMiddleware.validateAuthorization(
    req, ctx, this, 'deleteEmployee'
  );

  if (response) return response;

  // Tu lógica aquí
  return { status: 200, jsonBody: { message: 'Deleted' } };
}
```

#### Requiere Permisos
```typescript
import { RequirePermissions } from '../common/decorators/auth.decorators';
import { Permission } from '../common/constants/roles.constants';

@RequirePermissions([Permission.VOTING_CREATE])
async createVoting(req: HttpRequest, ctx: InvocationContext) {
  const { user, response } = await AuthMiddleware.validateAuthorization(
    req, ctx, this, 'createVoting'
  );

  if (response) return response;

  // Tu lógica aquí
  return { status: 201, jsonBody: { message: 'Created' } };
}
```

#### Validación de Ownership
```typescript
import { RequireOwnership } from '../common/decorators/auth.decorators';

@RequireOwnership('userId')
async updateProfile(req: HttpRequest, ctx: InvocationContext) {
  const userId = req.params.userId;

  const { user, response } = await AuthMiddleware.validateAuthorization(
    req, ctx, this, 'updateProfile', userId
  );

  if (response) return response;

  // Solo el usuario puede modificar su propio perfil
  return { status: 200, jsonBody: { message: 'Updated' } };
}
```

## Permisos por Módulo

### Empleados
- `EMPLOYEE_READ`, `EMPLOYEE_CREATE`, `EMPLOYEE_UPDATE`, `EMPLOYEE_DELETE`
- `EMPLOYEE_SYNC`, `EMPLOYEE_MANAGE_ROLES`

### Votación
- `VOTING_READ`, `VOTING_CREATE`, `VOTING_UPDATE`, `VOTING_DELETE`
- `VOTING_MANAGE_PERIODS`, `VOTING_VIEW_RESULTS`, `VOTING_NOMINATE`, `VOTING_VOTE`

### Nominaciones
- `NOMINATION_READ`, `NOMINATION_CREATE`, `NOMINATION_UPDATE`, `NOMINATION_DELETE`
- `NOMINATION_APPROVE`, `NOMINATION_REJECT`

### Administración
- `ADMIN_ACCESS`, `ADMIN_SYSTEM_CONFIG`, `ADMIN_VIEW_LOGS`, `ADMIN_MANAGE_USERS`

### Reportes
- `REPORT_VIEW`, `REPORT_EXPORT`, `REPORT_ADVANCED`

## Validación Manual

```typescript
// Verificar permiso
if (!AuthMiddleware.hasPermission(user, Permission.EMPLOYEE_UPDATE)) {
  return { status: 403, jsonBody: { error: 'Forbidden' } };
}

// Verificar múltiples permisos (al menos uno)
if (!AuthMiddleware.hasAnyPermission(user, [Permission.VOTING_CREATE, Permission.VOTING_UPDATE])) {
  return { status: 403, jsonBody: { error: 'Forbidden' } };
}

// Obtener todos los permisos del usuario
const permissions = AuthMiddleware.getUserPermissions(user);
```

## Matriz de Permisos

| Acción | SUPER_ADMIN | ADMIN | MODERATOR | USER | GUEST |
|--------|-------------|-------|-----------|------|-------|
| Leer empleados | ✓ | ✓ | ✓ | ✓ | ✓ |
| Crear empleados | ✓ | ✓ | ✗ | ✗ | ✗ |
| Votar | ✓ | ✓ | ✓ | ✓ | ✗ |
| Aprobar nominaciones | ✓ | ✓ | ✓ | ✗ | ✗ |
| Config. sistema | ✓ | ✗ | ✗ | ✗ | ✗ |

## Respuestas HTTP

### 401 - No autenticado
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 - No autorizado
```json
{
  "error": "Forbidden",
  "message": "User lacks required permission(s): voting:create",
  "missingPermissions": ["voting:create"]
}
```

## Notas Importantes

1. **Import reflect-metadata**: Debe estar importado al inicio de archivos que usan decoradores
2. **requireAll**: Por defecto `false` (requiere al menos uno), usa `true` para requerir todos
3. **Ownership**: Permite acceso si el usuario es dueño del recurso
4. **Jerarquía**: SUPER_ADMIN > ADMIN > MODERATOR > USER > GUEST

## Ver Más

Para ejemplos detallados, ver:
- [`src/common/examples/authorization-usage.example.ts`](src/common/examples/authorization-usage.example.ts)
- [`docs/AUTHORIZATION.md`](docs/AUTHORIZATION.md)
