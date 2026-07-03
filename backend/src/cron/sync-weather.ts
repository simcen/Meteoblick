import 'dotenv/config';
import '../services/fetch-client.js';
import { fetchPOIsFromMeteoSwiss, fetchWeatherFromMeteoSwiss } from '../services/meteoswiss.js';
import { upsertPOI, upsertWeather, initDatabase } from '../services/db.js';

export async function syncWeatherData() {
  console.log('🔄 Starting weather sync...');

  try {
    const pois = await fetchPOIsFromMeteoSwiss();
    console.log(`💾 Upserting ${pois.length} POIs to database...`);

    for (const poi of pois) {
      await upsertPOI(poi);
    }

    console.log('✅ POIs synced');

    const weatherData = await fetchWeatherFromMeteoSwiss();
    console.log(`💾 Upserting ${weatherData.length} weather records to database...`);

    for (const weather of weatherData) {
      await upsertWeather(weather);
    }

    console.log('✅ Weather data synced successfully');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Running manual sync...');
  await initDatabase();
  await syncWeatherData();
  process.exit(0);
}
