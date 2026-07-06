import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { updateWidget } from '../widgets/widgetManager';
import { BUILD_NUMBER } from '../constants';

const WEATHER_BACKGROUND_TASK = 'weather-background-fetch';

TaskManager.defineTask(WEATHER_BACKGROUND_TASK, async () => {
  try {
    console.log('[Background] Fetching weather data...');

    const pointId = await SharedStorage.getPointId();
    if (!pointId) {
      console.log('[Background] No POI configured, skipping');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const weather = await MeteoSwissAPI.fetchWeatherData(pointId);
    await SharedStorage.setWeatherData(weather);

    // Update widget with new data
    await updateWidget({
      locationName: weather.locationName,
      temperatureActual: weather.temperatureActual,
      temperatureForecast: weather.temperatureForecast,
      symbolCode: weather.symbolCode,
      precipitation: weather.precipitation,
      buildNumber: BUILD_NUMBER,
      timestampActual: weather.timestampActual,
      timestampForecast: weather.timestampForecast,
    });

    console.log('[Background] Weather data + widget updated:', weather.temperatureActual);

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[Background] Failed to fetch weather:', error);
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
