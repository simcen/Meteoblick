import Constants from 'expo-constants';

export const APP_GROUP_ID = 'group.ch.meteoblick';
export const POI_STORAGE_KEY = 'meteoblick_poi_id';
export const WEATHER_DATA_KEY = 'meteoblick_weather_data';
export const LAST_FETCH_KEY = 'meteoblick_last_fetch';
export const WIDGET_LAST_REFRESH_KEY = 'meteoblick_widget_last_refresh';

// App Group keys for the iOS Widget Extension. The widget reads from
// these directly via SharedGroupPreferences (Swift UserDefaults suite).
export const WIDGET_LOXONE_CONFIG_KEY = 'loxone_config_widget';
export const WIDGET_LOXONE_SENSOR_DATA_KEY = 'loxone_sensor_data';
export const WIDGET_WEATHER_SNAPSHOT_KEY = 'meteoblick_widget_weather_snapshot';
export const WIDGET_TIMELINE_CALLED_KEY = 'meteoblick_widget_timeline_called';
export const WIDGET_SNAPSHOT_WRITTEN_AT_KEY = 'meteoblick_widget_snapshot_written_at';

// Build number (update before each release)
export const BUILD_NUMBER = '260710-1547';

// API Configuration
// In dev mode with iOS simulator + corporate PAC proxy, CFNetwork cancels
// localhost connections. We hardcode the Mac's en0 IP here as a workaround.
// To change: update this constant and reload Metro / restart the app.
const DEV_API_BASE_URL = 'http://localhost:3000';

// We still try Constants for cases where it's available (Expo Go, future builds).
const extra = (Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {}) as {
  apiBaseUrl?: string;
};
export const API_BASE_URL =
  extra.apiBaseUrl ||
  (__DEV__ ? DEV_API_BASE_URL : "https://meteoblick-api.apps.balz.me");
