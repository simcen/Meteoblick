import { useEffect, ReactNode } from 'react';
import { registerBackgroundFetch } from '../tasks/weatherBackgroundTask';
import { WeatherProvider } from './WeatherContext';

interface AppProviderProps {
  children: ReactNode;
}

/**
 * AppProvider is now a thin shell:
 * - Registers the background-fetch task on app start
 * - Wraps the tree in WeatherProvider, which owns the foreground refresh
 *   interval (every 5 min) and exposes shared state to HomeScreen/DebugScreen
 *   via useWeather().
 */
export function AppProvider({ children }: AppProviderProps) {
  useEffect(() => {
    registerBackgroundFetch();
  }, []);

  return <WeatherProvider>{children}</WeatherProvider>;
}