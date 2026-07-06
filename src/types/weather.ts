export interface WeatherData {
  temperatureActual: number;       // IST (letzte vergangene Stunde)
  temperatureForecast: number;     // Prognose (nächste zukünftige Stunde)
  symbolCode: number;
  precipitation: number;
  timestampActual: string;         // Timestamp für IST
  timestampForecast: string;       // Timestamp für Prognose
  location: string;
  locationName: string;
}

export interface WeatherError {
  code: 'NETWORK_ERROR' | 'PARSE_ERROR' | 'INVALID_POI' | 'UNKNOWN';
  message: string;
}
