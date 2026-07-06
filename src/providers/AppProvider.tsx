import { useEffect, ReactNode } from 'react';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
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
 */
export function AppProvider({ children }: AppProviderProps) {
  useEffect(() => {
    // Register background fetch on app start
    registerBackgroundFetch();

    // Foreground weather refresh
    const fetchWeatherData = async () => {
      const pointId = await SharedStorage.getPointId();
      if (!pointId) return;

      try {
        console.log('[App] Auto-refreshing weather data (foreground)...');
        const weather = await MeteoSwissAPI.fetchWeatherData(pointId);
        await SharedStorage.setWeatherData(weather);

        // Update widget with fresh data
        await updateWidget({
          locationName: weather.locationName,
          temperature: weather.temperature,
          symbolCode: weather.symbolCode,
          precipitation: weather.precipitation,
          buildNumber: BUILD_NUMBER,
          timestamp: weather.timestamp,
        });
      } catch (error) {
        console.error('[App] Failed to auto-refresh weather:', error);
      }
    };

    // Initial fetch
    fetchWeatherData();

    // Set up interval (5 minutes)
    const weatherInterval = setInterval(fetchWeatherData, 5 * 60 * 1000);

    return () => {
      clearInterval(weatherInterval);
    };
  }, []);

  return <>{children}</>;
}
