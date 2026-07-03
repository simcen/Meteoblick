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
  temperature: number;
  symbol_code: number;
  precipitation: number;
  timestamp: string;
  updated_at: string;
}

export interface WeatherResponse {
  pointId: string;
  locationName: string;
  temperature: number;
  symbolCode: number;
  precipitation: number;
  timestamp: string;
  latitude: number;
  longitude: number;
}
