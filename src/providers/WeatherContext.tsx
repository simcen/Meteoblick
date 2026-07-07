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
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { LoxoneAPI } from '../api/loxone';
import { updateWidget } from '../widgets/widgetManager';
import { BUILD_NUMBER } from '../constants';
import type { WeatherData } from '../types/weather';

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