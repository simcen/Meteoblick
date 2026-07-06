import type { WeatherData, WeatherError } from '../types/weather';
import type { POI } from '../types/poi';
import { API_BASE_URL, LAST_FETCH_KEY } from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BackendWeatherResponse {
  pointId: string;
  locationName: string;
  temperatureActual: number;
  temperatureForecast: number;
  symbolCode: number;
  precipitation: number;
  timestampActual: string;
  timestampForecast: string;
  latitude: number;
  longitude: number;
}

interface BackendPOIResponse {
  id: string;
  name: string;
  plz: string | null;
  latitude: number;
  longitude: number;
}

export class MeteoSwissAPI {
  static async fetchWeatherData(pointId: string): Promise<WeatherData> {
    try {
      console.log(`📡 Fetching weather from backend API for POI: ${pointId}`);
      const startTime = Date.now();

      const url = `${API_BASE_URL}/api/weather/${pointId}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw this.createError('invalid_poi', `No weather data found for POI ${pointId}`);
        }
        throw this.createError('api_error', `Backend API returned ${response.status}`);
      }

      const data: BackendWeatherResponse = await response.json();

      const elapsed = Date.now() - startTime;
      console.log(`✅ Weather data fetched in ${elapsed}ms`);

      // Save last fetch timestamp
      await AsyncStorage.setItem(LAST_FETCH_KEY, JSON.stringify({
        timestamp: new Date().toISOString(),
        source: 'app',
        pointId,
        responseTime: elapsed,
      }));

      return {
        temperatureActual: data.temperatureActual,
        temperatureForecast: data.temperatureForecast,
        symbolCode: data.symbolCode,
        precipitation: data.precipitation,
        timestampActual: data.timestampActual,
        timestampForecast: data.timestampForecast,
        location: data.pointId,
        locationName: data.locationName,
      };
    } catch (error: any) {
      console.error('fetchWeatherData error:', error);

      if (error.code) {
        throw error;
      }

      throw this.createError('unknown_error', error.message || 'Failed to fetch weather data');
    }
  }

  static async fetchPOIList(search?: string): Promise<POI[]> {
    try {
      console.log('📡 Fetching POI list from backend API...');
      const startTime = Date.now();

      let url = `${API_BASE_URL}/api/pois`;
      if (search && search.length >= 2) {
        url += `?search=${encodeURIComponent(search)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw this.createError('api_error', `Backend API returned ${response.status}`);
      }

      const data: BackendPOIResponse[] = await response.json();

      const elapsed = Date.now() - startTime;
      console.log(`✅ POI list fetched: ${data.length} POIs in ${elapsed}ms`);

      return data.map(poi => ({
        id: poi.id,
        name: poi.name,
        plz: poi.plz || undefined,
        latitude: poi.latitude,
        longitude: poi.longitude,
      }));
    } catch (error: any) {
      console.error('fetchPOIList error:', error);

      if (error.code) {
        throw error;
      }

      throw this.createError('unknown_error', error.message || 'Failed to load POI list');
    }
  }

  static async getLastFetchInfo(): Promise<{ timestamp: string; source: string; pointId: string; responseTime: number } | null> {
    try {
      const data = await AsyncStorage.getItem(LAST_FETCH_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private static createError(code: WeatherError['code'], message: string): WeatherError {
    return { code, message };
  }
}
