/**
 * Script de diagnóstico para inspeccionar periodos y sus status
 *
 * Este script muestra información detallada sobre todos los periodos
 * para diagnosticar por qué /winners/current no encuentra periodos cerrados
 *
 * Uso:
 *   node scripts/diagnose-periods.js [API_URL] [ADMIN_TOKEN]
 *
 * Ejemplo:
 *   node scripts/diagnose-periods.js http://localhost:7071 eyJhbGc...
 */

const API_URL = process.argv[2] || 'http://localhost:7071';
const ADMIN_TOKEN = process.argv[3];

if (!ADMIN_TOKEN) {
  console.error('❌ Error: Se requiere el token de administrador');
  console.error('Uso: node scripts/diagnose-periods.js [API_URL] ADMIN_TOKEN');
  process.exit(1);
}

console.log('🔍 Diagnosticando periodos de votación...');
console.log(`API URL: ${API_URL}\n`);

async function diagnose() {
  try {
    // 1. Obtener todos los periodos
    console.log('📥 Obteniendo todos los periodos...');
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
      throw new Error(`Respuesta inesperada del API`);
    }

    console.log(`✅ Encontrados ${periods.length} periodos\n`);

    // 2. Analizar cada periodo
    console.log('📊 Análisis detallado de periodos:\n');
    console.log('='.repeat(120));

    const now = new Date();
    let closedCount = 0;
    let activeCount = 0;
    let pendingCount = 0;
    let undefinedCount = 0;

    periods.forEach((period, index) => {
      console.log(`\n${index + 1}. Periodo: ${period.year}-${period.month} (ID: ${period.id})`);
      console.log(`   Status guardado: ${period.status === undefined ? '❌ UNDEFINED' : period.status}`);
      console.log(`   Tipo de status: ${typeof period.status}`);
      console.log(`   Start Date: ${period.startDate}`);
      console.log(`   End Date: ${period.endDate}`);
      console.log(`   Created At: ${period.createdAt}`);

      // Verificar qué status DEBERÍA tener
      if (period.endDate) {
        const endDate = new Date(period.endDate);
        const startDate = period.startDate ? new Date(period.startDate) : null;

        let expectedStatus = 'unknown';
        if (endDate < now) {
          expectedStatus = 'closed';
        } else if (startDate && startDate > now) {
          expectedStatus = 'pending';
        } else {
          expectedStatus = 'active';
        }

        console.log(`   Status esperado: ${expectedStatus}`);
        console.log(`   ¿Coincide?: ${period.status === expectedStatus ? '✅ SÍ' : '❌ NO'}`);
      }

      // Contar por status
      if (period.status === 'closed') closedCount++;
      else if (period.status === 'active') activeCount++;
      else if (period.status === 'pending') pendingCount++;
      else undefinedCount++;

      console.log('-'.repeat(120));
    });

    console.log('\n📈 Resumen de status:');
    console.log(`   🔴 Cerrados (closed): ${closedCount}`);
    console.log(`   🟢 Activos (active): ${activeCount}`);
    console.log(`   🟡 Pendientes (pending): ${pendingCount}`);
    console.log(`   ⚠️  Sin status (undefined): ${undefinedCount}`);

    // 3. Verificar periodos cerrados específicamente
    if (closedCount > 0) {
      console.log('\n✅ Periodos con status "closed":');
      periods
        .filter(p => p.status === 'closed')
        .forEach(p => {
          console.log(`   - ${p.year}-${p.month} (${p.id})`);
        });
    } else {
      console.log('\n❌ NO hay periodos con status "closed"');
      console.log('   Esto explica por qué /winners/current no encuentra nada');
    }

    // 4. Verificar periodo octubre 2025 específicamente
    console.log('\n🎯 Verificación de periodo octubre 2025 (vp-2025-10):');
    const oct2025 = periods.find(p => p.id === 'vp-2025-10' || (p.year === 2025 && p.month === 10));

    if (oct2025) {
      console.log('   ✅ Periodo encontrado');
      console.log(`   Status actual: ${oct2025.status === undefined ? 'UNDEFINED' : oct2025.status}`);
      console.log(`   End Date: ${oct2025.endDate}`);
      console.log(`   ¿Ya pasó?: ${new Date(oct2025.endDate) < now ? 'SÍ' : 'NO'}`);

      if (oct2025.status !== 'closed') {
        console.log('   ⚠️  PROBLEMA: Este periodo DEBERÍA estar cerrado pero su status es:', oct2025.status);
      }
    } else {
      console.log('   ❌ Periodo NO encontrado en la base de datos');
    }

    // 5. Probar el endpoint de ganador actual
    console.log('\n🏆 Probando endpoint /api/voting/winners/current...');
    try {
      const winnerResponse = await fetch(`${API_URL}/api/voting/winners/current`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
        },
      });

      const winnerData = await winnerResponse.json();

      if (winnerData.success && winnerData.data) {
        console.log('✅ Ganador encontrado:');
        console.log(`   Nombre: ${winnerData.data.employeeName}`);
        console.log(`   Periodo: ${winnerData.data.year}-${winnerData.data.month}`);
        console.log(`   Departamento: ${winnerData.data.department}`);
      } else {
        console.log('❌ No se encontró ganador');
        console.log(`   Error: ${winnerData.error || 'Unknown'}`);
      }
    } catch (error) {
      console.log(`❌ Error al probar endpoint: ${error.message}`);
    }

    // 6. Recomendaciones
    console.log('\n💡 Recomendaciones:');
    if (undefinedCount > 0) {
      console.log(`   1. Hay ${undefinedCount} periodos sin status. Ejecuta:`);
      console.log('      node scripts/fix-period-status.js http://localhost:7071 YOUR_TOKEN');
    }
    if (closedCount === 0) {
      console.log('   2. NO hay periodos cerrados. Asegúrate de que:');
      console.log('      - Los periodos tienen endDate en el pasado');
      console.log('      - El campo status se está guardando correctamente en Cosmos DB');
    }
    if (oct2025 && oct2025.status !== 'closed') {
      console.log('   3. El periodo octubre 2025 existe pero no está cerrado');
      console.log('      Actualízalo manualmente con:');
      console.log(`      PUT ${API_URL}/api/voting/${oct2025.id}`);
      console.log('      Body: { "status": "closed" }');
    }

  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

// Ejecutar
diagnose();
