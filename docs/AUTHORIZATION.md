# Sistema de Autorización y Permisos

Este documento describe cómo utilizar el sistema de roles y permisos implementado en la API de votación.

## Tabla de Contenidos

1. [Conceptos Generales](#conceptos-generales)
2. [Roles del Sistema](#roles-del-sistema)
3. [Permisos del Sistema](#permisos-del-sistema)
4. [Uso en Controladores](#uso-en-controladores)
5. [Ejemplos Prácticos](#ejemplos-prácticos)

## Conceptos Generales

El sistema de autorización se basa en tres conceptos principales:

- **Autenticación**: Verificar que el usuario es quien dice ser (mediante JWT token)
- **Roles**: Categorías de usuarios con diferentes niveles de acceso
- **Permisos**: Acciones específicas que un usuario puede realizar

## Roles del Sistema

Los siguientes roles están disponibles en el sistema:

### UserRole.SUPER_ADMIN
- Máximo nivel de acceso
- Tiene todos los permisos del sistema
- Puede gestionar configuraciones críticas

### UserRole.ADMIN
- Alto nivel de acceso
- Puede gestionar empleados, votaciones y nominaciones
- No puede modificar configuraciones del sistema

### UserRole.MODERATOR
- Nivel medio de acceso
- Puede aprobar/rechazar nominaciones
- Puede ver resultados y reportes

### UserRole.USER
- Usuario estándar
- Puede votar y crear nominaciones
- Puede ver información básica

### UserRole.GUEST
- Nivel mínimo de acceso
- Solo puede ver información pública
- No puede realizar acciones de modificación

## Permisos del Sistema

### Permisos de Empleados
- `EMPLOYEE_READ`: Ver información de empleados
- `EMPLOYEE_CREATE`: Crear nuevos empleados
- `EMPLOYEE_UPDATE`: Actualizar información de empleados
- `EMPLOYEE_DELETE`: Eliminar empleados
- `EMPLOYEE_SYNC`: Sincronizar empleados con sistemas externos
- `EMPLOYEE_MANAGE_ROLES`: Gestionar roles de empleados

### Permisos de Votación
- `VOTING_READ`: Ver información de votaciones
- `VOTING_CREATE`: Crear nuevas votaciones
- `VOTING_UPDATE`: Actualizar votaciones
- `VOTING_DELETE`: Eliminar votaciones
- `VOTING_MANAGE_PERIODS`: Gestionar períodos de votación
- `VOTING_VIEW_RESULTS`: Ver resultados de votaciones
- `VOTING_NOMINATE`: Crear nominaciones
- `VOTING_VOTE`: Emitir votos

### Permisos de Nominaciones
- `NOMINATION_READ`: Ver nominaciones
- `NOMINATION_CREATE`: Crear nominaciones
- `NOMINATION_UPDATE`: Actualizar nominaciones
- `NOMINATION_DELETE`: Eliminar nominaciones
- `NOMINATION_APPROVE`: Aprobar nominaciones
- `NOMINATION_REJECT`: Rechazar nominaciones

### Permisos de Administración
- `ADMIN_ACCESS`: Acceso al panel de administración
- `ADMIN_SYSTEM_CONFIG`: Configurar el sistema
- `ADMIN_VIEW_LOGS`: Ver logs del sistema
- `ADMIN_MANAGE_USERS`: Gestionar usuarios

### Permisos de Reportes
- `REPORT_VIEW`: Ver reportes básicos
- `REPORT_EXPORT`: Exportar reportes
- `REPORT_ADVANCED`: Ver reportes avanzados

## Uso en Controladores

### 1. Endpoint Público (sin autenticación)

```typescript
import { Public } from '../common/decorators/auth.decorators';

export class PublicController {
  @Public()
  async healthCheck(request: HttpRequest, context: InvocationContext) {
    return { status: 200, jsonBody: { status: 'ok' } };
  }
}
```

### 2. Endpoint con Autenticación Básica

```typescript
import { AuthMiddleware } from '../common/middleware/AuthMiddleware';

export class AuthController {
  async getProfile(request: HttpRequest, context: InvocationContext) {
    const user = await AuthMiddleware.validateToken(request, context);

    if (!user) {
      return { status: 401, jsonBody: { error: 'Unauthorized' } };
    }

    return { status: 200, jsonBody: user };
  }
}
```

### 3. Endpoint con Roles Requeridos

```typescript
import { RequireRoles } from '../common/decorators/auth.decorators';
import { UserRole } from '../common/constants/roles.constants';

export class AdminController {
  @RequireRoles([UserRole.ADMIN, UserRole.SUPER_ADMIN])
  async deleteEmployee(request: HttpRequest, context: InvocationContext) {
    const { user, response } = await AuthMiddleware.validateAuthorization(
      request,
      context,
      this,
      'deleteEmployee'
    );

    if (response) return response; // Retorna 401 o 403 si no autorizado

    // Lógica del endpoint
    return { status: 200, jsonBody: { message: 'Deleted' } };
  }
}
```

### 4. Endpoint con Permisos Requeridos

```typescript
import { RequirePermissions } from '../common/decorators/auth.decorators';
import { Permission } from '../common/constants/roles.constants';

export class VotingController {
  @RequirePermissions([Permission.VOTING_CREATE])
  async createVotingPeriod(request: HttpRequest, context: InvocationContext) {
    const { user, response } = await AuthMiddleware.validateAuthorization(
      request,
      context,
      this,
      'createVotingPeriod'
    );

    if (response) return response;

    // Lógica del endpoint
    return { status: 201, jsonBody: { message: 'Created' } };
  }
}
```

### 5. Endpoint con Validación de Ownership

```typescript
import { RequireOwnership } from '../common/decorators/auth.decorators';

export class UserController {
  @RequireOwnership('userId')
  async updateProfile(request: HttpRequest, context: InvocationContext) {
    const targetUserId = request.params.userId;

    const { user, response } = await AuthMiddleware.validateAuthorization(
      request,
      context,
      this,
      'updateProfile',
      targetUserId // El sistema verifica que user.userId === targetUserId
    );

    if (response) return response;

    // El usuario solo puede modificar su propio perfil
    return { status: 200, jsonBody: { message: 'Updated' } };
  }
}
```

### 6. Validación Manual de Permisos

```typescript
export class ComplexController {
  async complexOperation(request: HttpRequest, context: InvocationContext) {
    const user = await AuthMiddleware.validateToken(request, context);

    if (!user) {
      return { status: 401, jsonBody: { error: 'Unauthorized' } };
    }

    // Verificar un permiso específico
    if (!AuthMiddleware.hasPermission(user, Permission.EMPLOYEE_UPDATE)) {
      return {
        status: 403,
        jsonBody: { error: 'Missing employee:update permission' }
      };
    }

    // Verificar si tiene alguno de varios permisos
    const permissions = [Permission.VOTING_CREATE, Permission.VOTING_UPDATE];
    if (!AuthMiddleware.hasAnyPermission(user, permissions)) {
      return { status: 403, jsonBody: { error: 'Forbidden' } };
    }

    // Obtener todos los permisos del usuario
    const userPermissions = AuthMiddleware.getUserPermissions(user);

    return {
      status: 200,
      jsonBody: { permissions: userPermissions }
    };
  }
}
```

## Ejemplos Prácticos

### Ejemplo 1: Crear una votación (requiere permiso)

```typescript
@RequirePermissions([Permission.VOTING_CREATE])
async createVoting(request: HttpRequest, context: InvocationContext) {
  const { user, response } = await AuthMiddleware.validateAuthorization(
    request,
    context,
    this,
    'createVoting'
  );

  if (response) return response;

  const body = await request.json();
  // Lógica para crear votación

  return { status: 201, jsonBody: { message: 'Voting created' } };
}
```

### Ejemplo 2: Ver resultados (solo admins y moderadores)

```typescript
@RequireRoles([UserRole.ADMIN, UserRole.MODERATOR, UserRole.SUPER_ADMIN])
async getResults(request: HttpRequest, context: InvocationContext) {
  const { user, response } = await AuthMiddleware.validateAuthorization(
    request,
    context,
    this,
    'getResults'
  );

  if (response) return response;

  // Lógica para obtener resultados

  return { status: 200, jsonBody: { results: [] } };
}
```

### Ejemplo 3: Aprobar nominación (requiere permiso específico)

```typescript
@RequirePermissions([Permission.NOMINATION_APPROVE])
async approveNomination(request: HttpRequest, context: InvocationContext) {
  const { user, response } = await AuthMiddleware.validateAuthorization(
    request,
    context,
    this,
    'approveNomination'
  );

  if (response) return response;

  const nominationId = request.params.id;
  // Lógica para aprobar nominación

  return { status: 200, jsonBody: { message: 'Nomination approved' } };
}
```

### Ejemplo 4: Combinar roles y permisos

```typescript
// Requiere ser ADMIN y tener el permiso específico
@RequireRoles([UserRole.ADMIN], true)
@RequirePermissions([Permission.ADMIN_SYSTEM_CONFIG], true)
async updateSystemConfig(request: HttpRequest, context: InvocationContext) {
  const { user, response } = await AuthMiddleware.validateAuthorization(
    request,
    context,
    this,
    'updateSystemConfig'
  );

  if (response) return response;

  // Lógica para actualizar configuración del sistema

  return { status: 200, jsonBody: { message: 'Config updated' } };
}
```

## Matriz de Permisos por Rol

| Permiso | SUPER_ADMIN | ADMIN | MODERATOR | USER | GUEST |
|---------|-------------|-------|-----------|------|-------|
| EMPLOYEE_READ | ✓ | ✓ | ✓ | ✓ | ✓ |
| EMPLOYEE_CREATE | ✓ | ✓ | ✗ | ✗ | ✗ |
| EMPLOYEE_DELETE | ✓ | ✗ | ✗ | ✗ | ✗ |
| VOTING_VOTE | ✓ | ✓ | ✓ | ✓ | ✗ |
| VOTING_MANAGE_PERIODS | ✓ | ✓ | ✗ | ✗ | ✗ |
| NOMINATION_APPROVE | ✓ | ✓ | ✓ | ✗ | ✗ |
| ADMIN_SYSTEM_CONFIG | ✓ | ✗ | ✗ | ✗ | ✗ |
| REPORT_ADVANCED | ✓ | ✓ | ✗ | ✗ | ✗ |

## Respuestas de Error

### 401 Unauthorized (no autenticado)
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden (no autorizado)
```json
{
  "error": "Forbidden",
  "message": "User lacks required role(s): admin",
  "missingRoles": ["admin"]
}
```

```json
{
  "error": "Forbidden",
  "message": "User lacks required permission(s): voting:create",
  "missingPermissions": ["voting:create"]
}
```

## Notas Importantes

1. **Jerarquía de Roles**: Los decoradores `@RequireRoles` verifican si el usuario tiene AL MENOS UNO de los roles especificados, a menos que se especifique `requireAll: true`.

2. **Acumulación de Permisos**: Un usuario puede tener múltiples roles, y sus permisos son la suma de todos los permisos de esos roles.

3. **Ownership**: El decorador `@RequireOwnership` permite que un usuario acceda a recursos que le pertenecen, incluso si no tiene el permiso general.

4. **Endpoints Públicos**: Usa `@Public()` solo para endpoints que no requieren ningún tipo de autenticación.

5. **Reflect Metadata**: El sistema utiliza `reflect-metadata` para almacenar los metadatos de autorización, asegúrate de que esté instalado y importado.
