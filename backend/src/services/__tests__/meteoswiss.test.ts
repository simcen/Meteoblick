import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchWeatherFromMeteoSwiss } from '../meteoswiss.js';
import type { WeatherData } from '../../models/types.js';

// Mock fetchWithProxy
vi.mock('../fetch-client.js', () => ({
  fetchWithProxy: vi.fn(),
}));

import { fetchWithProxy } from '../fetch-client.js';

describe('MeteoSwiss Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchWeatherFromMeteoSwiss', () => {
    it('should fetch both IST and Forecast temperatures', async () => {
      // Mock STAC API response
      const mockStacResponse = {
        features: [
          {
            id: 'test-item',
            assets: {
              temperature: {
                href: 'https://example.com/tre200h0.csv',
                type: 'text/csv',
              },
            },
          },
        ],
      };

      // Mock CSV data with past and future temperatures
      const now = new Date();
      const pastHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1);
      const futureHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);

      const formatDate = (d: Date) =>
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}`;

      const mockCsvData = `point_id;parameter;datetime;value
1;tre200h0;${formatDate(pastHour)};20.5
1;tre200h0;${formatDate(futureHour)};21.5
2;tre200h0;${formatDate(pastHour)};18.0
2;tre200h0;${formatDate(futureHour)};19.0`;

      (fetchWithProxy as any).mockImplementation((url: string) => {
        if (url.includes('stac')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStacResponse),
          });
        } else {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(mockCsvData),
          });
        }
      });

      const result = await fetchWeatherFromMeteoSwiss();

      expect(result).toHaveLength(2);

      const poi1 = result.find((w) => w.point_id === '1');
      expect(poi1).toBeDefined();
      expect(poi1?.temperature_actual).toBe(20.5);
      expect(poi1?.temperature_forecast).toBe(21.5);
      expect(poi1?.timestamp_actual).toBeDefined();
      expect(poi1?.timestamp_forecast).toBeDefined();

      const poi2 = result.find((w) => w.point_id === '2');
      expect(poi2).toBeDefined();
      expect(poi2?.temperature_actual).toBe(18.0);
      expect(poi2?.temperature_forecast).toBe(19.0);
    });

    it('should only include POIs with BOTH actual and forecast', async () => {
      const mockStacResponse = {
        features: [
          {
            id: 'test-item',
            assets: {
              temperature: {
                href: 'https://example.com/tre200h0.csv',
                type: 'text/csv',
              },
            },
          },
        ],
      };

      const now = new Date();
      const pastHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1);

      const formatDate = (d: Date) =>
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}`;

      // POI 1 has only past data (no forecast)
      const mockCsvData = `point_id;parameter;datetime;value
1;tre200h0;${formatDate(pastHour)};20.5`;

      (fetchWithProxy as any).mockImplementation((url: string) => {
        if (url.includes('stac')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStacResponse),
          });
        } else {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(mockCsvData),
          });
        }
      });

      const result = await fetchWeatherFromMeteoSwiss();

      // Should be empty - POI 1 has no forecast
      expect(result).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      (fetchWithProxy as any).mockRejectedValue(new Error('Network error'));

      await expect(fetchWeatherFromMeteoSwiss()).rejects.toThrow();
    });
  });
});
