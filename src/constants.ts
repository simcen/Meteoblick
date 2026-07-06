export const APP_GROUP_ID = 'group.ch.meteoblick';
export const POI_STORAGE_KEY = 'meteoblick_poi_id';
export const WEATHER_DATA_KEY = 'meteoblick_weather_data';
export const LAST_FETCH_KEY = 'meteoblick_last_fetch';
export const WIDGET_LAST_REFRESH_KEY = 'meteoblick_widget_last_refresh';

// Build number (update before each release)
export const BUILD_NUMBER = '260706-1420';

// API Configuration
// Simulator: localhost maps to host machine
export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://meteoblick-api-17f0b6fdf031.herokuapp.com';
