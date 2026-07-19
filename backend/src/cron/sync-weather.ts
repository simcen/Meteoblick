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
      try {
        await upsertPOI(poi);
      } catch (err) {
        console.warn(`⚠️  Skipping POI "${poi.point_name}" (${poi.point_id}): ${err.message}`);
      }
    }

    console.log('✅ POIs synced');

    const weatherData = await fetchWeatherFromMeteoSwiss();
    console.log(`💾 Upserting ${weatherData.length} weather records to database...`);

    let weatherInserted = 0;
    let weatherSkipped = 0;
    // Debug: verify the weather point_ids actually exist in pois.
    // If FK fails, this tells us whether the bug is in upsertPOI (didn't
    // insert) or in fetchWeather (different IDs).
    const poiIds = new Set(pois.map((p) => p.point_id));
    const sampleMissing = weatherData
      .filter((w) => !poiIds.has(w.point_id))
      .slice(0, 5);
    if (sampleMissing.length > 0) {
      console.log(
        `🔍 Debug: ${sampleMissing.length} weather point_ids missing from pois. ` +
          `Samples: ${sampleMissing.map((w) => w.point_id).join(", ")}. ` +
          `Weather data length=${weatherData.length}, POI count=${pois.length}.`,
      );
    }

    for (const weather of weatherData) {
      try {
        await upsertWeather(weather);
        weatherInserted++;
      } catch (err) {
        // Most common cause: weather.point_id has no matching pois row
        // (FK violation). Skip instead of aborting the whole sync.
        weatherSkipped++;
        if (weatherSkipped <= 3 || weatherSkipped % 100 === 0) {
          console.warn(
            `⚠️  Skipping weather for ${weather.point_id}: ${err.message.split('\n')[0]}`,
          );
        }
      }
    }

    console.log(
      `✅ Weather data synced: ${weatherInserted} inserted, ${weatherSkipped} skipped`,
    );
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
