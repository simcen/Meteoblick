/**
 * Loxone Endpoints
 *
 * Read-only access to the Miniserver's temperature sensors for the app.
 * The Miniserver address and credentials are configured on the backend
 * (see services/loxone.ts); the app only names the sensors it wants.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import {
  getTemperature,
  getTemperatureSensors,
  isLoxoneUuid,
  LoxoneNotConfiguredError,
} from './services/loxone.js';

const SensorSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  room: z.string(),
  category: z.string(),
  type: z.string(),
});

const ReadingSchema = z.object({
  uuid: z.string(),
  temperature: z.number(),
  timestamp: z.string().datetime(),
});

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});

const getSensorsRoute = createRoute({
  method: 'get',
  path: '/loxone/sensors',
  summary: 'List the temperature sensors of the Miniserver',
  tags: ['Loxone'],
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ sensors: z.array(SensorSchema) }) } },
      description: 'Temperature sensors from the Structure File',
    },
    502: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Miniserver not reachable',
    },
    503: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Loxone is not configured on the backend',
    },
  },
});

const getTemperaturesRoute = createRoute({
  method: 'get',
  path: '/loxone/temperatures',
  summary: 'Read the current values of temperature sensors',
  description: 'Sensors that cannot be read are left out of the response.',
  tags: ['Loxone'],
  request: {
    query: z.object({
      uuids: z.string().openapi({
        example: '1b4bd480-0352-6c00-ffff0fb3607cf0ae',
        description: 'Comma-separated list of sensor UUIDs',
      }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ readings: z.array(ReadingSchema) }) } },
      description: 'Current readings',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Invalid sensor UUID',
    },
    503: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Loxone is not configured on the backend',
    },
  },
});

export const loxoneRouter = new OpenAPIHono();

loxoneRouter.openapi(getSensorsRoute, async (c) => {
  try {
    return c.json({ sensors: await getTemperatureSensors() }, 200);
  } catch (error) {
    if (error instanceof LoxoneNotConfiguredError) {
      return c.json({ error: 'LOXONE_NOT_CONFIGURED', message: error.message }, 503);
    }
    console.error('[Loxone] Sensor list failed:', (error as Error).message);
    return c.json({ error: 'LOXONE_UNREACHABLE', message: (error as Error).message }, 502);
  }
});

loxoneRouter.openapi(getTemperaturesRoute, async (c) => {
  const uuids = c.req.valid('query').uuids.split(',').map((s) => s.trim()).filter(Boolean);
  const invalid = uuids.find((uuid) => !isLoxoneUuid(uuid));
  if (invalid) {
    return c.json({ error: 'INVALID_UUID', message: `Invalid sensor UUID: ${invalid}` }, 400);
  }

  const timestamp = new Date().toISOString();
  const settled = await Promise.allSettled(
    uuids.map(async (uuid) => ({ uuid, temperature: await getTemperature(uuid), timestamp })),
  );

  const failed = settled.find((r) => r.status === 'rejected');
  if (failed?.reason instanceof LoxoneNotConfiguredError) {
    return c.json({ error: 'LOXONE_NOT_CONFIGURED', message: failed.reason.message }, 503);
  }
  if (failed) {
    console.warn('[Loxone] Temperature read failed:', (failed.reason as Error).message);
  }

  const readings = settled
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  return c.json({ readings }, 200);
});
