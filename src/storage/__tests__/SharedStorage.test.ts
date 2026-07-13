import SharedGroupPreferences from 'react-native-shared-group-preferences';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SharedStorage } from '../SharedStorage';
import type { WeatherData } from '../../types/weather';

// Mock SharedGroupPreferences + AsyncStorage globally
jest.mock('react-native-shared-group-preferences');
jest.mock('@react-native-async-storage/async-storage');

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

  describe('Loxone Multi-Sensor Storage', () => {
    beforeEach(() => {
      (AsyncStorage.getItem as jest.Mock).mockReset();
      (AsyncStorage.setItem as jest.Mock).mockReset();
      (AsyncStorage.removeItem as jest.Mock).mockReset();
    });

    it('should return null when no Loxone config stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      const result = await SharedStorage.getLoxoneConfig();
      expect(result).toBeNull();
    });

    it('should store and retrieve a new-shape Loxone config', async () => {
      const cfg = {
        cloudAddress: '504F94A1874F',
        username: 'admin',
        password: 'pw',
        enabled: true,
        sensors: [
          { uuid: 'aa-1', name: 'Aussen', showInApp: true, showInWidget: true, order: 0 },
        ],
      };
      const json = JSON.stringify(cfg);
      // getLoxoneConfig calls AsyncStorage.getItem once for the read
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(json);

      const result = await SharedStorage.getLoxoneConfig();
      expect(result).toEqual(cfg);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('loxone_config');
    });

    it('should migrate legacy single-sensor config to array shape', async () => {
      const legacy = {
        cloudAddress: '504F94A1874F',
        username: 'admin',
        password: 'pw',
        enabled: true,
        temperatureSensorUUID: 'legacy-uuid-123',
        temperatureSensorName: 'Aussen',
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(legacy));

      const result = await SharedStorage.getLoxoneConfig();
      expect(result?.sensors).toHaveLength(1);
      expect(result?.sensors[0]).toEqual({
        uuid: 'legacy-uuid-123',
        name: 'Aussen',
        showInApp: true,
        showInWidget: true,
        order: 0,
      });
      // Should persist the migrated shape back to AsyncStorage
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'loxone_config',
        expect.stringContaining('"sensors"'),
      );
      // Should NOT contain the legacy fields anymore
      const persisted = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1],
      );
      expect(persisted.temperatureSensorUUID).toBeUndefined();
      expect(persisted.sensors[0].uuid).toBe('legacy-uuid-123');
    });

    it('should use UUID as name fallback when migrating without temperatureSensorName', async () => {
      const legacy = {
        cloudAddress: 'CAFE',
        username: 'u',
        password: 'p',
        enabled: true,
        temperatureSensorUUID: 'only-uuid-here',
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(legacy));
      const result = await SharedStorage.getLoxoneConfig();
      expect(result?.sensors[0].name).toBe('only-uuid-here');
    });

    it('addSensor: appends a sensor with order = max+1', async () => {
      const cfg = {
        cloudAddress: 'CAFE', username: 'u', password: 'p', enabled: true,
        sensors: [
          { uuid: 'a', name: 'A', showInApp: true, showInWidget: true, order: 0 },
          { uuid: 'b', name: 'B', showInApp: true, showInWidget: true, order: 1 },
        ],
      };
      // getLoxoneConfig read
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cfg));

      const result = await SharedStorage.addSensor({
        uuid: 'c', name: 'C', showInApp: true, showInWidget: true,
      });
      expect(result?.sensors).toHaveLength(3);
      expect(result?.sensors[2]).toMatchObject({ uuid: 'c', order: 2 });
    });

    it('removeSensor: drops + re-numbers orders', async () => {
      const cfg = {
        cloudAddress: 'CAFE', username: 'u', password: 'p', enabled: true,
        sensors: [
          { uuid: 'a', name: 'A', showInApp: true, showInWidget: true, order: 0 },
          { uuid: 'b', name: 'B', showInApp: true, showInWidget: true, order: 1 },
          { uuid: 'c', name: 'C', showInApp: true, showInWidget: true, order: 2 },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cfg));

      const result = await SharedStorage.removeSensor('b');
      expect(result?.sensors.map((s) => s.uuid)).toEqual(['a', 'c']);
      expect(result?.sensors.map((s) => s.order)).toEqual([0, 1]);
    });

    it('updateSensor: applies partial changes', async () => {
      const cfg = {
        cloudAddress: 'CAFE', username: 'u', password: 'p', enabled: true,
        sensors: [
          { uuid: 'a', name: 'A', showInApp: true, showInWidget: true, order: 0 },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cfg));

      const result = await SharedStorage.updateSensor('a', { name: 'Aussen', showInApp: false });
      expect(result?.sensors[0]).toMatchObject({ uuid: 'a', name: 'Aussen', showInApp: false });
      // showInWidget and order preserved
      expect(result?.sensors[0].showInWidget).toBe(true);
      expect(result?.sensors[0].order).toBe(0);
    });

    it('reorderSensors: applies new order', async () => {
      const cfg = {
        cloudAddress: 'CAFE', username: 'u', password: 'p', enabled: true,
        sensors: [
          { uuid: 'a', name: 'A', showInApp: true, showInWidget: true, order: 0 },
          { uuid: 'b', name: 'B', showInApp: true, showInWidget: true, order: 1 },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cfg));

      const result = await SharedStorage.reorderSensors(['b', 'a']);
      expect(result?.sensors.map((s) => s.uuid)).toEqual(['b', 'a']);
      expect(result?.sensors.map((s) => s.order)).toEqual([0, 1]);
    });

    it('reorderSensors: throws on unknown UUID', async () => {
      const cfg = {
        cloudAddress: 'CAFE', username: 'u', password: 'p', enabled: true,
        sensors: [
          { uuid: 'a', name: 'A', showInApp: true, showInWidget: true, order: 0 },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cfg));

      await expect(SharedStorage.reorderSensors(['a', 'unknown'])).rejects.toThrow(
        /Unknown sensor uuid: unknown/,
      );
    });
  });
});
