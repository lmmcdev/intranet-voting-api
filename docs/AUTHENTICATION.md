# Sistema de Autenticación - Login y Cambio de Contraseña

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Flujo de Autenticación](#flujo-de-autenticación)
3. [Login](#login)
4. [Primer Login y Cambio de Contraseña Obligatorio](#primer-login-y-cambio-de-contraseña-obligatorio)
5. [Cambio de Contraseña](#cambio-de-contraseña)
6. [Verificación de Token](#verificación-de-token)
7. [Manejo de Errores](#manejo-de-errores)
8. [Ejemplos de Integración](#ejemplos-de-integración)

## Introducción

El sistema de autenticación utiliza JSON Web Tokens (JWT) para autenticar usuarios y gestionar sesiones. Incluye funcionalidades para:

- **Login con username y password**
- **Detección de primer login** con cambio de contraseña obligatorio
- **Cambio de contraseña** con validación
- **Verificación de tokens** JWT
- **Seguridad** con contraseñas hasheadas (bcrypt)

## Flujo de Autenticación

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │
       │ 1. Login (username + password)
       ▼
┌─────────────────────────────────┐
│   POST /api/auth/login          │
│   - Valida credenciales         │
│   - Verifica cuenta activa      │
│   - Genera JWT token            │
└──────┬──────────────────────────┘
       │
       │ 2. Respuesta
       ▼
┌──────────────────────────────────┐
│   Respuesta de Login             │
│   - success: true/false          │
│   - token                        │
│   - requirePasswordChange: bool  │◄── Si es primer login
│   - user data                    │
└──────┬───────────────────────────┘
       │
       │ 3a. Si requirePasswordChange = true
       ▼
┌──────────────────────────────────┐
│   POST /api/auth/change-password │
│   - Requiere token JWT           │
│   - oldPassword (contraseña temp)│
│   - newPassword (nueva segura)   │
│   - Marca firstLogin = false     │
└──────┬───────────────────────────┘
       │
       │ 3b. Si requirePasswordChange = false
       ▼
┌──────────────────────────────────┐
│   Acceso a la Aplicación         │
│   - Incluir Bearer token         │
│   - en Authorization header      │
└──────────────────────────────────┘
```

## Login

### Endpoint

```
POST /api/auth/login
```

### Request Body

```json
{
  "username": "juan.perez",
  "password": "password123"
}
```

### Respuesta Exitosa

```json
{
  "message": "Login successful",
  "requirePasswordChange": false,
  "token": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": "24h"
  },
  "user": {
    "id": "emp-123",
    "username": "juan.perez",
    "fullName": "Juan Pérez",
    "email": "juan.perez@company.com",
    "role": "user",
    "department": "IT",
    "position": "Developer",
    "votingGroup": "group-a"
  }
}
```

### Respuesta de Error

```json
{
  "error": "Unauthorized",
  "message": "Invalid username or password"
}
```

### Casos de Error

| Código | Error | Descripción |
|--------|-------|-------------|
| 400 | Bad Request | Username o password no proporcionados |
| 401 | Unauthorized | Credenciales inválidas |
| 401 | Unauthorized | Cuenta inactiva |
| 500 | Internal Server Error | Error del servidor |

### Ejemplo cURL

```bash
curl -X POST https://your-api.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "juan.perez",
    "password": "password123"
  }'
```

### Ejemplo JavaScript/TypeScript

```typescript
const login = async (username: string, password: string) => {
  const response = await fetch('https://your-api.azurewebsites.net/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Login failed');
  }

  return data;
};

// Uso
try {
  const result = await login('juan.perez', 'password123');

  // Guardar token
  localStorage.setItem('token', result.token.accessToken);

  // Verificar si necesita cambiar contraseña
  if (result.requirePasswordChange) {
    // Redirigir a página de cambio de contraseña
    window.location.href = '/change-password';
  } else {
    // Redirigir a la aplicación
    window.location.href = '/dashboard';
  }
} catch (error) {
  console.error('Login failed:', error.message);
}
```

## Primer Login y Cambio de Contraseña Obligatorio

### ¿Qué es el Primer Login?

Cuando un empleado es creado en el sistema, se le asigna una contraseña temporal y el campo `firstLogin` se marca como `true`. Al iniciar sesión por primera vez:

1. El login es **exitoso**
2. Se recibe el token JWT
3. La respuesta incluye `requirePasswordChange: true`
4. El usuario **DEBE** cambiar su contraseña antes de acceder a la aplicación

### Flujo del Cliente

```javascript
// 1. Usuario inicia sesión
const loginResult = await login('juan.perez', 'tempPassword123');

// 2. Verificar si requiere cambio de contraseña
if (loginResult.requirePasswordChange) {
  // 3. Mostrar formulario de cambio de contraseña
  // 4. El usuario ingresa su contraseña temporal y una nueva
  await changePassword(
    loginResult.token.accessToken,
    'tempPassword123',  // oldPassword (la temporal)
    'MyNewSecurePass123!'  // newPassword
  );

  // 5. Después del cambio exitoso, el usuario puede acceder
  window.location.href = '/dashboard';
} else {
  // Usuario regular, puede acceder directamente
  window.location.href = '/dashboard';
}
```

### Respuesta de Primer Login

```json
{
  "message": "Login successful",
  "requirePasswordChange": true,  // ← Indica primer login
  "token": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": "24h"
  },
  "user": {
    "id": "emp-123",
    "username": "juan.perez",
    "email": "juan.perez@company.com"
  }
}
```

### UI/UX Recomendada

```typescript
// Componente de Login
const LoginPage = () => {
  const handleLogin = async (username: string, password: string) => {
    try {
      const result = await login(username, password);

      if (result.requirePasswordChange) {
        // Mostrar modal o redirigir a página de cambio de contraseña
        return {
          status: 'REQUIRE_PASSWORD_CHANGE',
          token: result.token.accessToken,
          tempPassword: password,  // Guardar temporalmente
        };
      }

      return {
        status: 'SUCCESS',
        token: result.token.accessToken,
      };
    } catch (error) {
      return {
        status: 'ERROR',
        message: error.message,
      };
    }
  };
};

// Componente de Cambio de Contraseña Obligatorio
const ForcePasswordChange = ({ token, tempPassword }) => {
  const handlePasswordChange = async (newPassword: string) => {
    try {
      await changePassword(token, tempPassword, newPassword);
      alert('Contraseña cambiada exitosamente. Ahora puedes acceder a la aplicación.');
      window.location.href = '/dashboard';
    } catch (error) {
      alert('Error al cambiar contraseña: ' + error.message);
    }
  };

  return (
    <div className="force-password-change">
      <h2>Cambio de Contraseña Obligatorio</h2>
      <p>Por seguridad, debes cambiar tu contraseña temporal antes de continuar.</p>
      <form onSubmit={handlePasswordChange}>
        <input
          type="password"
          placeholder="Nueva contraseña (mín. 8 caracteres)"
          minLength={8}
          required
        />
        <button type="submit">Cambiar Contraseña</button>
      </form>
    </div>
  );
};
```

## Cambio de Contraseña

### Endpoint

```
POST /api/auth/change-password
```

### Headers Requeridos

```
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

```json
{
  "oldPassword": "currentPassword123",
  "newPassword": "newSecurePassword456!"
}
```

### Validaciones

- `oldPassword` es requerido
- `newPassword` es requerido
- `newPassword` debe tener mínimo **8 caracteres**
- `oldPassword` debe coincidir con la contraseña actual
- Token JWT válido requerido

### Respuesta Exitosa

```json
{
  "message": "Password changed successfully"
}
```

### Respuestas de Error

```json
// Contraseña actual incorrecta
{
  "error": "Bad Request",
  "message": "Current password is incorrect"
}

// Nueva contraseña muy corta
{
  "error": "Bad Request",
  "message": "New password must be at least 8 characters"
}

// Token no proporcionado
{
  "error": "Unauthorized",
  "message": "No token provided"
}

// Token inválido o expirado
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### Ejemplo cURL

```bash
curl -X POST https://your-api.azurewebsites.net/api/auth/change-password \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "tempPassword123",
    "newPassword": "MyNewSecurePass123!"
  }'
```

### Ejemplo JavaScript/TypeScript

```typescript
const changePassword = async (
  token: string,
  oldPassword: string,
  newPassword: string
) => {
  const response = await fetch('https://your-api.azurewebsites.net/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ oldPassword, newPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Password change failed');
  }

  return data;
};

// Uso
try {
  const token = localStorage.getItem('token');
  await changePassword(token, 'oldPass123', 'NewSecurePass456!');

  alert('Contraseña cambiada exitosamente');
} catch (error) {
  alert('Error: ' + error.message);
}
```

### Comportamiento del Sistema

Cuando se cambia la contraseña exitosamente:

1. La contraseña se hashea con bcrypt
2. Se actualiza en la base de datos
3. El flag `firstLogin` se marca como `false`
4. El campo `updatedAt` se actualiza
5. El usuario puede continuar usando su token actual (no se invalida)

## Verificación de Token

### Endpoint

```
GET /api/auth/verify
```

### Headers Requeridos

```
Authorization: Bearer <token>
```

### Respuesta Exitosa

```json
{
  "valid": true,
  "payload": {
    "userId": "emp-123",
    "username": "juan.perez",
    "email": "juan.perez@company.com",
    "roles": ["user"],
    "votingGroup": "group-a",
    "iat": 1234567890,
    "exp": 1234654290
  }
}
```

### Respuesta de Error

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### Ejemplo cURL

```bash
curl -X GET https://your-api.azurewebsites.net/api/auth/verify \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Ejemplo JavaScript/TypeScript

```typescript
const verifyToken = async (token: string) => {
  const response = await fetch('https://your-api.azurewebsites.net/api/auth/verify', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Token verification failed');
  }

  return data;
};

// Uso en un Auth Guard o interceptor
const checkAuth = async () => {
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = '/login';
    return;
  }

  try {
    const result = await verifyToken(token);
    console.log('User authenticated:', result.payload);
  } catch (error) {
    // Token inválido o expirado
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
};
```

## Manejo de Errores

### Códigos de Estado HTTP

| Código | Significado | Cuándo Ocurre |
|--------|-------------|---------------|
| 200 | OK | Operación exitosa |
| 400 | Bad Request | Datos inválidos, contraseña muy corta |
| 401 | Unauthorized | Credenciales inválidas, token inválido/expirado, cuenta inactiva |
| 405 | Method Not Allowed | Método HTTP incorrecto |
| 500 | Internal Server Error | Error del servidor |

### Mensajes de Error Comunes

#### Login
- `"Username and password are required"` - Datos faltantes
- `"Invalid username or password"` - Credenciales incorrectas
- `"Account is inactive"` - Cuenta deshabilitada

#### Cambio de Contraseña
- `"Old password and new password are required"` - Datos faltantes
- `"New password must be at least 8 characters"` - Contraseña muy corta
- `"Current password is incorrect"` - Contraseña actual incorrecta
- `"No token provided"` - Token JWT no enviado
- `"Invalid or expired token"` - Token inválido o expirado
- `"Employee not found"` - Usuario no existe

## Ejemplos de Integración

### React + TypeScript

```typescript
// services/authService.ts
import axios from 'axios';

const API_URL = 'https://your-api.azurewebsites.net/api/auth';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  requirePasswordChange: boolean;
  token: {
    accessToken: string;
    tokenType: string;
    expiresIn: string;
  };
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: string;
    department: string;
    position: string;
    votingGroup: string;
  };
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await axios.post(`${API_URL}/login`, credentials);
    return data;
  },

  async changePassword(token: string, request: ChangePasswordRequest): Promise<void> {
    await axios.post(`${API_URL}/change-password`, request, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async verifyToken(token: string): Promise<any> {
    const { data } = await axios.get(`${API_URL}/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },
};

// hooks/useAuth.ts
import { useState } from 'react';
import { authService } from '../services/authService';

export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await authService.login({ username, password });

      // Guardar token
      localStorage.setItem('token', result.token.accessToken);

      return result;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      await authService.changePassword(token, { oldPassword, newPassword });
    } catch (err: any) {
      const message = err.response?.data?.message || 'Password change failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return { login, changePassword, logout, loading, error };
};

// components/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await login(username, password);

      if (result.requirePasswordChange) {
        // Guardar contraseña temporal para el flujo de cambio
        sessionStorage.setItem('tempPassword', password);
        navigate('/change-password-required');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      // El error se maneja en el hook
      console.error('Login error:', err);
    }
  };

  return (
    <div className="login-page">
      <h1>Iniciar Sesión</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
};

// components/ChangePasswordRequired.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const ChangePasswordRequired = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { changePassword, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      alert('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    try {
      const tempPassword = sessionStorage.getItem('tempPassword');
      if (!tempPassword) {
        alert('Error: No se encontró la contraseña temporal');
        navigate('/login');
        return;
      }

      await changePassword(tempPassword, newPassword);

      // Limpiar contraseña temporal
      sessionStorage.removeItem('tempPassword');

      alert('Contraseña cambiada exitosamente');
      navigate('/dashboard');
    } catch (err) {
      console.error('Password change error:', err);
    }
  };

  return (
    <div className="change-password-required">
      <h1>Cambio de Contraseña Obligatorio</h1>
      <p>Por seguridad, debes cambiar tu contraseña temporal.</p>

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Nueva contraseña (mín. 8 caracteres)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          required
        />
        <input
          type="password"
          placeholder="Confirmar nueva contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Cambiando contraseña...' : 'Cambiar Contraseña'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
};
```

### Angular

```typescript
// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://your-api.azurewebsites.net/api/auth';

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { username, password });
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.post(
      `${this.apiUrl}/change-password`,
      { oldPassword, newPassword },
      { headers }
    );
  }

  verifyToken(): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.get(`${this.apiUrl}/verify`, { headers });
  }

  logout(): void {
    localStorage.removeItem('token');
  }
}
```

## Seguridad

### Mejores Prácticas

1. **Almacenamiento de Token**
   - Usar `localStorage` o `sessionStorage` en el cliente
   - Nunca almacenar en cookies sin HttpOnly
   - Limpiar el token al cerrar sesión

2. **HTTPS Obligatorio**
   - Todas las peticiones deben ser por HTTPS
   - Nunca enviar credenciales por HTTP

3. **Validación de Contraseñas**
   - Mínimo 8 caracteres
   - Recomendar combinación de mayúsculas, minúsculas, números y símbolos
   - Validar en el cliente Y en el servidor

4. **Tokens JWT**
   - Tiempo de expiración: 24 horas (configurable)
   - No almacenar información sensible en el payload
   - Verificar firma en cada petición

5. **Cambio de Contraseña Obligatorio**
   - Siempre requerir contraseña temporal en primer login
   - Marcar `firstLogin = false` después del cambio exitoso
   - No permitir acceso sin cambio de contraseña

## Troubleshooting

### "Invalid username or password" pero las credenciales son correctas
- Verificar que la cuenta esté activa (`isActive: true`)
- Verificar que el username sea exacto (case-sensitive)
- Verificar que la contraseña no haya sido hasheada dos veces

### "Invalid or expired token"
- El token tiene 24 horas de validez
- Verificar que se esté enviando en el header Authorization
- Verificar formato: `Bearer <token>`

### "Current password is incorrect" en cambio de contraseña
- Verificar que se esté usando la contraseña actual (no la nueva)
- En primer login, usar la contraseña temporal proporcionada

### El flag `requirePasswordChange` no se limpia
- Verificar que el endpoint de cambio de contraseña se ejecute correctamente
- Verificar que el campo `firstLogin` se actualice a `false` en la base de datos
