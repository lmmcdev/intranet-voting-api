/**
 * Script de migración: Agregar campo 'status' a periodos existentes
 *
 * Este script actualiza todos los periodos de votación existentes
 * para agregar el campo 'status' si no lo tienen.
 *
 * Uso:
 *   node scripts/migrate-add-status-to-periods.js [API_URL] [ADMIN_TOKEN] [DEFAULT_STATUS]
 *
 * Ejemplo:
 *   node scripts/migrate-add-status-to-periods.js http://localhost:7071 eyJhbGc... closed
 */

const API_URL = process.argv[2] || 'http://localhost:7071';
const ADMIN_TOKEN = process.argv[3];
const DEFAULT_STATUS = process.argv[4] || 'closed'; // closed, active, o pending

if (!ADMIN_TOKEN) {
  console.error('❌ Error: Se requiere el token de administrador');
  console.error('Uso: node scripts/migrate-add-status-to-periods.js [API_URL] ADMIN_TOKEN [DEFAULT_STATUS]');
  console.error('Ejemplo: node scripts/migrate-add-status-to-periods.js http://localhost:7071 eyJhbGc... closed');
  process.exit(1);
}

const validStatuses = ['active', 'closed', 'pending'];
if (!validStatuses.includes(DEFAULT_STATUS)) {
  console.error(`❌ Error: Status inválido '${DEFAULT_STATUS}'. Debe ser: active, closed, o pending`);
  process.exit(1);
}

console.log('🔄 Migrando periodos de votación...');
console.log(`API URL: ${API_URL}`);
console.log(`Status por defecto: ${DEFAULT_STATUS}`);
console.log('');

let updated = 0;
let skipped = 0;
let errors = 0;

async function migratePeriods() {
  try {
    // 1. Obtener todos los periodos
    console.log('📥 Obteniendo periodos existentes...');
    const response = await fetch(`${API_URL}/api/voting-periods`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al obtener periodos: HTTP ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    const periods = responseData.data || responseData;

    if (!Array.isArray(periods)) {
      throw new Error(`Respuesta inesperada del API. Esperaba un array, recibió: ${JSON.stringify(responseData).substring(0, 200)}`);
    }

    console.log(`✅ Encontrados ${periods.length} periodos\n`);

    // 2. Actualizar cada periodo que no tenga status
    for (const period of periods) {
      const periodId = period.id;
      const hasStatus = period.status !== undefined && period.status !== null;

      if (hasStatus) {
        console.log(`⏭️  Periodo ${period.year}-${period.month} (${periodId}) ya tiene status: ${period.status}`);
        skipped++;
        continue;
      }

      console.log(`🔧 Actualizando periodo ${period.year}-${period.month} (${periodId})...`);

      try {
        // Determinar el status basado en la fecha
        let status = DEFAULT_STATUS;

        // Si tiene fechas, determinar automáticamente
        if (period.endDate) {
          const endDate = new Date(period.endDate);
          const now = new Date();

          if (endDate < now) {
            status = 'closed'; // Ya pasó
          } else if (period.startDate) {
            const startDate = new Date(period.startDate);
            if (startDate > now) {
              status = 'pending'; // Aún no empieza
            } else {
              status = 'active'; // En curso
            }
          }
        }

        const updateResponse = await fetch(`${API_URL}/api/voting/${periodId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ADMIN_TOKEN}`,
          },
          body: JSON.stringify({
            status: status,
          }),
        });

        if (updateResponse.ok) {
          console.log(`   ✅ Actualizado a status: ${status}`);
          updated++;
        } else {
          const errorData = await updateResponse.text();
          console.log(`   ❌ Error HTTP ${updateResponse.status}: ${errorData}`);
          errors++;
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errors++;
      }

      console.log('');
    }

    // 3. Resumen
    console.log('======================================');
    console.log('✨ Migración completada');
    console.log(`   ✅ Actualizados: ${updated}`);
    console.log(`   ⏭️  Omitidos (ya tenían status): ${skipped}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log('======================================');

    // 4. Verificar
    if (updated > 0) {
      console.log('\n🔍 Verificando cambios...');
      const verifyResponse = await fetch(`${API_URL}/api/voting-periods`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
        },
      });

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        const updatedPeriods = verifyData.data || verifyData;
        const withoutStatus = updatedPeriods.filter(p => !p.status);

        if (withoutStatus.length === 0) {
          console.log('✅ Todos los periodos tienen status ahora!');
        } else {
          console.log(`⚠️  Aún hay ${withoutStatus.length} periodos sin status`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

// Ejecutar
migratePeriods();
