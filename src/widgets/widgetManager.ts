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
import { APP_GROUP_ID, WIDGET_LAST_REFRESH_KEY } from '../constants';

// Widget props type
export interface WidgetProps {
  locationName: string;
  temperatureActual?: number;      // IST Temperatur (letzte vergangene Stunde)
  temperatureForecast?: number;    // Prognose Temperatur (nächste zukünftige Stunde)
  symbolCode: number;
  precipitation: number;
  buildNumber: string;
  timestampActual?: string;       // ISO timestamp für IST
  timestampForecast?: string;     // ISO timestamp für Prognose
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
