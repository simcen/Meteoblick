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
  // Phase 3: fetch all showInApp sensors in parallel, store as array.
  // The widget mirror still uses the first reading (Phase 4b will overhaul).
  let loxoneTemp: number | undefined;
  let loxoneTimestamp: string | undefined;
  let loxoneFresh = false;

  const loxoneConfig = await SharedStorage.getLoxoneConfig();
  const appSensors = loxoneConfig?.sensors.filter((s) => s.showInApp) ?? [];
  if (loxoneConfig?.enabled && appSensors.length > 0) {
    const now = new Date().toISOString();
    try {
      const api = new LoxoneAPI(loxoneConfig);
      const results = await api.getTemperatures(appSensors.map((s) => s.uuid));
      const readings = results.map((r) => ({ uuid: r.uuid, temperature: r.temperature, timestamp: now }));
      await SharedStorage.setLoxoneSensorData(readings);
      const primary = readings.find((r) => r.uuid === appSensors[0].uuid) ?? readings[0];
      loxoneTemp = primary?.temperature;
      loxoneTimestamp = primary?.timestamp;
      loxoneFresh = true;
      console.log('[Background] Loxone readings:', readings.length);
    } catch (loxoneError) {
      console.warn('[Background] Loxone fetch failed:', loxoneError);
      const cached = await SharedStorage.getLoxoneSensorData();
      const primary = cached?.find((r) => r.uuid === appSensors[0].uuid) ?? cached?.[0];
      if (primary) {
        loxoneTemp = primary.temperature;
        loxoneTimestamp = primary.timestamp;
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
