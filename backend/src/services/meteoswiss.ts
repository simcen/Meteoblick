import Papa from 'papaparse';
import type { POI, WeatherData } from '../models/types.js';
import { fetchWithProxy } from './fetch-client.js';

const STAC_API_BASE = 'https://data.geo.admin.ch/api/stac/v1';
const COLLECTION_ID = 'ch.meteoschweiz.ogd-local-forecasting';

interface StacAsset {
  href: string;
  type: string;
  title?: string;
}

interface StacItem {
  id: string;
  assets: Record<string, StacAsset>;
  properties: Record<string, any>;
}

interface StacItemsResponse {
  features: StacItem[];
}

export async function fetchPOIsFromMeteoSwiss(): Promise<POI[]> {
  console.log('📡 Fetching POI metadata from MeteoSwiss...');

  const metaUrl = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-local-forecasting/ogd-local-forecasting_meta_point.csv';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetchWithProxy(metaUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`POI metadata download failed: ${response.status}`);
    }

    const csvText = await response.text();

    const parsed = Papa.parse<string[]>(csvText, {
      delimiter: ';',
      skipEmptyLines: true,
      header: false,
    });

    const pois: POI[] = [];

    for (let i = 1; i < parsed.data.length; i++) {
      const row = parsed.data[i];

      const pointId = row[0];
      const postalCode = row[3];
      const pointName = row[4];
      const heightMasl = row[9] ? parseFloat(row[9]) : null;
      const lat = parseFloat(row[12]);
      const lon = parseFloat(row[13]);

      if (!pointId || !pointName || isNaN(lat) || isNaN(lon)) {
        continue;
      }

      pois.push({
        point_id: pointId,
        point_name: pointName,
        postal_code: postalCode || null,
        latitude: lat,
        longitude: lon,
        height_masl: heightMasl,
      });
    }

    console.log(`✅ Loaded ${pois.length} POIs from MeteoSwiss`);
    return pois;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('POI metadata fetch timeout after 60s');
    }
    throw error;
  }
}

export async function fetchWeatherFromMeteoSwiss(): Promise<WeatherData[]> {
  console.log('📡 Fetching weather data from MeteoSwiss STAC API...');

  const itemsUrl = `${STAC_API_BASE}/collections/${COLLECTION_ID}/items?limit=1`;

  const stacController = new AbortController();
  const stacTimeoutId = setTimeout(() => stacController.abort(), 30000);

  try {
    const itemsResponse = await fetchWithProxy(itemsUrl, { signal: stacController.signal });
    clearTimeout(stacTimeoutId);

    if (!itemsResponse.ok) {
      throw new Error(`STAC API returned ${itemsResponse.status}`);
    }

    const itemsData: StacItemsResponse = await itemsResponse.json();
    if (!itemsData.features || itemsData.features.length === 0) {
      throw new Error('No STAC items found');
    }

    const latestItem = itemsData.features[0];
    console.log(`📦 Latest STAC item: ${latestItem.id}`);

    const tempAsset = Object.values(latestItem.assets).find(
      asset => asset.href.includes('tre200h0.csv')
    );

    if (!tempAsset) {
      throw new Error('Temperature data not found in STAC assets');
    }

    console.log(`⬇️  Downloading temperature CSV from: ${tempAsset.href}`);

    const csvController = new AbortController();
    const csvTimeoutId = setTimeout(() => csvController.abort(), 120000);

    try {
      const csvResponse = await fetchWithProxy(tempAsset.href, { signal: csvController.signal });
      clearTimeout(csvTimeoutId);

      if (!csvResponse.ok) {
        throw new Error(`CSV download failed: ${csvResponse.status}`);
      }

      const csvText = await csvResponse.text();

      const parsed = Papa.parse<string[]>(csvText, {
        delimiter: ';',
        skipEmptyLines: true,
      });

      console.log(`📊 Parsed ${parsed.data.length} temperature rows`);

      const now = new Date();
      const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

      const weatherByPOI = new Map<string, WeatherData>();

      for (const row of parsed.data) {
        const pointId = row[0];
        const dateStr = row[2];
        const tempStr = row[3];

        if (!pointId || !dateStr || !tempStr) continue;

        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1;
        const day = parseInt(dateStr.substring(6, 8), 10);
        const hour = parseInt(dateStr.substring(8, 10), 10);
        const rowDate = new Date(year, month, day, hour);

        const timeDiff = rowDate.getTime() - currentHour.getTime();
        if (timeDiff < 0) continue;

        const temperature = parseFloat(tempStr);
        if (isNaN(temperature)) continue;

        if (!weatherByPOI.has(pointId) || timeDiff < (weatherByPOI.get(pointId)!.timestamp as any)) {
          weatherByPOI.set(pointId, {
            point_id: pointId,
            temperature,
            symbol_code: 3,
            precipitation: 0,
            timestamp: rowDate.toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      const weatherData = Array.from(weatherByPOI.values());
      console.log(`✅ Extracted weather for ${weatherData.length} POIs`);

      return weatherData;
    } catch (error: any) {
      clearTimeout(csvTimeoutId);
      if (error.name === 'AbortError') {
        throw new Error('CSV download timeout after 120s');
      }
      throw error;
    }
  } catch (error: any) {
    clearTimeout(stacTimeoutId);
    if (error.name === 'AbortError') {
      throw new Error('STAC API fetch timeout after 30s');
    }
    throw error;
  }
}
