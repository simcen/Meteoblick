import pg from 'pg';
import type { POI, WeatherData } from '../models/types.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pois (
        point_id VARCHAR(10) PRIMARY KEY,
        point_name VARCHAR(255) NOT NULL,
        postal_code VARCHAR(10),
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        height_masl INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weather (
        point_id VARCHAR(10) PRIMARY KEY REFERENCES pois(point_id),
        temperature DOUBLE PRECISION NOT NULL,
        symbol_code INTEGER NOT NULL,
        precipitation DOUBLE PRECISION NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pois_postal_code ON pois(postal_code);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pois_name ON pois(point_name);
    `);

    console.log('✅ Database tables initialized');
  } finally {
    client.release();
  }
}

export async function upsertPOI(poi: POI): Promise<void> {
  await pool.query(
    `INSERT INTO pois (point_id, point_name, postal_code, latitude, longitude, height_masl)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (point_id) DO UPDATE SET
       point_name = EXCLUDED.point_name,
       postal_code = EXCLUDED.postal_code,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       height_masl = EXCLUDED.height_masl`,
    [poi.point_id, poi.point_name, poi.postal_code, poi.latitude, poi.longitude, poi.height_masl]
  );
}

export async function upsertWeather(weather: WeatherData): Promise<void> {
  await pool.query(
    `INSERT INTO weather (point_id, temperature, symbol_code, precipitation, timestamp, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (point_id) DO UPDATE SET
       temperature = EXCLUDED.temperature,
       symbol_code = EXCLUDED.symbol_code,
       precipitation = EXCLUDED.precipitation,
       timestamp = EXCLUDED.timestamp,
       updated_at = NOW()`,
    [weather.point_id, weather.temperature, weather.symbol_code, weather.precipitation, weather.timestamp]
  );
}

export async function getPOIs(search?: string): Promise<POI[]> {
  let query = 'SELECT * FROM pois';
  const params: any[] = [];

  if (search) {
    query += ` WHERE point_name ILIKE $1 OR postal_code = $2`;
    params.push(`%${search}%`, search);
  }

  query += ' ORDER BY point_name LIMIT 100';

  const result = await pool.query<POI>(query, params);
  return result.rows;
}

export async function getWeather(pointId: string): Promise<WeatherData | null> {
  const result = await pool.query<WeatherData>(
    'SELECT * FROM weather WHERE point_id = $1',
    [pointId]
  );
  return result.rows[0] || null;
}

export async function getWeatherSyncStatus(): Promise<{ lastSync: string } | null> {
  const result = await pool.query<{ updated_at: Date }>(
    'SELECT updated_at FROM weather ORDER BY updated_at DESC LIMIT 1'
  );
  if (result.rows.length === 0) return null;
  return {
    lastSync: result.rows[0].updated_at.toISOString(),
  };
}

export async function getWeatherWithPOI(pointId: string) {
  const result = await pool.query(
    `SELECT
       w.point_id,
       w.temperature,
       w.symbol_code,
       w.precipitation,
       w.timestamp,
       w.updated_at,
       p.point_name,
       p.postal_code,
       p.latitude,
       p.longitude
     FROM weather w
     JOIN pois p ON w.point_id = p.point_id
     WHERE w.point_id = $1`,
    [pointId]
  );
  return result.rows[0] || null;
}

export { pool };
