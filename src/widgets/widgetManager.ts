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
  temperature: number;
  symbolCode: number;
  precipitation: number;
  buildNumber: string;
  timestamp?: string; // ISO timestamp of weather data (from backend)
  refreshedAt?: string; // ISO timestamp when widget was updated
}

/**
 * Updates the widget with new data
 * Widget updates automatically after updateSnapshot() - no .reload() needed!
 */
export async function updateWidget(props: WidgetProps): Promise<void> {
  console.log('📱 Updating widget with data:', props);

  try {
    const now = new Date().toISOString();

    // Update widget snapshot with refresh timestamp
    meteoblickWidget.updateSnapshot({
      ...props,
      refreshedAt: now,
    });

    // Save timestamp of widget update
    await SharedGroupPreferences.setItem(
      WIDGET_LAST_REFRESH_KEY,
      now,
      APP_GROUP_ID
    );

    console.log('✅ Widget snapshot updated');
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
