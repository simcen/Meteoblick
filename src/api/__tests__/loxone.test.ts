import { LoxoneAPI } from '../loxone';

// Mock fetch globally
global.fetch = jest.fn();

// Mock the constants import so the backend URL and token are predictable
jest.mock('../../constants', () => ({
  API_BASE_URL: 'http://test-backend',
  API_TOKEN: 'test-token',
}));

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('LoxoneAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTemperatureSensors', () => {
    it('should load the sensor list from the backend with the API token', async () => {
      const sensors = [
        { uuid: 'a', name: 'Aussentemperatur', room: 'Garten', category: 'Klima', type: 'InfoOnlyAnalog' },
      ];
      (global.fetch as jest.Mock).mockResolvedValueOnce(fakeResponse({ sensors }));

      expect(await LoxoneAPI.getTemperatureSensors()).toEqual(sensors);

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('http://test-backend/api/loxone/sensors');
      expect(init.headers.Authorization).toBe('Bearer test-token');
    });

    it('should explain when Loxone is not configured on the backend', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(fakeResponse({}, false, 503));

      await expect(LoxoneAPI.getTemperatureSensors()).rejects.toThrow('nicht konfiguriert');
    });

    it('should explain when the backend rejects the API token', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(fakeResponse({}, false, 401));

      await expect(LoxoneAPI.getTemperatureSensors()).rejects.toThrow('API-Token');
    });

    it('should report other failures with the status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(fakeResponse({}, false, 502));

      await expect(LoxoneAPI.getTemperatureSensors()).rejects.toThrow('Status 502');
    });
  });

  describe('getTemperatures', () => {
    it('should read all sensors in one backend request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse({
          readings: [
            { uuid: 'a', temperature: 22.5, timestamp: '2026-11-18T10:00:00.000Z' },
            { uuid: 'b', temperature: 19, timestamp: '2026-11-18T10:00:00.000Z' },
          ],
        }),
      );

      expect(await LoxoneAPI.getTemperatures(['a', 'b'])).toEqual([
        { uuid: 'a', temperature: 22.5 },
        { uuid: 'b', temperature: 19 },
      ]);

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('http://test-backend/api/loxone/temperatures?uuids=a%2Cb');
      expect(init.headers.Authorization).toBe('Bearer test-token');
    });

    it('should not call the backend without sensors', async () => {
      expect(await LoxoneAPI.getTemperatures([])).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw when the backend request fails, so callers fall back to the cache', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'));

      await expect(LoxoneAPI.getTemperatures(['a'])).rejects.toThrow('Network request failed');
    });
  });
});
