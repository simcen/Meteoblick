export interface WeatherData {
  temperature: number;
  symbolCode: number;
  precipitation: number;
  timestamp: string;
  location: string;
  locationName: string;
}

export interface WeatherError {
  code: 'NETWORK_ERROR' | 'PARSE_ERROR' | 'INVALID_POI' | 'UNKNOWN';
  message: string;
}
