import SharedGroupPreferences from 'react-native-shared-group-preferences';
import { SharedStorage } from '../SharedStorage';
import type { WeatherData } from '../../types/weather';

// Mock SharedGroupPreferences globally
jest.mock('react-native-shared-group-preferences');

describe('SharedStorage', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('POI ID Storage', () => {
    it('should store and retrieve POI ID', async () => {
      const testPOI = '12345';
      (SharedGroupPreferences.getItem as jest.Mock).mockResolvedValueOnce(testPOI);

      await SharedStorage.setPointId(testPOI);
      const result = await SharedStorage.getPointId();

      expect(result).toBe(testPOI);
      expect(SharedGroupPreferences.setItem).toHaveBeenCalledWith(
        'meteoblick_poi_id',
        testPOI,
        'group.ch.meteoblick'
      );
    });

    it('should return null when no POI ID is stored', async () => {
      (SharedGroupPreferences.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await SharedStorage.getPointId();

      expect(result).toBeNull();
    });

    it('should handle storage errors gracefully', async () => {
      (SharedGroupPreferences.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error')
      );

      await expect(SharedStorage.setPointId('123')).rejects.toThrow('Storage error');
    });
  });

  describe('Weather Data Storage', () => {
    const mockWeatherData: WeatherData = {
      temperature: 22.5,
      symbolCode: 3,
      precipitation: 0.2,
      timestamp: '2026-07-03T12:00:00Z',
      location: '1',
      locationName: 'Frauenkappelen',
    };

    it('should store and retrieve weather data', async () => {
      const weatherJson = JSON.stringify(mockWeatherData);

      // Mock for verification read in setWeatherData
      (SharedGroupPreferences.getItem as jest.Mock).mockResolvedValue(weatherJson);

      await SharedStorage.setWeatherData(mockWeatherData);
      const result = await SharedStorage.getWeatherData();

      expect(result).toEqual(mockWeatherData);
      expect(SharedGroupPreferences.setItem).toHaveBeenCalledWith(
        'meteoblick_weather_data',
        weatherJson,
        'group.ch.meteoblick'
      );
    });

    it('should return null when no weather data is stored', async () => {
      (SharedGroupPreferences.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await SharedStorage.getWeatherData();

      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      (SharedGroupPreferences.getItem as jest.Mock).mockResolvedValueOnce('invalid json');

      const result = await SharedStorage.getWeatherData();

      expect(result).toBeNull();
    });

    it('should handle parse errors gracefully', async () => {
      (SharedGroupPreferences.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Parse error')
      );

      const result = await SharedStorage.getWeatherData();

      expect(result).toBeNull();
    });
  });
});
