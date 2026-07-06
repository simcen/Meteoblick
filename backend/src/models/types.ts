export interface POI {
  point_id: string;
  point_name: string;
  postal_code: string | null;
  latitude: number;
  longitude: number;
  height_masl: number | null;
}

export interface WeatherData {
  point_id: string;
  temperature_actual: number;      // IST (letzte vergangene Stunde)
  temperature_forecast: number;    // Prognose (nächste zukünftige Stunde)
  symbol_code: number;
  precipitation: number;
  timestamp_actual: string;        // Timestamp für IST
  timestamp_forecast: string;      // Timestamp für Prognose
  updated_at: string;
}

export interface WeatherResponse {
  pointId: string;
  locationName: string;
  temperatureActual: number;       // IST (letzte vergangene Stunde)
  temperatureForecast: number;     // Prognose (nächste zukünftige Stunde)
  symbolCode: number;
  precipitation: number;
  timestampActual: string;         // Timestamp für IST
  timestampForecast: string;       // Timestamp für Prognose
  latitude: number;
  longitude: number;
}
