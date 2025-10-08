import { CosmosClient } from '../src/common/utils/CosmosClient';
import { WinnerHistory } from '../src/common/models/WinnerHistory';
import { COSMOS_DB_ENDPOINT, COSMOS_DB_KEY, COSMOS_DB_NAME } from '../src/config/env.config';
import * as fs from 'fs';
import * as path from 'path';

async function importSampleWinners() {
  try {
    console.log('🚀 Starting import of sample winners...');

    // Initialize Cosmos DB client
    const endpoint = COSMOS_DB_ENDPOINT;
    const key = COSMOS_DB_KEY;
    const databaseId = COSMOS_DB_NAME;

    if (!endpoint || !key) {
      throw new Error('COSMOS_DB_ENDPOINT and COSMOS_DB_KEY environment variables are required');
    }

    const cosmosClient = new CosmosClient(endpoint, key, databaseId);
    await cosmosClient.createDatabaseIfNotExists();
    await cosmosClient.initializeContainers();

    // Read sample data
    const sampleDataPath = path.join(__dirname, '..', '__mocks__', 'winners-import.json');
    const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf-8'));

    console.log(`📦 Found ${sampleData.length} winners to import`);

    // Get container
    const container = await cosmosClient.getContainer('winnerHistory');

    // Import each winner
    let successCount = 0;
    let errorCount = 0;

    for (const winner of sampleData) {
      try {
        // Convert date string to Date object
        const winnerData: WinnerHistory = {
          ...winner,
          createdAt: new Date(winner.createdAt),
        };

        await container.items.create(winnerData);
        successCount++;
        console.log(
          `✅ Imported: ${winnerData.employeeName} (${winnerData.year}-${String(winnerData.month).padStart(2, '0')}) - ${winnerData.winnerType}`
        );
      } catch (error) {
        errorCount++;
        console.error(`❌ Error importing winner ${winner.id}:`, error);
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Successfully imported: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📈 Total: ${sampleData.length}`);
    console.log('\n✨ Import completed!');
  } catch (error) {
    console.error('💥 Fatal error during import:', error);
    process.exit(1);
  }
}

// Run the import
importSampleWinners();
