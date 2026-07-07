import 'dotenv/config';
import './services/fetch-client.js';
import { serve } from '@hono/node-server';
import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import cron from 'node-cron';
import { initDatabase } from './services/db.js';
import { syncWeatherData } from './cron/sync-weather.js';
// Routes are in the same directory, not in routes/ subfolder
import { weatherRouter } from './weather.js';
import { poisRouter } from './pois.js';
import { adminRouter } from './admin.js';
import { debugRouter } from './debug.js';
import { loxoneRouter } from './loxone.js';
import { widgetRouter } from './widget.js';

const app = new OpenAPIHono();

app.route('/api', weatherRouter);
app.route('/api', poisRouter);
app.route('/api', adminRouter);
app.route('/api', debugRouter);
app.route('/api', widgetRouter);
app.route('/', loxoneRouter);

app.get('/', (c) => {
  return c.json({
    name: 'Meteoblick API',
    version: '1.0.0',
    endpoints: {
      docs: '/docs',
      openapi: '/openapi',
      weather: '/api/weather/{pointId}',
      pois: '/api/pois',
      admin: '/api/admin/sync (requires Bearer token)',
      loxone: '/api/loxone/* (proxy — requires X-Loxone-BaseURL + X-Loxone-Auth headers)',
    },
  });
});

app.doc('/openapi', {
  openapi: '3.1.0',
  info: {
    title: 'Meteoblick Weather API',
    version: '1.0.0',
    description: 'MeteoSwiss weather forecast data API for Swiss locations',
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'http://localhost:3000',
      description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
    },
  ],
});

app.get(
  '/docs',
  apiReference({
    theme: 'purple',
    spec: {
      url: '/openapi',
    },
  })
);

const port = parseInt(process.env.PORT || '3000', 10);

console.log('🚀 Initializing database...');
await initDatabase();

if (process.env.ENABLE_CRON !== 'false') {
  console.log('⏰ Setting up 5-minute weather sync cron job...');
  cron.schedule('*/5 * * * *', async () => {
    console.log('🔔 Cron triggered: syncing weather data');
    try {
      await syncWeatherData();
    } catch (error) {
      console.error('Cron job failed:', error);
    }
  });

  console.log('🔄 Running initial sync...');
  syncWeatherData().catch((error) => {
    console.error('Initial sync failed:', error);
  });
}

console.log(`🌐 Server running on http://localhost:${port}`);
console.log(`📚 API Documentation: http://localhost:${port}/docs`);
console.log(`📄 OpenAPI Spec: http://localhost:${port}/openapi`);

serve({
  fetch: app.fetch,
  port,
});
