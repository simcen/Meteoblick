import { MeteoSwissAPI } from '../meteoswiss';

// Mock fetch globally
global.fetch = jest.fn();

describe('MeteoSwissAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchWeatherData', () => {
    const mockBackendResponse = {
      pointId: '1',
      locationName: 'Frauenkappelen',
      temperature: 22.5,
      symbolCode: 3,
      precipitation: 0.2,
      timestamp: '2026-07-03T12:00:00Z',
      latitude: 46.9756,
      longitude: 7.3136,
    };

    it('should fetch weather data successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBackendResponse,
      });

      const result = await MeteoSwissAPI.fetchWeatherData('1');

      expect(result).toEqual({
        temperature: 22.5,
        symbolCode: 3,
        precipitation: 0.2,
        timestamp: '2026-07-03T12:00:00Z',
        location: '1',
        locationName: 'Frauenkappelen',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/weather/1')
      );
    });

    it('should throw error on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(MeteoSwissAPI.fetchWeatherData('1')).rejects.toMatchObject({
        code: 'unknown_error',
      });
    });

    it('should throw error on 404 response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      });

      await expect(MeteoSwissAPI.fetchWeatherData('999')).rejects.toMatchObject({
        code: 'invalid_poi',
      });
    });

    it('should throw error on 500 response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });

      await expect(MeteoSwissAPI.fetchWeatherData('1')).rejects.toMatchObject({
        code: 'api_error',
      });
    });
  });

  describe('fetchPOIList', () => {
    const mockPOIResponse = [
      {
        id: '1',
        name: 'Frauenkappelen',
        plz: '3202',
        latitude: 46.9756,
        longitude: 7.3136,
      },
      {
        id: '2',
        name: 'Bern',
        plz: '3000',
        latitude: 46.9480,
        longitude: 7.4474,
      },
    ];

    it('should fetch POI list successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPOIResponse,
      });

      const result = await MeteoSwissAPI.fetchPOIList('Frauen');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '1',
        name: 'Frauenkappelen',
        plz: '3202',
        latitude: 46.9756,
        longitude: 7.3136,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pois?search=Frauen')
      );
    });

    it('should fetch all POIs when search is too short', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPOIResponse,
      });

      const result = await MeteoSwissAPI.fetchPOIList('F');

      expect(result).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pois')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.not.stringContaining('?search=')
      );
    });

    it('should handle backend errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      await expect(MeteoSwissAPI.fetchPOIList('test')).rejects.toMatchObject({
        code: 'api_error',
      });
    });

    it('should URL-encode search query', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await MeteoSwissAPI.fetchPOIList('Zürich & Bern');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('Zürich & Bern'))
      );
    });
  });
});
