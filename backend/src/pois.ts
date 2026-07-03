import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import * as db from './services/db.js';

const POISchema = z.object({
  id: z.string().openapi({ example: '1' }),
  name: z.string().openapi({ example: 'Arosa' }),
  plz: z.string().nullable().openapi({ example: null }),
  latitude: z.number().openapi({ example: 46.792661 }),
  longitude: z.number().openapi({ example: 9.679014 }),
});

const getPOIsRoute = createRoute({
  method: 'get',
  path: '/pois',
  summary: 'Get list of POIs',
  description: 'Returns all available points of interest (weather stations and locations)',
  tags: ['POIs'],
  request: {
    query: z.object({
      search: z.string().optional().openapi({
        param: { name: 'search', in: 'query' },
        example: 'Zürich',
        description: 'Search by location name or postal code',
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(POISchema),
        },
      },
      description: 'List of POIs',
    },
  },
});

export const poisRouter = new OpenAPIHono();

poisRouter.openapi(getPOIsRoute, async (c) => {
  const { search } = c.req.valid('query');

  const pois = await db.getPOIs(search);

  return c.json(
    pois.map((poi) => ({
      id: poi.point_id,
      name: poi.point_name,
      plz: poi.postal_code,
      latitude: poi.latitude,
      longitude: poi.longitude,
    })),
    200
  );
});
