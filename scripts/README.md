# Scripts de Migración - Periodos de Votación 2025

## 📋 Descripción

Este directorio contiene scripts para crear en masa los periodos de votación del año 2025 con status `closed`.

## 📁 Archivos

- **`2025-voting-periods.json`** - Datos de los 12 periodos del 2025
- **`create-2025-periods.sh`** - Script Bash para crear periodos
- **`create-2025-periods.js`** - Script Node.js para crear periodos

## 🚀 Uso

### Opción 1: Script Node.js (Recomendado)

```bash
# Sintaxis
node scripts/create-2025-periods.js [API_URL] [ADMIN_TOKEN]

# Ejemplo con API local
node scripts/create-2025-periods.js http://localhost:7071 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Ejemplo con API de producción
node scripts/create-2025-periods.js https://api.tudominio.com YOUR_ADMIN_JWT_TOKEN
```

### Opción 2: Script Bash

```bash
# Sintaxis
./scripts/create-2025-periods.sh [API_URL] ADMIN_TOKEN

# Ejemplo
./scripts/create-2025-periods.sh http://localhost:7071 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Nota:** El script bash requiere `jq` instalado:
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq
```

## 🔑 Obtener el Token de Admin

Para ejecutar estos scripts necesitas un token JWT de un usuario con rol `admin`.

### Desde el frontend:
1. Inicia sesión como admin
2. Abre las DevTools del navegador (F12)
3. Ve a la pestaña "Application" > "Local Storage"
4. Busca el token JWT (usualmente bajo la clave `token` o `authToken`)

### Desde Postman o similar:
1. Haz login con credenciales de admin:
```bash
POST /api/auth/login
{
  "email": "admin@lmmc.com",
  "password": "tu_password"
}
```
2. Copia el token de la respuesta

## 📊 Formato del JSON

Cada periodo tiene esta estructura:

```json
{
  "year": 2025,
  "month": 1,
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2025-01-31T23:59:59.999Z",
  "description": "Periodo de votación Enero 2025",
  "status": "closed"
}
```

## ✅ Salida Esperada

```
🚀 Creando periodos de votación para 2025...
API URL: http://localhost:7071

📅 Creando periodo: 2025-1...
   ✅ Creado exitosamente - ID: vp-2025-1

📅 Creando periodo: 2025-2...
   ✅ Creado exitosamente - ID: vp-2025-2

...

======================================
✨ Proceso completado
   ✅ Creados exitosamente: 12
   ❌ Errores: 0
======================================
```

## ⚠️ Importante

1. **Ejecutar UNA SOLA VEZ** - Los periodos no se pueden duplicar (error si ya existe un periodo para el mismo año/mes)
2. **Solo admins** - Requiere permisos de administrador
3. **Auditoría** - Cada creación se registra en el log de auditoría con tu usuario
4. **Status closed** - Todos los periodos se crean con status `closed` (ya finalizados)

## 🔍 Verificar Periodos Creados

Después de ejecutar el script, verifica que se crearon correctamente:

```bash
# Listar todos los periodos
curl http://localhost:7071/api/voting-periods \
  -H "Authorization: Bearer YOUR_TOKEN"

# Ver auditoría de un periodo específico
curl http://localhost:7071/api/voting/vp-2025-1/audit-history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🛠️ Personalización

Para modificar los periodos:

1. Edita `2025-voting-periods.json`
2. Cambia fechas, descripciones o status según necesites
3. Ejecuta el script nuevamente (si el periodo ya existe, dará error)

## 📝 Ejemplo: Crear un Solo Periodo

Si prefieres crear periodos manualmente:

```bash
curl -X POST http://localhost:7071/api/voting-periods \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "year": 2025,
    "month": 1,
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-01-31T23:59:59.999Z",
    "description": "Periodo Enero 2025",
    "status": "closed"
  }'
```

## 🐛 Troubleshooting

### Error: "A voting period already exists"
- **Causa:** Ya existe un periodo para ese año/mes
- **Solución:** Usa el endpoint PUT para actualizar en lugar de crear

### Error: "Admin access required"
- **Causa:** El token no es de un usuario admin
- **Solución:** Verifica que el usuario tenga el rol `admin`

### Error: "Token expired"
- **Causa:** El JWT expiró
- **Solución:** Genera un nuevo token haciendo login nuevamente

### Script no encuentra el JSON
- **Causa:** Ejecutando desde directorio incorrecto
- **Solución:** Ejecuta desde la raíz del proyecto o ajusta la ruta

---

**Creado:** 2025-10-10
**Autor:** Sistema de Auditoría
