import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { LoxoneAPI } from '../api/loxone';
import { updateWidget } from '../widgets/widgetManager';
import { BUILD_NUMBER } from '../constants';

const WEATHER_BACKGROUND_TASK = 'weather-background-fetch';

TaskManager.defineTask(WEATHER_BACKGROUND_TASK, async () => {
  console.log('[Background] Fetching weather + Loxone data...');

  const pointId = await SharedStorage.getPointId();
  if (!pointId) {
    console.log('[Background] No POI configured, skipping');
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }

  // 1. MeteoSwiss — independent of Loxone so backend downtime doesn't block Loxone updates.
  let weather = await SharedStorage.getWeatherData(); // cache as fallback
  let meteoFresh = false;
  try {
    const fresh = await MeteoSwissAPI.fetchWeatherData(pointId);
    await SharedStorage.setWeatherData(fresh);
    weather = fresh;
    meteoFresh = true;
    console.log('[Background] MeteoSwiss fetched:', fresh.temperatureActual);
  } catch (error) {
    console.warn('[Background] MeteoSwiss fetch failed:', error);
  }

  // 2. Loxone (if configured) — independent of MeteoSwiss.
  // Phase 1: still mirrors the FIRST showInApp sensor as the legacy
  // single value (for the widget's current single-sensor mirror + cache).
  // Phase 3 will replace this with a multi-sensor cache + multi-value
  // widget payload.
  let loxoneTemp: number | undefined;
  let loxoneTimestamp: string | undefined;
  let loxoneFresh = false;

  const loxoneConfig = await SharedStorage.getLoxoneConfig();
  const primarySensorUuid =
    loxoneConfig?.sensors.find((s) => s.showInApp)?.uuid ?? loxoneConfig?.sensors[0]?.uuid;
  if (loxoneConfig?.enabled && primarySensorUuid) {
    try {
      const api = new LoxoneAPI(loxoneConfig);
      const temp = await api.getTemperature(primarySensorUuid);
      loxoneTemp = temp;
      loxoneTimestamp = new Date().toISOString();
      await SharedStorage.setLoxoneSensorData({
        temperature: temp,
        timestamp: loxoneTimestamp,
      });
      loxoneFresh = true;
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
      console.log('[Background] Widget updated:', {
        meteoFresh,
        loxoneFresh,
        meteoSwiss: weather.temperatureActual,
        loxone: loxoneTemp,
      });
    } catch (widgetError) {
      console.error('[Background] Widget update failed:', widgetError);
    }
  } else {
    console.log('[Background] No weather data available (no fresh, no cache) — skipping widget update');
  }

  // Return value: NewData if anything fresh; NoData if only stale cache; Failed only if nothing usable.
  if (meteoFresh || loxoneFresh) return BackgroundFetch.BackgroundFetchResult.NewData;
  if (weather) return BackgroundFetch.BackgroundFetchResult.NoData;
  return BackgroundFetch.BackgroundFetchResult.Failed;
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
