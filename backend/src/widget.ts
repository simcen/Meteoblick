/**
 * Widget Timeline Endpoint
 *
 * Provides a single fetch that returns everything the iOS widget needs to
 * build its timeline (current weather, next-hour forecast, optional Loxone
 * indoor temperature). Designed for:
 *
 * - Direct fetching from the iOS Widget Extension (Swift TimelineProvider) so
 *   the widget does NOT depend on the host app's background-fetch budget.
 * - Cache: keyed by poiId (and sensor UUID) so all callers benefit from
 *   the same cache entries.
 *
 * Caches:
 *   - widget:timeline:poi:{poiId}             — weather snapshot
 *   - widget:timeline:loxe:{uuid}              — Loxone temperature (if sensor UUIDs)
 *
 * Cache TTL: 5 minutes (matches the foreground refresh interval in the app).
 */
import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import * as db from './services/db.js';
import { getTemperature, isLoxoneUuid } from './services/loxone.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Weather cache: per POI, shared across all callers (any user with the
// same POI benefits from the same cache entry). Multi-tenant by design —
// the cache key is the data source (poiId), not the user.
const weatherCache = new Map<string, CacheEntry<unknown>>();

// Loxone cache: per sensorUuid since the same sensor value is identical
// for any caller.
const loxoneCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(cache: Map<string, CacheEntry<unknown>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(cache: Map<string, CacheEntry<unknown>>, key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

const WidgetTimelineResponseSchema = z.object({
  poiId: z.string(),
  locationName: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  current: z.object({
    temperature: z.number(),
    symbolCode: z.number().int(),
    precipitation: z.number(),
    timestamp: z.string().datetime(),
  }),
  forecast: z.object({
    temperature: z.number(),
    timestamp: z.string().datetime(),
  }),
  smartHome: z
    .object({
      temperature: z.number().nullable(),
      timestamp: z.string().datetime().nullable(),
    })
    .nullable(),
  // Phase 4b+ : multi-sensor Loxone readings, fetched server-side in one
  // request. Widget calls this endpoint with the showInWidget sensor
  // UUIDs as a comma-separated header (X-Loxone-Sensor-UUIDs).
  smartHomeSensors: z
    .array(
      z.object({
        uuid: z.string(),
        name: z.string(),
        temperature: z.number(),
        timestamp: z.string().datetime(),
      }),
    )
    .optional(),
  buildNumber: z.string().openapi({ example: '260707-1113' }),
  fetchedAt: z.string().datetime(),
});

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});

const getWidgetTimelineRoute = createRoute({
  method: 'get',
  path: '/widget/timeline',
  summary: 'Get a single-shot timeline payload for the iOS Widget',
  description:
    'Returns everything the iOS widget needs to render a fresh snapshot: ' +
    'current weather, next-hour forecast, and optional Loxone indoor ' +
    'temperature. Designed to be called by the Widget Extension directly ' +
    '(Swift TimelineProvider), independent of the host app. The widget ' +
    'only names the Loxone sensors; the Miniserver is configured on the backend.',
  tags: ['Widget'],
  request: {
    query: z.object({
      poiId: z.string().openapi({ example: '320200' }),
    }),
    headers: z.object({
      'x-loxone-sensor-uuids': z
        .string()
        .optional()
        .openapi({
          example: '1b4bd480-0352-6c00-ffff0fb3607cf0ae,1b4bd480-0353-...',
          description:
            'Comma-separated list of Loxone temperature sensor UUIDs. ' +
            'Backend fetches each in parallel and returns smartHomeSensors[].',
        }),
      // Legacy single-sensor header — kept for backward compat. The endpoint
      // uses x-loxone-sensor-uuids when set, falls back to this.
      'x-loxone-sensor-uuid': z
        .string()
        .optional()
        .openapi({
          example: '1b4bd480-0352-6c00-ffff0fb3607cf0ae',
          description: 'Loxone temperature sensor UUID (deprecated)',
        }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: WidgetTimelineResponseSchema } },
      description: 'Timeline payload',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'POI not found',
    },
  },
});

export const widgetRouter = new OpenAPIHono();

// Helper: fetch Loxone temperature for a specific sensor UUID. Returns
// null on any failure (not configured, unreachable, bad value).
async function fetchLoxoneTemperature(
  sensorUuid: string,
): Promise<{ temperature: number; timestamp: string } | null> {
  try {
    return { temperature: await getTemperature(sensorUuid), timestamp: new Date().toISOString() };
  } catch (error) {
    console.warn('[Widget] Loxone fetch error:', (error as Error).message);
    return null;
  }
}

widgetRouter.openapi(getWidgetTimelineRoute, async (c) => {
  const { poiId } = c.req.valid('query');
  const headers = c.req.valid('header');
  const loxoneSensorUuid = headers['x-loxone-sensor-uuid'];
  const loxoneSensorUuidsHeader = headers['x-loxone-sensor-uuids'];

  // Weather: per-POI cache, shared across all callers.
  const weatherCacheKey = `widget:timeline:poi:${poiId}`;

  let weatherData = getCached<{
    poiId: string;
    locationName: string;
    latitude: number;
    longitude: number;
    current: { temperature: number; symbolCode: number; precipitation: number; timestamp: string };
    forecast: { temperature: number; timestamp: string };
  }>(weatherCache, weatherCacheKey);

  if (!weatherData) {
    const row = await db.getWeatherWithPOI(poiId);
    if (!row) {
      return c.json({ error: 'NOT_FOUND', message: `No weather data for POI ${poiId}` }, 404);
    }
    weatherData = {
      poiId: row.point_id,
      locationName: row.point_name,
      latitude: row.latitude,
      longitude: row.longitude,
      current: {
        temperature: row.temperature_actual,
        symbolCode: row.symbol_code,
        precipitation: row.precipitation,
        timestamp:
          typeof row.timestamp_actual === 'string'
            ? row.timestamp_actual
            : (row.timestamp_actual as Date).toISOString(),
      },
      forecast: {
        temperature: row.temperature_forecast,
        timestamp:
          typeof row.timestamp_forecast === 'string'
            ? row.timestamp_forecast
            : (row.timestamp_forecast as Date).toISOString(),
      },
    };
    setCache(weatherCache, weatherCacheKey, weatherData);
  }

  // Loxone: multi-sensor if x-loxone-sensor-uuids is set, else fall back
  // to legacy x-loxone-sensor-uuid. Per-sensor cache so each reading
  // is independent of the caller.
  const loxoneResult = await fetchLoxoneMultiSensor({
    multiHeader: loxoneSensorUuidsHeader,
    legacySingleUuid: loxoneSensorUuid,
  });

  return c.json(
    {
      ...weatherData,
      smartHome: loxoneResult.primary,
      smartHomeSensors: loxoneResult.sensors,
      buildNumber: process.env.BUILD_NUMBER ?? 'dev',
      fetchedAt: new Date().toISOString(),
    },
    200,
  );
});

// ─── Exported helpers (testable) ───────────────────────────────────

/**
 * Parse sensor UUIDs from the request headers.
 * Multi-uuid header takes precedence; falls back to legacy single-uuid
 * header. Comma-separated multi-uuid is trimmed + empty filtered.
 * Exported for unit testing.
 */
export function parseSensorUuids(
  multiHeader: string | undefined,
  legacySingleUuid: string | undefined,
): string[] {
  const fromMulti = multiHeader
    ? multiHeader.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  if (fromMulti.length > 0) return fromMulti;
  return legacySingleUuid ? [legacySingleUuid] : [];
}

/**
 * Fetch multiple Loxone sensor temperatures in parallel with per-sensor
 * caching. Returns the built response array + a legacy single-sensor
 * "primary" for backward compat. Exported for unit testing.
 */
export async function fetchLoxoneMultiSensor(opts: {
  multiHeader: string | undefined;
  legacySingleUuid: string | undefined;
}): Promise<{
  primary: { temperature: number; timestamp: string } | null;
  sensors: Array<{ uuid: string; name: string; temperature: number; timestamp: string }> | undefined;
}> {
  const uuids = parseSensorUuids(opts.multiHeader, opts.legacySingleUuid).filter(isLoxoneUuid);
  if (uuids.length === 0) {
    return { primary: null, sensors: undefined };
  }

  // Cache lookup per uuid
  const cached = uuids.map((uuid) =>
    getCached<{ temperature: number; timestamp: string }>(
      loxoneCache,
      `widget:timeline:loxe:${uuid}`,
    ),
  );
  const missingIdx = uuids
    .map((uuid, i) => (cached[i] ? -1 : i))
    .filter((i) => i >= 0);
  const missing = missingIdx.map((i) => uuids[i]);

  const fetched = await Promise.all(
    missing.map((uuid) =>
      fetchLoxoneTemperature(uuid).then((r) => ({ uuid, r })),
    ),
  );

  // Write back freshly-fetched values to cache
  for (const { uuid, r } of fetched) {
    if (r) setCache(loxoneCache, `widget:timeline:loxe:${uuid}`, r);
  }

  // Build the response array, skipping any uuid whose fetch failed (no
  // cached and no fresh value).
  const sensors = uuids
    .map((uuid, i) => {
      const reading = cached[i] ?? fetched.find((f) => f.uuid === uuid)?.r;
      if (!reading) return null;
      return {
        uuid,
        name: uuid, // Widget resolves real name from its cached snapshot
        temperature: reading.temperature,
        timestamp: reading.timestamp,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const primary =
    sensors.length > 0
      ? { temperature: sensors[0].temperature, timestamp: sensors[0].timestamp }
      : null;

  return { primary, sensors };
}