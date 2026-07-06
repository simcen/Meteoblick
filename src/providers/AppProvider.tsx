import { useEffect, ReactNode } from 'react';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { LoxoneAPI } from '../api/loxone';
import { updateWidget } from '../widgets/widgetManager';
import { registerBackgroundFetch } from '../tasks/weatherBackgroundTask';
import { BUILD_NUMBER } from '../constants';

interface AppProviderProps {
  children: ReactNode;
}

/**
 * AppProvider handles app-wide initialization and side-effects:
 * - Background fetch registration
 * - Foreground weather data refresh (every 5 min)
 * - Loxone sensor data refresh
 */
export function AppProvider({ children }: AppProviderProps) {
  useEffect(() => {
    // Register background fetch on app start
    registerBackgroundFetch();

    // Foreground weather + Loxone refresh
    const fetchAllData = async () => {
      const pointId = await SharedStorage.getPointId();
      if (!pointId) return;

      console.log('[App] Auto-refreshing weather + Loxone data...');

      // 1. MeteoSwiss — independent of Loxone so backend downtime doesn't block Loxone updates.
      let weather = await SharedStorage.getWeatherData(); // cache as fallback
      try {
        const fresh = await MeteoSwissAPI.fetchWeatherData(pointId);
        await SharedStorage.setWeatherData(fresh);
        weather = fresh;
        console.log('[App] MeteoSwiss fetched:', fresh.temperatureActual);
      } catch (error) {
        console.warn('[App] MeteoSwiss fetch failed (continuing):', error);
      }

      // 2. Loxone (if configured) — independent of MeteoSwiss.
      let loxoneTemp: number | undefined;
      let loxoneTimestamp: string | undefined;

      const loxoneConfig = await SharedStorage.getLoxoneConfig();
      if (loxoneConfig?.enabled && loxoneConfig.temperatureSensorUUID) {
        try {
          const api = new LoxoneAPI(loxoneConfig);
          const temp = await api.getTemperature(loxoneConfig.temperatureSensorUUID);
          loxoneTemp = temp;
          loxoneTimestamp = new Date().toISOString();
          await SharedStorage.setLoxoneSensorData({
            temperature: temp,
            timestamp: loxoneTimestamp,
          });
          console.log('[App] Loxone temperature:', temp);
        } catch (loxoneError) {
          console.warn('[App] Loxone fetch failed (continuing):', loxoneError);
          // Fallback: Try to read last cached value
          const cached = await SharedStorage.getLoxoneSensorData();
          if (cached) {
            loxoneTemp = cached.temperature;
            loxoneTimestamp = cached.timestamp;
            console.log('[App] Using cached Loxone data:', loxoneTemp);
          }
        }
      }

      // 3. Update widget — only if we have any weather data (fresh or cached).
      if (weather) {
        try {
          await updateWidget({
            locationName: weather.locationName,
            temperatureActual: weather.temperatureActual,
            temperatureForecast: weather.temperatureForecast,
            temperatureLoxone: loxoneTemp,
            symbolCode: weather.symbolCode,
            precipitation: weather.precipitation,
            buildNumber: BUILD_NUMBER,
            timestampActual: weather.timestampActual,
            timestampForecast: weather.timestampForecast,
            timestampLoxone: loxoneTimestamp,
          });
        } catch (widgetError) {
          console.error('[App] Widget update failed:', widgetError);
        }
      } else {
        console.log('[App] No weather data available (no fresh, no cache) — skipping widget update');
      }
    };

    // Initial fetch
    fetchAllData();

    // Set up interval (5 minutes)
    const interval = setInterval(fetchAllData, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return <>{children}</>;
}
