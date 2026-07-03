import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAdminToken } from './middleware/auth.js';
import { syncWeatherData } from './cron/sync-weather.js';

const SyncResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  timestamp: z.string().datetime(),
});

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});

const triggerSyncRoute = createRoute({
  method: 'post',
  path: '/admin/sync',
  summary: 'Manually trigger weather data sync',
  description: 'Triggers an immediate sync of POI metadata and weather data from MeteoSwiss. Requires admin token.',
  tags: ['Admin'],
  security: [
    {
      bearerAuth: [],
    },
  ],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SyncResponseSchema,
        },
      },
      description: 'Sync triggered successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Unauthorized - missing or invalid token',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Forbidden - invalid admin token',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Admin endpoints disabled - ADMIN_TOKEN not configured',
    },
  },
});

export const adminRouter = new OpenAPIHono();

adminRouter.use('/admin/*', requireAdminToken);

adminRouter.openapi(triggerSyncRoute, async (c) => {
  try {
    console.log('🔄 Manual sync triggered via API');
    await syncWeatherData();

    return c.json({
      success: true,
      message: 'Weather data sync completed successfully',
      timestamp: new Date().toISOString(),
    }, 200);
  } catch (error: any) {
    console.error('❌ Manual sync failed:', error);

    return c.json({
      error: 'SYNC_FAILED',
      message: error.message || 'Failed to sync weather data',
    }, 500);
  }
});
