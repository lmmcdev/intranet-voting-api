/**
 * Script para crear todos los periodos de votación del 2025
 *
 * Uso:
 *   node scripts/create-2025-periods.js [API_URL] [ADMIN_TOKEN]
 *
 * Ejemplo:
 *   node scripts/create-2025-periods.js http://localhost:7071 eyJhbGc...
 */

const fs = require('fs');
const path = require('path');

// Configuración
const API_URL = process.argv[2] || 'http://localhost:7071';
const ADMIN_TOKEN = process.argv[3];

if (!ADMIN_TOKEN) {
  console.error('❌ Error: Se requiere el token de administrador');
  console.error('Uso: node scripts/create-2025-periods.js [API_URL] ADMIN_TOKEN');
  console.error('Ejemplo: node scripts/create-2025-periods.js http://localhost:7071 eyJhbGc...');
  process.exit(1);
}

// Leer el archivo JSON
const periodsFile = path.join(__dirname, '2025-voting-periods.json');
const periods = JSON.parse(fs.readFileSync(periodsFile, 'utf8'));

console.log('🚀 Creando periodos de votación para 2025...');
console.log(`API URL: ${API_URL}`);
console.log('');

let success = 0;
let errors = 0;

// Función para crear un periodo
async function createPeriod(period) {
  try {
    const response = await fetch(`${API_URL}/api/voting-periods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify(period),
    });

    const data = await response.json();

    if (response.status === 201) {
      console.log(`   ✅ Creado exitosamente - ID: ${data.id}`);
      success++;
      return true;
    } else {
      console.log(`   ❌ Error al crear - HTTP ${response.status}`);
      console.log(`   Respuesta:`, data);
      errors++;
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    errors++;
    return false;
  }
}

// Función principal
async function main() {
  for (const period of periods) {
    console.log(`📅 Creando periodo: ${period.year}-${period.month}...`);
    await createPeriod(period);
    console.log('');

    // Pequeña pausa para no saturar el servidor
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('======================================');
  console.log('✨ Proceso completado');
  console.log(`   ✅ Creados exitosamente: ${success}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log('======================================');
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
