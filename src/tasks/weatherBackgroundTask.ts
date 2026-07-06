import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { LoxoneAPI } from '../api/loxone';
import { updateWidget } from '../widgets/widgetManager';
import { BUILD_NUMBER } from '../constants';

const WEATHER_BACKGROUND_TASK = 'weather-background-fetch';

TaskManager.defineTask(WEATHER_BACKGROUND_TASK, async () => {
  try {
    console.log('[Background] Fetching weather + Loxone data...');

    const pointId = await SharedStorage.getPointId();
    if (!pointId) {
      console.log('[Background] No POI configured, skipping');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 1. MeteoSwiss
    const weather = await MeteoSwissAPI.fetchWeatherData(pointId);
    await SharedStorage.setWeatherData(weather);

    // 2. Loxone (if configured)
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
        console.log('[Background] Loxone temperature:', temp);
      } catch (loxoneError) {
        console.warn('[Background] Loxone fetch failed:', loxoneError);
        // Fallback to cached value
        const cached = await SharedStorage.getLoxoneSensorData();
        if (cached) {
          loxoneTemp = cached.temperature;
          loxoneTimestamp = cached.timestamp;
        }
      }
    }

    // 3. Update widget
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

    console.log('[Background] Updated:', {
      meteoSwiss: weather.temperatureActual,
      loxone: loxoneTemp,
    });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[Background] Failed to fetch data:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundFetch() {
  try {
    const status = await BackgroundFetch.getStatusAsync();

    if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
      await BackgroundFetch.registerTaskAsync(WEATHER_BACKGROUND_TASK, {
        minimumInterval: 60 * 15, // 15 minutes (iOS minimum)
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('[Background] Task registered successfully (15 min interval)');
    } else {
      console.log('[Background] Background fetch not available:', status);
    }
  } catch (error) {
    console.error('[Background] Failed to register task:', error);
  }
}

export async function unregisterBackgroundFetch() {
  try {
    await BackgroundFetch.unregisterTaskAsync(WEATHER_BACKGROUND_TASK);
    console.log('[Background] Task unregistered');
  } catch (error) {
    console.error('[Background] Failed to unregister task:', error);
  }
}
