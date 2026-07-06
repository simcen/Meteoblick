import { test, expect } from '@playwright/test';

test.describe('Weather API', () => {
  test('GET /api/weather/{pointId} returns IST and Forecast temperatures', async ({ request }) => {
    const response = await request.get('/api/weather/1');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();

    expect(data).toHaveProperty('pointId');
    expect(data).toHaveProperty('locationName');
    expect(data).toHaveProperty('temperatureActual');
    expect(data).toHaveProperty('temperatureForecast');
    expect(data).toHaveProperty('timestampActual');
    expect(data).toHaveProperty('timestampForecast');
    expect(data).toHaveProperty('symbolCode');
    expect(data).toHaveProperty('precipitation');
    expect(data).toHaveProperty('latitude');
    expect(data).toHaveProperty('longitude');

    expect(typeof data.temperatureActual).toBe('number');
    expect(typeof data.temperatureForecast).toBe('number');
  });

  test('GET /api/weather/{pointId} returns 404 for invalid POI', async ({ request }) => {
    const response = await request.get('/api/weather/999999');

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('GET /api/pois returns POI list', async ({ request }) => {
    const response = await request.get('/api/pois?search=Zürich');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();

    if (data.length > 0) {
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).toHaveProperty('latitude');
      expect(data[0]).toHaveProperty('longitude');
    }
  });

  test('GET /health returns healthy status', async ({ request }) => {
    const response = await request.get('/health');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
  });
});
