import SharedGroupPreferences from 'react-native-shared-group-preferences';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_GROUP_ID, POI_STORAGE_KEY, WEATHER_DATA_KEY, WIDGET_LAST_REFRESH_KEY } from '../constants';
import type { WeatherData } from '../types/weather';
import type { POI } from '../types/poi';

const POI_CACHE_KEY = 'meteoblick_poi_cache';
const POI_CACHE_TIMESTAMP_KEY = 'meteoblick_poi_cache_timestamp';
const POI_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const SharedStorage = {
  async getPointId(): Promise<string | null> {
    try {
      const value = await SharedGroupPreferences.getItem(POI_STORAGE_KEY, APP_GROUP_ID);
      return value;
    } catch (error) {
      // Not an error - expected on first install
      return null;
    }
  },

  async setPointId(pointId: string): Promise<void> {
    try {
      await SharedGroupPreferences.setItem(POI_STORAGE_KEY, pointId, APP_GROUP_ID);
    } catch (error) {
      console.error('Failed to save POI to shared storage:', error);
      throw error;
    }
  },

  async getWeatherData(): Promise<WeatherData | null> {
    try {
      const json = await SharedGroupPreferences.getItem(WEATHER_DATA_KEY, APP_GROUP_ID);
      if (!json) return null;
      return JSON.parse(json) as WeatherData;
    } catch (error) {
      // Not an error - expected on first install
      return null;
    }
  },

  async setWeatherData(data: WeatherData): Promise<void> {
    try {
      const json = JSON.stringify(data);
      console.log('💾 Saving to SharedStorage:', {
        key: WEATHER_DATA_KEY,
        appGroup: APP_GROUP_ID,
        location: data.location,
        locationName: data.locationName,
        temperatureActual: data.temperatureActual,
        temperatureForecast: data.temperatureForecast
      });
      await SharedGroupPreferences.setItem(WEATHER_DATA_KEY, json, APP_GROUP_ID);
      console.log('✅ Saved to SharedStorage successfully');

      // Verify it was written
      const verify = await SharedGroupPreferences.getItem(WEATHER_DATA_KEY, APP_GROUP_ID);
      console.log('🔍 Verification read:', verify ? 'Data found' : 'NO DATA');
    } catch (error) {
      console.error('❌ Failed to save weather data to shared storage:', error);
      throw error;
    }
  },

  async getCachedPOIs(): Promise<POI[] | null> {
    try {
      const timestampStr = await AsyncStorage.getItem(POI_CACHE_TIMESTAMP_KEY);
      if (!timestampStr) return null;

      const timestamp = parseInt(timestampStr, 10);
      const age = Date.now() - timestamp;

      if (age > POI_CACHE_MAX_AGE_MS) {
        console.log('POI cache expired');
        return null;
      }

      const json = await AsyncStorage.getItem(POI_CACHE_KEY);
      if (!json) return null;

      const pois = JSON.parse(json);
      console.log(`Loaded ${pois.length} POIs from cache (age: ${Math.round(age / 1000 / 60 / 60)}h)`);
      return pois;
    } catch (error) {
      console.error('Failed to read POI cache:', error);
      return null;
    }
  },

  async setCachedPOIs(pois: POI[]): Promise<void> {
    try {
      const json = JSON.stringify(pois);
      await AsyncStorage.setItem(POI_CACHE_KEY, json);
      await AsyncStorage.setItem(POI_CACHE_TIMESTAMP_KEY, Date.now().toString());
      console.log(`Cached ${pois.length} POIs`);
    } catch (error) {
      console.error('Failed to cache POIs:', error);
    }
  },

  async getWidgetLastRefresh(): Promise<string | null> {
    try {
      const timestamp = await SharedGroupPreferences.getItem(WIDGET_LAST_REFRESH_KEY, APP_GROUP_ID);
      return timestamp;
    } catch (error) {
      return null;
    }
  },

  // Loxone Configuration
  async getLoxoneConfig(): Promise<{
    cloudAddress: string;
    username: string;
    password: string;
    temperatureSensorUUID?: string;
    enabled: boolean;
  } | null> {
    try {
      const json = await AsyncStorage.getItem('loxone_config');
      if (!json) return null;
      return JSON.parse(json);
    } catch (error) {
      console.error('Failed to read Loxone config:', error);
      return null;
    }
  },

  async setLoxoneConfig(config: {
    cloudAddress: string;
    username: string;
    password: string;
    temperatureSensorUUID?: string;
    enabled: boolean;
  }): Promise<void> {
    try {
      const json = JSON.stringify(config);
      await AsyncStorage.setItem('loxone_config', json);
      console.log('✅ Loxone config saved');
    } catch (error) {
      console.error('Failed to save Loxone config:', error);
      throw error;
    }
  },

  async deleteLoxoneConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem('loxone_config');
      console.log('✅ Loxone config deleted');
    } catch (error) {
      console.error('Failed to delete Loxone config:', error);
      throw error;
    }
  },
};
