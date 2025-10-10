/**
 * Script para corregir el status de TODOS los periodos basándose en sus fechas
 *
 * Este script actualiza TODOS los periodos, incluso si ya tienen status,
 * determinando el status correcto basándose en las fechas.
 *
 * Uso:
 *   node scripts/fix-period-status.js [API_URL] [ADMIN_TOKEN]
 *
 * Ejemplo:
 *   node scripts/fix-period-status.js http://localhost:7071 eyJhbGc...
 */

const API_URL = process.argv[2] || 'http://localhost:7071';
const ADMIN_TOKEN = process.argv[3];

if (!ADMIN_TOKEN) {
  console.error('❌ Error: Se requiere el token de administrador');
  console.error('Uso: node scripts/fix-period-status.js [API_URL] ADMIN_TOKEN');
  console.error('Ejemplo: node scripts/fix-period-status.js http://localhost:7071 eyJhbGc...');
  process.exit(1);
}

console.log('🔄 Corrigiendo status de periodos de votación...');
console.log(`API URL: ${API_URL}`);
console.log('');

let updated = 0;
let skipped = 0;
let errors = 0;

async function fixPeriodStatus() {
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

    const now = new Date();

    // 2. Actualizar TODOS los periodos basándose en fechas
    for (const period of periods) {
      const periodId = period.id;
      const currentStatus = period.status || 'undefined';

      console.log(`🔍 Analizando periodo ${period.year}-${period.month} (${periodId})`);
      console.log(`   Status actual: ${currentStatus}`);

      // Determinar el status correcto basado en la fecha
      let correctStatus = 'closed'; // Por defecto

      if (period.endDate) {
        const endDate = new Date(period.endDate);

        if (endDate < now) {
          correctStatus = 'closed'; // Ya pasó
        } else if (period.startDate) {
          const startDate = new Date(period.startDate);
          if (startDate > now) {
            correctStatus = 'pending'; // Aún no empieza
          } else {
            correctStatus = 'active'; // En curso
          }
        }

        console.log(`   Fecha fin: ${endDate.toISOString()}`);
        console.log(`   Fecha actual: ${now.toISOString()}`);
        console.log(`   Status correcto: ${correctStatus}`);
      }

      // Si el status ya es correcto, omitir
      if (currentStatus === correctStatus) {
        console.log(`   ✅ Status ya es correcto\n`);
        skipped++;
        continue;
      }

      // Actualizar el periodo
      console.log(`   🔧 Actualizando ${currentStatus} → ${correctStatus}...`);

      try {
        const updateResponse = await fetch(`${API_URL}/api/voting/${periodId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ADMIN_TOKEN}`,
          },
          body: JSON.stringify({
            status: correctStatus,
          }),
        });

        if (updateResponse.ok) {
          console.log(`   ✅ Actualizado exitosamente\n`);
          updated++;
        } else {
          const errorData = await updateResponse.text();
          console.log(`   ❌ Error HTTP ${updateResponse.status}: ${errorData}\n`);
          errors++;
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
        errors++;
      }
    }

    // 3. Resumen
    console.log('======================================');
    console.log('✨ Corrección completada');
    console.log(`   ✅ Actualizados: ${updated}`);
    console.log(`   ⏭️  Omitidos (ya correctos): ${skipped}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log('======================================');

    // 4. Verificar periodos cerrados
    if (updated > 0 || skipped > 0) {
      console.log('\n🔍 Verificando periodos cerrados...');
      const verifyResponse = await fetch(`${API_URL}/api/voting-periods`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
        },
      });

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        const updatedPeriods = verifyData.data || verifyData;
        const closedPeriods = updatedPeriods.filter(p => p.status === 'closed');
        const activePeriods = updatedPeriods.filter(p => p.status === 'active');
        const pendingPeriods = updatedPeriods.filter(p => p.status === 'pending');
        const withoutStatus = updatedPeriods.filter(p => !p.status);

        console.log(`📊 Resumen de status:`);
        console.log(`   🔴 Cerrados: ${closedPeriods.length}`);
        console.log(`   🟢 Activos: ${activePeriods.length}`);
        console.log(`   🟡 Pendientes: ${pendingPeriods.length}`);
        console.log(`   ⚠️  Sin status: ${withoutStatus.length}`);

        if (closedPeriods.length > 0) {
          console.log('\n✅ Periodos cerrados encontrados:');
          closedPeriods.forEach(p => {
            console.log(`   - ${p.year}-${p.month} (${p.id})`);
          });
        }
      }
    }

    // 5. Probar endpoint de current winner
    console.log('\n🎯 Probando /api/voting/winners/current...');
    try {
      const winnerResponse = await fetch(`${API_URL}/api/voting/winners/current`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
        },
      });

      if (winnerResponse.ok) {
        const winnerData = await winnerResponse.json();
        if (winnerData.success && winnerData.data) {
          console.log('✅ Ganador actual encontrado:');
          console.log(`   Empleado: ${winnerData.data.employeeName}`);
          console.log(`   Periodo: ${winnerData.data.year}-${winnerData.data.month}`);
          console.log(`   Departamento: ${winnerData.data.department}`);
        } else {
          console.log('⚠️  No se encontró ganador actual');
          console.log(`   Respuesta: ${JSON.stringify(winnerData)}`);
        }
      } else {
        const errorText = await winnerResponse.text();
        console.log(`❌ Error al obtener ganador: HTTP ${winnerResponse.status}`);
        console.log(`   ${errorText}`);
      }
    } catch (error) {
      console.log(`❌ Error al probar endpoint: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

// Ejecutar
fixPeriodStatus();
