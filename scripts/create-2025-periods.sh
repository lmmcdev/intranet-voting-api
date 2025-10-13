#!/bin/bash

# Script para crear todos los periodos de votación del 2025
# Uso: ./scripts/create-2025-periods.sh [API_URL] [ADMIN_TOKEN]

API_URL="${1:-http://localhost:7071}"
ADMIN_TOKEN="${2}"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "Error: Se requiere el token de administrador"
  echo "Uso: $0 [API_URL] ADMIN_TOKEN"
  echo "Ejemplo: $0 http://localhost:7071 eyJhbGc..."
  exit 1
fi

echo "🚀 Creando periodos de votación para 2025..."
echo "API URL: $API_URL"
echo ""

# Leer el archivo JSON
PERIODS_FILE="$(dirname "$0")/2025-voting-periods.json"

if [ ! -f "$PERIODS_FILE" ]; then
  echo "❌ Error: No se encuentra el archivo $PERIODS_FILE"
  exit 1
fi

# Contador de éxitos y errores
SUCCESS=0
ERRORS=0

# Leer cada periodo del JSON y crear uno por uno
jq -c '.[]' "$PERIODS_FILE" | while read -r period; do
  YEAR=$(echo "$period" | jq -r '.year')
  MONTH=$(echo "$period" | jq -r '.month')

  echo "📅 Creando periodo: $YEAR-$MONTH..."

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/voting-periods" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "$period")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)

  if [ "$HTTP_CODE" -eq 201 ]; then
    PERIOD_ID=$(echo "$BODY" | jq -r '.id')
    echo "   ✅ Creado exitosamente - ID: $PERIOD_ID"
    ((SUCCESS++))
  else
    echo "   ❌ Error al crear - HTTP $HTTP_CODE"
    echo "   Respuesta: $BODY"
    ((ERRORS++))
  fi

  echo ""

  # Pequeña pausa para no saturar el servidor
  sleep 0.5
done

echo "======================================"
echo "✨ Proceso completado"
echo "   ✅ Creados exitosamente: $SUCCESS"
echo "   ❌ Errores: $ERRORS"
echo "======================================"
