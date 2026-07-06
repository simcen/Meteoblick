import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import * as db from './services/db.js';

const WeatherResponseSchema = z.object({
  pointId: z.string().openapi({ example: '1' }),
  locationName: z.string().openapi({ example: 'Arosa' }),
  temperatureActual: z.number().openapi({ example: 20.5 }),
  temperatureForecast: z.number().openapi({ example: 21.5 }),
  symbolCode: z.number().int().openapi({ example: 3 }),
  precipitation: z.number().openapi({ example: 0.2 }),
  timestampActual: z.string().datetime().openapi({ example: '2026-06-30T11:00:00Z' }),
  timestampForecast: z.string().datetime().openapi({ example: '2026-06-30T12:00:00Z' }),
  latitude: z.number().openapi({ example: 46.792661 }),
  longitude: z.number().openapi({ example: 9.679014 }),
});

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});

const getWeatherRoute = createRoute({
  method: 'get',
  path: '/weather/{pointId}',
  summary: 'Get current weather for a specific POI',
  description: 'Returns the latest weather forecast data for a given point ID',
  tags: ['Weather'],
  request: {
    params: z.object({
      pointId: z.string().openapi({
        param: { name: 'pointId', in: 'path' },
        example: '1',
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: WeatherResponseSchema,
        },
      },
      description: 'Weather data retrieved successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'POI not found or no weather data available',
    },
  },
});

export const weatherRouter = new OpenAPIHono();

weatherRouter.openapi(getWeatherRoute, async (c) => {
  const { pointId } = c.req.valid('param');

  const data = await db.getWeatherWithPOI(pointId);

  if (!data) {
    return c.json({ error: 'NOT_FOUND', message: 'Weather data not found for this POI' }, 404);
  }

  return c.json({
    pointId: data.point_id,
    locationName: data.point_name,
    temperatureActual: data.temperature_actual,
    temperatureForecast: data.temperature_forecast,
    symbolCode: data.symbol_code,
    precipitation: data.precipitation,
    timestampActual: data.timestamp_actual,
    timestampForecast: data.timestamp_forecast,
    latitude: data.latitude,
    longitude: data.longitude,
  }, 200);
});
