/**
 * WeatherContext — single source of truth for weather + Loxone state.
 *
 * The previous AppProvider fetched data and updated only the widget, leaving
 * HomeScreen stuck with stale local state until the user navigated away and
 * back. This context makes the latest data available to every screen that
 * mounts under the provider, so HomeScreen updates automatically when a
 * foreground refresh completes.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import SharedGroupPreferences from 'react-native-shared-group-preferences';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { LoxoneAPI } from '../api/loxone';
import { updateWidget, fetchAndWriteWidgetTimeline } from '../widgets/widgetManager';
import { APP_GROUP_ID, BUILD_NUMBER, WIDGET_WEATHER_SNAPSHOT_KEY, WIDGET_SNAPSHOT_WRITTEN_AT_KEY } from '../constants';
import type { WeatherData } from '../types/weather';

/**
 * Weather symbol mapping (MeteoSwiss code → emoji).
 * Single source of truth — the iOS Widget reads these strings directly,
 * so all visual logic lives in JS and Swift just renders.
 */
function getWeatherSymbol(code: number): string {
  switch (code) {
    case 1:
      return '☀️';
    case 2:
      return '🌤️';
    case 3:
    case 4:
      return '⛅';
    case 5:
    case 6:
      return '☁️';
    case 7:
    case 8:
    case 9:
      return '🌧️';
    case 10:
    case 11:
    case 12:
      return '⛈️';
    case 13:
    case 14:
    case 15:
      return '🌨️';
    default:
      return '🌡️';
  }
}

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export interface WidgetSnapshot {
  locationName: string;
  weatherSymbol: string;
  weatherSymbolSmall: string;
  temperatureActual: string;
  temperatureUnit: string;
  temperatureLoxone: string | null;
  temperatureLoxoneLabel: string;
  precipitation: string;
  precipitationUnit: string;
  precipitationLabel: string;
  timestampActual: string;
  refreshedAt: string;
  buildNumber: string;
}

function buildWidgetSnapshot(
  weather: WeatherData | null,
  loxoneTemp: number | null,
  refreshedAt: Date,
): WidgetSnapshot {
  if (!weather) {
    return {
      locationName: 'Keine Daten',
      weatherSymbol: '🌡️',
      weatherSymbolSmall: '☁️',
      temperatureActual: '--',
      temperatureUnit: '°C',
      temperatureLoxone: null,
      temperatureLoxoneLabel: '🏠',
      precipitation: '0.0',
      precipitationUnit: 'mm',
      precipitationLabel: '💧',
      timestampActual: '',
      refreshedAt: formatTime(refreshedAt.toISOString()),
      buildNumber: BUILD_NUMBER,
    };
  }
  return {
    locationName: weather.locationName,
    weatherSymbol: getWeatherSymbol(weather.symbolCode),
    weatherSymbolSmall: '☁️',
    temperatureActual: weather.temperatureActual.toFixed(1),
    temperatureUnit: '°C',
    temperatureLoxone: loxoneTemp != null ? loxoneTemp.toFixed(1) : null,
    temperatureLoxoneLabel: '🏠',
    precipitation: weather.precipitation.toFixed(1),
    precipitationUnit: 'mm',
    precipitationLabel: '💧',
    timestampActual: formatTime(weather.timestampActual),
    refreshedAt: formatTime(refreshedAt.toISOString()),
    buildNumber: BUILD_NUMBER,
  };
}

interface WeatherState {
  weather: WeatherData | null;
  loxoneTemp: number | null;
  loxoneTimestamp: string | null;
  isFetching: boolean;
  lastFetchAt: Date | null;
}

interface WeatherContextValue extends WeatherState {
  refresh: () => Promise<void>;
}

const WeatherContext = createContext<WeatherContextValue | null>(null);

export function useWeather(): WeatherContextValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather must be used within WeatherProvider');
  return ctx;
}

interface WeatherProviderProps {
  children: ReactNode;
}

export function WeatherProvider({ children }: WeatherProviderProps) {
  const [state, setState] = useState<WeatherState>({
    weather: null,
    loxoneTemp: null,
    loxoneTimestamp: null,
    isFetching: false,
    lastFetchAt: null,
  });

  // Ref guards against overlapping fetches (e.g. foreground refresh while
  // background-fetch fires). The second call aborts before doing network I/O.
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    const pointId = await SharedStorage.getPointId();
    if (!pointId) {
      inFlight.current = false;
      return;
    }

    setState((s) => ({ ...s, isFetching: true }));

    let weather = await SharedStorage.getWeatherData();
    try {
      const fresh = await MeteoSwissAPI.fetchWeatherData(pointId);
      await SharedStorage.setWeatherData(fresh);
      weather = fresh;
      console.log('[Weather] MeteoSwiss fetched:', fresh.temperatureActual);
    } catch (error) {
      console.warn('[Weather] MeteoSwiss fetch failed (continuing):', error);
    }

    let loxoneTemp: number | null = null;
    let loxoneTimestamp: string | null = null;

    const loxoneConfig = await SharedStorage.getLoxoneConfig();
    console.log('[Weather] Loxone config:', {
      isNull: loxoneConfig === null,
      keys: loxoneConfig ? Object.keys(loxoneConfig) : null,
      enabled: loxoneConfig?.enabled,
      hasSensorUUID: !!loxoneConfig?.temperatureSensorUUID,
      username: loxoneConfig?.username,
      cloudAddress: loxoneConfig?.cloudAddress,
    });
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
        console.log('[Weather] Loxone temperature:', temp);
      } catch (error: any) {
        console.warn('[Weather] Loxone fetch failed (continuing):', error?.message ?? error);
        const cached = await SharedStorage.getLoxoneSensorData();
        if (cached) {
          loxoneTemp = cached.temperature;
          loxoneTimestamp = cached.timestamp;
          console.log('[Weather] Using cached Loxone:', loxoneTemp, loxoneTimestamp);
        } else {
          console.log('[Weather] No cached Loxone data available');
        }
      }
    } else {
      console.log('[Weather] Loxone skipped — not enabled or no sensor UUID');
    }

    const fetchCompletedAt = new Date();

    setState({
      weather,
      loxoneTemp,
      loxoneTimestamp,
      isFetching: false,
      lastFetchAt: fetchCompletedAt,
    });

    if (weather) {
      try {
        // Write snapshot to App Group BEFORE triggering WidgetKit reload,
        // so getTimeline() always reads current data when iOS responds.
        const snapshot = buildWidgetSnapshot(weather, loxoneTemp, fetchCompletedAt);
        const snapshotWrittenAt = new Date().toISOString();
        await SharedGroupPreferences.setItem(
          WIDGET_WEATHER_SNAPSHOT_KEY,
          JSON.stringify(snapshot),
          APP_GROUP_ID,
        );
        await SharedGroupPreferences.setItem(WIDGET_SNAPSHOT_WRITTEN_AT_KEY, snapshotWrittenAt, APP_GROUP_ID);
        console.log('[Weather] Widget snapshot written:', snapshot.locationName, snapshot.temperatureActual);

        // Trigger WidgetKit reload — iOS calls getTimeline() which reads the snapshot above.
        await updateWidget({
          locationName: weather.locationName,
          temperatureActual: weather.temperatureActual,
          temperatureForecast: weather.temperatureForecast,
          temperatureLoxone: loxoneTemp ?? undefined,
          symbolCode: weather.symbolCode,
          precipitation: weather.precipitation,
          buildNumber: BUILD_NUMBER,
          timestampActual: weather.timestampActual,
          timestampForecast: weather.timestampForecast,
          timestampLoxone: loxoneTimestamp ?? undefined,
        });

        await fetchAndWriteWidgetTimeline();
      } catch (error) {
        console.error('[Weather] Widget update failed:', error);
      }
    } else {
      console.log('[Weather] No weather data — skipping widget update');
    }

    inFlight.current = false;
  }, []);

  // On mount: hydrate state from cache, then trigger first refresh.
  // Then refresh every 5 minutes while the app is in the foreground.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cachedWeather = await SharedStorage.getWeatherData();
      const cachedLoxone = await SharedStorage.getLoxoneSensorData();
      if (cancelled) return;
      setState((s) => ({
        ...s,
        weather: cachedWeather,
        loxoneTemp: cachedLoxone?.temperature ?? null,
        loxoneTimestamp: cachedLoxone?.timestamp ?? null,
      }));
    })();

    refresh();

    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <WeatherContext.Provider value={{ ...state, refresh }}>
      {children}
    </WeatherContext.Provider>
  );
}