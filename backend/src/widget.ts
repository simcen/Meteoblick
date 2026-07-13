/**
 * Widget Timeline Endpoint
 *
 * Provides a single fetch that returns everything the iOS widget needs to
 * build its timeline (current weather, next-hour forecast, optional Loxone
 * indoor temperature). Designed for:
 *
 * - Direct fetching from the iOS Widget Extension (Swift TimelineProvider) so
 *   the widget does NOT depend on the host app's background-fetch budget.
 * - Multi-tenant cache: keyed by poiId (and optional smartHomeId) so multiple
 *   users sharing the same Miniserver benefit from the same cache entries.
 *   The cache key does NOT include user identity — user auth is a separate
 *   concern handled by middleware (not yet implemented).
 *
 * Caches:
 *   - widget:timeline:poi:{poiId}             — weather snapshot
 *   - widget:timeline:loxe:{snr}               — Loxone temperature (if smartHomeId)
 *
 * Cache TTL: 5 minutes (matches the foreground refresh interval in the app).
 */
import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import * as db from './services/db.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Weather cache: per POI, shared across all callers (any user with the
// same POI benefits from the same cache entry). Multi-tenant by design —
// the cache key is the data source (poiId), not the user.
const weatherCache = new Map<string, CacheEntry<unknown>>();

// Loxone cache: per (snr, sensorUuid) since the same sensor value is
// identical for any caller. We cache even though we don't have user
// credentials, because the temperature reading is independent of credentials.
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
    '(Swift TimelineProvider), independent of the host app. Loxone ' +
    'credentials are passed in headers per request (no auth, no ' +
    'persistence — the backend is stateless for credentials).',
  tags: ['Widget'],
  request: {
    query: z.object({
      poiId: z.string().openapi({ example: '320200' }),
    }),
    headers: z.object({
      'x-loxone-snr': z
        .string()
        .optional()
        .openapi({ example: '504F94A1874F', description: 'Loxone Miniserver serial number' }),
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
      'x-loxone-credentials': z
        .string()
        .optional()
        .openapi({
          example: 'c2ltb246aGF1cy1pbnRlbGxpZ2VudC1iZXJn',
          description: 'base64(user:password) for Loxone Cloud auth',
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

// Helper: fetch Loxone temperature for a specific sensor UUID. Uses the
// raw password (verified empirically that Loxone Cloud accepts it for
// /jdev/sps/io/{uuid}, but rejects the SHA-256(apiKey+password) hash).
//
// We follow 307 redirects manually because Node fetch strips Authorization
// headers on cross-origin hops, which would cause 401 on the final URL.
async function fetchLoxoneTemperature(
  snr: string,
  sensorUuid: string,
  credentialsB64: string,
): Promise<{ temperature: number; timestamp: string } | null> {
  const cloudURL = `https://connect.loxonecloud.com/${snr}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  // credentialsB64 is already "Basic " + base64(user:pass) — pass through.
  const auth = credentialsB64.startsWith('Basic ') ? credentialsB64 : `Basic ${credentialsB64}`;

  try {
    let currentURL = `${cloudURL}/jdev/sps/io/${sensorUuid}`;
    let response: Response;
    let hops = 0;
    const MAX_HOPS = 5;

    while (true) {
      response = await fetch(currentURL, {
        method: 'GET',
        headers: { Authorization: auth },
        signal: controller.signal,
        redirect: 'manual',
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;
        currentURL = new URL(location, currentURL).toString();
        hops++;
        if (hops > MAX_HOPS) {
          console.warn('[Widget] Too many redirects fetching Loxone temperature');
          return null;
        }
        continue;
      }
      break;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Widget] Loxone temperature fetch failed: ${response.status}`);
      return null;
    }

    const body = await response.text();
    let parsed: { LL?: { value?: string } };
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      console.warn(`[Widget] Loxone response not JSON (truncated): ${body.slice(-100)}`);
      return null;
    }

    const tempStr = parsed.LL?.value;
    if (!tempStr) {
      console.warn('[Widget] Loxone response missing LL.value');
      return null;
    }
    const temperature = parseFloat(tempStr);
    if (isNaN(temperature)) {
      console.warn(`[Widget] Loxone temperature not numeric: ${tempStr}`);
      return null;
    }
    return { temperature, timestamp: new Date().toISOString() };
  } catch (error) {
    console.warn('[Widget] Loxone fetch error:', (error as Error).message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

widgetRouter.openapi(getWidgetTimelineRoute, async (c) => {
  const { poiId } = c.req.valid('query');
  const headers = c.req.valid('header');
  const loxoneSnr = headers['x-loxone-snr'];
  const loxoneSensorUuid = headers['x-loxone-sensor-uuid'];
  const loxoneSensorUuidsHeader = headers['x-loxone-sensor-uuids'];
  const loxoneCredentials = headers['x-loxone-credentials'];

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

  // Loxone: fetch per-request. Per-(snr,sensor) cache — each reading is
  // independent of the caller. x-loxone-sensor-uuids (multi) takes
  // precedence over x-loxone-sensor-uuid (legacy single).
  let smartHomeSensors: Array<{ uuid: string; name: string; temperature: number; timestamp: string }> | undefined;
  let primarySmartHome: { temperature: number; timestamp: string } | null = null;
  if (loxoneSnr && loxoneCredentials) {
    // Multi-uuid path: comma-separated, trimmed
    const headerUuids = loxoneSensorUuidsHeader
      ? loxoneSensorUuidsHeader.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    // Fall back to legacy single-uuid header
    const uuids = headerUuids.length > 0
      ? headerUuids
      : (loxoneSensorUuid ? [loxoneSensorUuid] : []);

    if (uuids.length > 0) {
      // Cache lookup + parallel fetch
      const cached = uuids.map((uuid) =>
        getCached<{ temperature: number; timestamp: string }>(
          loxoneCache,
          `widget:timeline:loxe:${loxoneSnr}:${uuid}`,
        ),
      );
      const missing = uuids.filter((_, i) => !cached[i]);
      const fetched = await Promise.all(
        missing.map((uuid) =>
          fetchLoxoneTemperature(loxoneSnr, uuid, loxoneCredentials).then((r) => ({ uuid, r })),
        ),
      );
      // Write back freshly-fetched values to cache
      for (const { uuid, r } of fetched) {
        if (r) {
          setCache(loxoneCache, `widget:timeline:loxe:${loxoneSnr}:${uuid}`, r);
        }
      }
      // Build the response array
      const now = new Date().toISOString();
      smartHomeSensors = uuids.map((uuid, i) => {
        const reading = cached[i] ?? fetched.find((f) => f.uuid === uuid)?.r;
        if (!reading) return null;
        return {
          uuid,
          name: uuid, // Widget side resolves the name from the cached snapshot
          temperature: reading.temperature,
          timestamp: reading.timestamp,
        };
      }).filter((s): s is NonNullable<typeof s> => s !== null);
      // Backward-compat primary: first sensor (or first with reading)
      if (smartHomeSensors.length > 0) {
        primarySmartHome = {
          temperature: smartHomeSensors[0].temperature,
          timestamp: smartHomeSensors[0].timestamp,
        };
      }
    }
  }

  return c.json(
    {
      ...weatherData,
      smartHome: primarySmartHome,
      smartHomeSensors,
      buildNumber: process.env.BUILD_NUMBER ?? 'dev',
      fetchedAt: new Date().toISOString(),
    },
    200,
  );
});