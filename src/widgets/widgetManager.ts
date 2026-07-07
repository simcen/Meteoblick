/**
 * Widget Manager
 *
 * Imports the widget instance (which is already created via createWidget in the widget file)
 * and provides helper functions for updating widget data.
 *
 * IMPORTANT:
 * - We import the Widget OBJECT, not the component function!
 * - The widget component is compiled to native SwiftUI at build time
 * - Use ONLY updateSnapshot() - no .reload() needed (updates automatically)
 *
 * Source: /Users/siba5/Development/_projects/expo-example/with-widgets/App.tsx
 */
import meteoblickWidget from '../../widgets/MeteoblickWidget';
import SharedGroupPreferences from 'react-native-shared-group-preferences';
import { APP_GROUP_ID, WIDGET_LAST_REFRESH_KEY, API_BASE_URL } from '../constants';
import { SharedStorage } from '../storage/SharedStorage';
import { BUILD_NUMBER } from '../constants';

// Widget props type
export interface WidgetProps {
  locationName: string;
  temperatureActual?: number;      // MeteoSwiss IST (letzte vergangene Stunde)
  temperatureForecast?: number;    // MeteoSwiss Prognose (nächste zukünftige Stunde)
  temperatureLoxone?: number;      // Loxone Sensor IST
  symbolCode: number;
  precipitation: number;
  buildNumber: string;
  timestampActual?: string;       // ISO timestamp für MeteoSwiss IST
  timestampForecast?: string;     // ISO timestamp für MeteoSwiss Prognose
  timestampLoxone?: string;       // ISO timestamp für Loxone
  refreshedAt?: string;           // ISO timestamp when widget was updated
}

/**
 * Updates the widget with new data
 *
 * On physical devices, widgets don't auto-refresh from Background Fetch
 * until iOS has "learned" the app's usage pattern (24-48 hours).
 *
 * We write data to SharedStorage so the widget CAN read it when iOS
 * decides to refresh, but we can't force refresh from JS.
 */
export async function updateWidget(props: WidgetProps): Promise<void> {
  console.log('📱 Updating widget with data:', props);

  try {
    const now = new Date().toISOString();

    // Update widget snapshot (works in Simulator and when app is foreground)
    meteoblickWidget.updateSnapshot({
      ...props,
      refreshedAt: now,
    });

    // Save timestamp of widget update to SharedStorage
    await SharedGroupPreferences.setItem(
      WIDGET_LAST_REFRESH_KEY,
      now,
      APP_GROUP_ID
    );

    console.log('✅ Widget snapshot updated + data saved to SharedStorage');
  } catch (error) {
    console.error('❌ Failed to update widget:', error);
    throw error;
  }
}

/**
 * Fetches a fresh timeline from the backend widget endpoint and writes
 * it to the widget. The backend consolidates weather + (optional) Loxone
 * data into one response, so the widget has everything it needs in a
 * single round-trip.
 *
 * Loxone credentials are passed in headers per request — the backend is
 * stateless and never persists them.
 *
 * Falls back to the previous snapshot in App Group on fetch failure, so
 * the widget keeps showing the last known good data.
 */
export async function fetchAndWriteWidgetTimeline(): Promise<void> {
  console.log('📅 Fetching widget timeline from backend...');

  try {
    const poiId = await SharedStorage.getPointId();
    if (!poiId) {
      console.log('[Widget] No POI configured, skipping');
      return;
    }

    // Build headers for Loxone (if configured + enabled)
    const headers: Record<string, string> = {};
    const loxoneConfig = await SharedStorage.getLoxoneConfig();
    if (loxoneConfig?.enabled && loxoneConfig.temperatureSensorUUID) {
      headers['X-Loxone-SNR'] = loxoneConfig.cloudAddress;
      headers['X-Loxone-Sensor-Uuid'] = loxoneConfig.temperatureSensorUUID;
      const credentials = btoa(`${loxoneConfig.username}:${loxoneConfig.password}`);
      headers['X-Loxone-Credentials'] = `Basic ${credentials}`;
    }

    const url = `${API_BASE_URL}/api/widget/timeline?poiId=${encodeURIComponent(poiId)}`;
    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      console.warn(`[Widget] Timeline fetch failed: HTTP ${response.status}`);
      return;
    }

    const data = await response.json();
    console.log('[Widget] Timeline received:', {
      location: data.locationName,
      temp: data.current?.temperature,
      loxone: data.smartHome?.temperature,
    });

    await updateWidget({
      locationName: data.locationName ?? '—',
      temperatureActual: data.current?.temperature,
      temperatureForecast: data.forecast?.temperature,
      temperatureLoxone: data.smartHome?.temperature,
      symbolCode: data.current?.symbolCode ?? 0,
      precipitation: data.current?.precipitation ?? 0,
      buildNumber: data.buildNumber ?? BUILD_NUMBER,
      timestampActual: data.current?.timestamp,
      timestampForecast: data.forecast?.timestamp,
      timestampLoxone: data.smartHome?.timestamp,
    });
  } catch (error) {
    console.warn('[Widget] Timeline fetch error (widget keeps last snapshot):', error);
  }
}

/**
 * Updates widget timeline with scheduled entries
 */
export async function updateWidgetTimeline(entries: Array<{ date: Date; props: WidgetProps }>): Promise<void> {
  console.log(`📅 Updating widget timeline with ${entries.length} entries`);

  try {
    meteoblickWidget.updateTimeline(entries);
    console.log('✅ Widget timeline updated');
  } catch (error) {
    console.error('❌ Failed to update widget timeline:', error);
    throw error;
  }
}

/**
 * Gets current widget timeline entries
 */
export async function getWidgetTimeline(): Promise<Array<{ date: Date; props: WidgetProps }>> {
  try {
    return await meteoblickWidget.getTimeline();
  } catch (error) {
    console.error('❌ Failed to get widget timeline:', error);
    return [];
  }
}
