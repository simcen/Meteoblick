import { prisma } from '../lib/prisma.js';
import type { POI, WeatherData } from '../models/types.js';

/**
 * Initialize database - with Prisma, schema is managed via migrations
 * This function is kept for backwards compatibility but is now a no-op
 */
export async function initDatabase() {
  console.log('✅ Using Prisma - schema managed via migrations');
}

export async function upsertPOI(poi: POI): Promise<void> {
  await prisma.pois.upsert({
    where: { point_id: poi.point_id },
    update: {
      point_name: poi.point_name,
      postal_code: poi.postal_code,
      latitude: poi.latitude,
      longitude: poi.longitude,
      height_masl: poi.height_masl,
    },
    create: {
      point_id: poi.point_id,
      point_name: poi.point_name,
      postal_code: poi.postal_code,
      latitude: poi.latitude,
      longitude: poi.longitude,
      height_masl: poi.height_masl,
    },
  });
}

export async function upsertWeather(weather: WeatherData): Promise<void> {
  await prisma.weather.upsert({
    where: { point_id: weather.point_id },
    update: {
      temperature_actual: weather.temperature_actual,
      temperature_forecast: weather.temperature_forecast,
      symbol_code: weather.symbol_code,
      precipitation: weather.precipitation,
      timestamp_actual: new Date(weather.timestamp_actual),
      timestamp_forecast: new Date(weather.timestamp_forecast),
      updated_at: new Date(),
    },
    create: {
      point_id: weather.point_id,
      temperature_actual: weather.temperature_actual,
      temperature_forecast: weather.temperature_forecast,
      symbol_code: weather.symbol_code,
      precipitation: weather.precipitation,
      timestamp_actual: new Date(weather.timestamp_actual),
      timestamp_forecast: new Date(weather.timestamp_forecast),
    },
  });
}

export async function getPOIs(search?: string): Promise<POI[]> {
  const pois = await prisma.pois.findMany({
    where: search
      ? {
          OR: [
            { point_name: { contains: search, mode: 'insensitive' } },
            { postal_code: { equals: search } },
          ],
        }
      : undefined,
    orderBy: { point_name: 'asc' },
    take: 100,
  });

  return pois.map((poi): POI => ({
    point_id: poi.point_id,
    point_name: poi.point_name,
    postal_code: poi.postal_code,
    latitude: poi.latitude,
    longitude: poi.longitude,
    height_masl: poi.height_masl,
  }));
}

export async function getWeather(pointId: string): Promise<WeatherData | null> {
  const weather = await prisma.weather.findUnique({
    where: { point_id: pointId },
  });

  if (!weather) return null;

  return {
    point_id: weather.point_id,
    temperature_actual: weather.temperature_actual,
    temperature_forecast: weather.temperature_forecast,
    symbol_code: weather.symbol_code,
    precipitation: weather.precipitation,
    timestamp_actual: weather.timestamp_actual.toISOString(),
    timestamp_forecast: weather.timestamp_forecast.toISOString(),
    updated_at: weather.updated_at?.toISOString() ?? new Date().toISOString(),
  };
}

export async function getWeatherSyncStatus(): Promise<{ lastSync: string } | null> {
  const latestWeather = await prisma.weather.findFirst({
    orderBy: { updated_at: 'desc' },
    select: { updated_at: true },
  });

  if (!latestWeather?.updated_at) return null;

  return {
    lastSync: latestWeather.updated_at.toISOString(),
  };
}

export async function getWeatherWithPOI(pointId: string) {
  const result = await prisma.weather.findUnique({
    where: { point_id: pointId },
    include: {
      pois: true,
    },
  });

  if (!result) return null;

  return {
    point_id: result.point_id,
    temperature_actual: result.temperature_actual,
    temperature_forecast: result.temperature_forecast,
    symbol_code: result.symbol_code,
    precipitation: result.precipitation,
    timestamp_actual: result.timestamp_actual.toISOString(),
    timestamp_forecast: result.timestamp_forecast.toISOString(),
    updated_at: result.updated_at?.toISOString() ?? new Date().toISOString(),
    point_name: result.pois.point_name,
    postal_code: result.pois.postal_code,
    latitude: result.pois.latitude,
    longitude: result.pois.longitude,
  };
}

// For backwards compatibility - export prisma instance
export { prisma };
