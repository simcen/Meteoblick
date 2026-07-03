import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';

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

    console.log('[Background] Weather data updated:', weather.temperature);

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
        minimumInterval: 60 * 30,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('[Background] Task registered successfully');
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
