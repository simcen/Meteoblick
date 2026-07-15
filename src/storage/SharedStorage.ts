import SharedGroupPreferences from 'react-native-shared-group-preferences';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_GROUP_ID, API_BASE_URL, POI_STORAGE_KEY, WEATHER_DATA_KEY, WIDGET_LAST_REFRESH_KEY, WIDGET_LOXONE_CONFIG_KEY, WIDGET_LOXONE_SENSOR_DATA_KEY, WIDGET_TIMELINE_CALLED_KEY, WIDGET_SNAPSHOT_WRITTEN_AT_KEY, THEME_PREFERENCE_KEY } from '../constants';
import type { WeatherData } from '../types/weather';
import type { POI } from '../types/poi';

export type ThemePreference = 'system' | 'light' | 'dark';

const VALID_THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

// Cached temperature reading for a single Loxone sensor.
// Stored as an array (Phase 3+) so SmartHomeScreen can show all configured
// sensors and the widget still pulls the first entry until Phase 4b.
export type LoxoneReading = {
  uuid: string;
  temperature: number;
  timestamp: string;
};

const POI_CACHE_KEY = 'meteoblick_poi_cache';

// ─── Loxone multi-sensor types & migration helper ───────────────────
//
// Storage schema (multi-sensor):
//   { cloudAddress, username, password, sensors: Sensor[], enabled }
//
// Each Sensor:
//   { uuid, name, showInApp, showInWidget, order }
//
// Migration: legacy single-sensor configs (with `temperatureSensorUUID` /
// `temperatureSensorName` at the top level) are auto-converted on read.
// The migration is one-shot and idempotent — once persisted in the new
// shape, the read path skips the legacy branch.

type Sensor = {
  uuid: string;
  name: string;
  showInApp: boolean;
  showInWidget: boolean;
  order: number;
};

export type LoxoneConfig = {
  cloudAddress: string;
  username: string;
  password: string;
  sensors: Sensor[];
  enabled: boolean;
  // Phase 5+: per-user Lock Screen widget config.
  // 'weather' (default) shows MeteoSwiss in the circular Lock Screen
  // widget. A sensor UUID shows that specific sensor instead.
  lockScreenCircular?: string;
};

// Legacy shape (kept only for migration detection).
type LegacyLoxoneConfig = {
  cloudAddress: string;
  username: string;
  password: string;
  temperatureSensorUUID?: string;
  temperatureSensorName?: string;
  enabled: boolean;
};

function isLegacyShape(
  raw: LegacyLoxoneConfig | LoxoneConfig,
): raw is LegacyLoxoneConfig & { temperatureSensorUUID: string } {
  const r = raw as LegacyLoxoneConfig & { sensors?: unknown };
  return (
    !!r &&
    typeof r === 'object' &&
    !Array.isArray(r.sensors) &&
    typeof r.temperatureSensorUUID === 'string'
  );
}

const POI_CACHE_TIMESTAMP_KEY = 'meteoblick_poi_cache_timestamp';
const POI_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const SharedStorage = {
  async getPointId(): Promise<string | null> {
    try {
      const value = await SharedGroupPreferences.getItem(POI_STORAGE_KEY, APP_GROUP_ID);
      return value;
    } catch (error) {
      // Not an error - expected on first install
      return null;
    }
  },

  async setPointId(pointId: string): Promise<void> {
    try {
      await SharedGroupPreferences.setItem(POI_STORAGE_KEY, pointId, APP_GROUP_ID);
    } catch (error) {
      console.error('Failed to save POI to shared storage:', error);
      throw error;
    }
  },

  async getWeatherData(): Promise<WeatherData | null> {
    try {
      const json = await SharedGroupPreferences.getItem(WEATHER_DATA_KEY, APP_GROUP_ID);
      if (!json) return null;
      return JSON.parse(json) as WeatherData;
    } catch (error) {
      // Not an error - expected on first install
      return null;
    }
  },

  async setWeatherData(data: WeatherData): Promise<void> {
    try {
      const json = JSON.stringify(data);
      console.log('💾 Saving to SharedStorage:', {
        key: WEATHER_DATA_KEY,
        appGroup: APP_GROUP_ID,
        location: data.location,
        locationName: data.locationName,
        temperatureActual: data.temperatureActual,
        temperatureForecast: data.temperatureForecast
      });
      await SharedGroupPreferences.setItem(WEATHER_DATA_KEY, json, APP_GROUP_ID);
      console.log('✅ Saved to SharedStorage successfully');

      // Verify it was written
      const verify = await SharedGroupPreferences.getItem(WEATHER_DATA_KEY, APP_GROUP_ID);
      console.log('🔍 Verification read:', verify ? 'Data found' : 'NO DATA');
    } catch (error) {
      console.error('❌ Failed to save weather data to shared storage:', error);
      throw error;
    }
  },

  async getCachedPOIs(): Promise<POI[] | null> {
    try {
      const timestampStr = await AsyncStorage.getItem(POI_CACHE_TIMESTAMP_KEY);
      if (!timestampStr) return null;

      const timestamp = parseInt(timestampStr, 10);
      const age = Date.now() - timestamp;

      if (age > POI_CACHE_MAX_AGE_MS) {
        console.log('POI cache expired');
        return null;
      }

      const json = await AsyncStorage.getItem(POI_CACHE_KEY);
      if (!json) return null;

      const pois = JSON.parse(json);
      console.log(`Loaded ${pois.length} POIs from cache (age: ${Math.round(age / 1000 / 60 / 60)}h)`);
      return pois;
    } catch (error) {
      console.error('Failed to read POI cache:', error);
      return null;
    }
  },

  async setCachedPOIs(pois: POI[]): Promise<void> {
    try {
      const json = JSON.stringify(pois);
      await AsyncStorage.setItem(POI_CACHE_KEY, json);
      await AsyncStorage.setItem(POI_CACHE_TIMESTAMP_KEY, Date.now().toString());
      console.log(`Cached ${pois.length} POIs`);
    } catch (error) {
      console.error('Failed to cache POIs:', error);
    }
  },

  async getWidgetLastRefresh(): Promise<string | null> {
    try {
      const timestamp = await SharedGroupPreferences.getItem(WIDGET_LAST_REFRESH_KEY, APP_GROUP_ID);
      return timestamp;
    } catch (error) {
      return null;
    }
  },

  async getWidgetTimelineCalled(): Promise<string | null> {
    try {
      const timestamp = await SharedGroupPreferences.getItem(WIDGET_TIMELINE_CALLED_KEY, APP_GROUP_ID);
      return timestamp || null;
    } catch (error) {
      return null;
    }
  },

  async getWidgetSnapshotWrittenAt(): Promise<string | null> {
    try {
      const timestamp = await SharedGroupPreferences.getItem(WIDGET_SNAPSHOT_WRITTEN_AT_KEY, APP_GROUP_ID);
      return timestamp || null;
    } catch (error) {
      return null;
    }
  },

  // Loxone Configuration
async getLoxoneConfig(): Promise<LoxoneConfig | null> {
  try {
    const json = await AsyncStorage.getItem('loxone_config');
    if (!json) return null;
    const raw = JSON.parse(json);

    // Migration: legacy single-sensor → array shape.
    if (isLegacyShape(raw)) {
      const migrated: LoxoneConfig = {
        cloudAddress: raw.cloudAddress,
        username: raw.username,
        password: raw.password,
        enabled: raw.enabled,
        sensors: [
          {
            uuid: raw.temperatureSensorUUID,
            name: raw.temperatureSensorName ?? raw.temperatureSensorUUID,
            showInApp: true,
            showInWidget: true,
            order: 0,
          },
        ],
      };
      // Persist migrated shape; from now on the legacy branch is skipped.
      await AsyncStorage.setItem('loxone_config', JSON.stringify(migrated));
      return migrated;
    }

    return raw as LoxoneConfig;
  } catch (error) {
    console.error('Failed to read Loxone config:', error);
    return null;
  }
},

async setLoxoneConfig(config: LoxoneConfig): Promise<void> {
  try {
    const json = JSON.stringify(config);
    // AsyncStorage: source of truth for the host app.
    await AsyncStorage.setItem('loxone_config', json);
    // App Group: mirror so the iOS Widget Extension can read it.
    // Excludes `enabled` since the widget shouldn't toggle on/off via
    // its own logic — that's a user-facing toggle only.
    if (config.enabled) {
      // Also mirror poiId + apiBaseUrl so the widget can call
      // /api/widget/timeline?poiId=... without needing the host app.
      const poiId = (await SharedStorage.getPointId()) ?? '';
      const apiBaseUrl = API_BASE_URL;
      // Mirror: credentials + ALL showInWidget sensor UUIDs + POI.
      // Phase 4b+: widget TimelineProvider fetches all data itself on every
      // timeline reload — calls /api/widget/timeline for weather and
      // LoxoneWidgetClient for multi-sensor. The App continues to write
      // snapshots opportunistically (foreground / BG fetch / pull-to-refresh)
      // as a fallback for the widget when iOS throttles timeline refreshes.
      const widgetConfig = {
        cloudAddress: config.cloudAddress,
        username: config.username,
        password: config.password,
        showInWidgetSensorUuids: config.sensors
          .filter((s) => s.showInWidget)
          .map((s) => s.uuid),
        // Mirrored so the widget can call /api/widget/timeline?poiId=...
        // for weather data without needing the host app to push it.
        // Empty string signals "not configured" → widget keeps cached snapshot.
        poiId,
        apiBaseUrl,
        // Phase 5+: per-user Lock Screen widget config.
        // 'weather' (default) shows MeteoSwiss; a sensor UUID shows that
        // specific sensor. The widget picks the right value at render time.
        lockScreenCircular: config.lockScreenCircular ?? 'weather',
      };
      await SharedGroupPreferences.setItem(
        WIDGET_LOXONE_CONFIG_KEY,
        JSON.stringify(widgetConfig),
        APP_GROUP_ID,
      );
    } else {
      // Toggle off → clear widget copy so the widget stops fetching.
      // react-native-shared-group-preferences has no removeItem; empty string signals disabled.
      await SharedGroupPreferences.setItem(WIDGET_LOXONE_CONFIG_KEY, '', APP_GROUP_ID);
    }
    console.log('✅ Loxone config saved (app + widget mirror)');
  } catch (error) {
    console.error('Failed to save Loxone config:', error);
    throw error;
  }
},

// ─── Multi-sensor granular ops ──────────────────────────────────────
//
// All ops read via getLoxoneConfig (which migrates legacy shape on first
// read) and write back the full new shape. Return the updated config so
// callers can update local state without a second fetch.

async addSensor(sensor: Omit<Sensor, 'order'>): Promise<LoxoneConfig | null> {
  const config = await this.getLoxoneConfig();
  if (!config) return null;
  const maxOrder = config.sensors.reduce((max, s) => Math.max(max, s.order), -1);
  const next: Sensor = { ...sensor, order: maxOrder + 1 };
  await this.setLoxoneConfig({ ...config, sensors: [...config.sensors, next] });
  return { ...config, sensors: [...config.sensors, next] };
},

async removeSensor(uuid: string): Promise<LoxoneConfig | null> {
  const config = await this.getLoxoneConfig();
  if (!config) return null;
  const remaining = config.sensors
    .filter((s) => s.uuid !== uuid)
    // Re-number orders to be contiguous after removal.
    .map((s, i) => ({ ...s, order: i }));
  await this.setLoxoneConfig({ ...config, sensors: remaining });
  return { ...config, sensors: remaining };
},

async updateSensor(
  uuid: string,
  partial: Partial<Omit<Sensor, 'uuid'>>,
): Promise<LoxoneConfig | null> {
  const config = await this.getLoxoneConfig();
  if (!config) return null;
  const next = config.sensors.map((s) => (s.uuid === uuid ? { ...s, ...partial } : s));
  await this.setLoxoneConfig({ ...config, sensors: next });
  return { ...config, sensors: next };
},

async reorderSensors(orderedUuids: string[]): Promise<LoxoneConfig | null> {
  const config = await this.getLoxoneConfig();
  if (!config) return null;
  const byUuid = new Map(config.sensors.map((s) => [s.uuid, s]));
  const next = orderedUuids.map((uuid, i) => {
    const s = byUuid.get(uuid);
    if (!s) throw new Error(`Unknown sensor uuid: ${uuid}`);
    return { ...s, order: i };
  });
  await this.setLoxoneConfig({ ...config, sensors: next });
  return { ...config, sensors: next };
},

  async deleteLoxoneConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem('loxone_config');
      await SharedGroupPreferences.setItem(WIDGET_LOXONE_CONFIG_KEY, '', APP_GROUP_ID);
      console.log('✅ Loxone config deleted (app + widget)');
    } catch (error) {
      console.error('Failed to delete Loxone config:', error);
      throw error;
    }
  },

  async getLoxoneSensorData(): Promise<LoxoneReading[] | null> {
    try {
      const json = await SharedGroupPreferences.getItem(
        WIDGET_LOXONE_SENSOR_DATA_KEY,
        APP_GROUP_ID,
      );
      if (!json) return null;
      return JSON.parse(json);
    } catch (error) {
      return null;
    }
  },

  async setLoxoneSensorData(readings: LoxoneReading[]): Promise<void> {
    try {
      const json = JSON.stringify(readings);
      await SharedGroupPreferences.setItem(WIDGET_LOXONE_SENSOR_DATA_KEY, json, APP_GROUP_ID);
    } catch (error) {
      console.error('Failed to save Loxone sensor data:', error);
      throw error;
    }
  },

  /**
   * Widget-readable Loxone config. The host app writes this on every
   * config change so the iOS Widget Extension can fetch the Loxone
   * temperature independently of the host app.
   *
   * Only populated when Loxone is enabled — see setLoxoneConfig above.
   */
  async getLoxoneConfigForWidget(): Promise<{
    cloudAddress: string;
    username: string;
    password: string;
    temperatureSensorUUID?: string;
  } | null> {
    try {
      const json = await SharedGroupPreferences.getItem(
        WIDGET_LOXONE_CONFIG_KEY,
        APP_GROUP_ID,
      );
      if (!json) return null;
      return JSON.parse(json);
    } catch (error) {
      console.error('Failed to read widget Loxone config:', error);
      return null;
    }
  },

  // Theme preference (light/dark/system) — AsyncStorage only, not mirrored to widget.
  // The widget uses a fixed brand gradient regardless of theme.
  async getThemePreference(): Promise<ThemePreference> {
    try {
      const value = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
      if (value && VALID_THEME_PREFERENCES.includes(value as ThemePreference)) {
        return value as ThemePreference;
      }
      return 'system';
    } catch (error) {
      console.error('Failed to read theme preference:', error);
      return 'system';
    }
  },

  async setThemePreference(preference: ThemePreference): Promise<void> {
    try {
      if (!VALID_THEME_PREFERENCES.includes(preference)) {
        throw new Error(`Invalid theme preference: ${preference}`);
      }
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
      throw error;
    }
  },
};
