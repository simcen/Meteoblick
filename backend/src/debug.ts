import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { getWeatherSyncStatus } from './services/db.js';

const DebugInfoSchema = z.object({
  backend: z.object({
    nextSync: z.string().nullable(),
    lastSync: z.string().nullable(),
    syncIntervalMinutes: z.number(),
  }),
});

export const debugRouter = new OpenAPIHono();

const getDebugInfoRoute = createRoute({
  method: 'get',
  path: '/debug',
  tags: ['Debug'],
  summary: 'Get backend debug information',
  description: 'Returns information about backend sync schedules',
  responses: {
    200: {
      description: 'Debug information',
      content: {
        'application/json': {
          schema: DebugInfoSchema,
        },
      },
    },
  },
});

debugRouter.openapi(getDebugInfoRoute, async (c) => {
  const syncStatus = await getWeatherSyncStatus();
  const syncIntervalMinutes = 60; // Cron runs hourly

  let nextSync: string | null = null;
  if (syncStatus?.lastSync) {
    const lastSyncDate = new Date(syncStatus.lastSync);
    const nextSyncDate = new Date(lastSyncDate.getTime() + syncIntervalMinutes * 60 * 1000);
    nextSync = nextSyncDate.toISOString();
  }

  return c.json({
    backend: {
      nextSync,
      lastSync: syncStatus?.lastSync || null,
      syncIntervalMinutes,
    },
  });
});
