import { createWidget } from 'expo-widgets';
import MeteoblickWidget from '../../widgets/MeteoblickWidget';

// Create widget instance
export const meteoblickWidget = createWidget('MeteoblickWidget', MeteoblickWidget);

// Widget props type
export interface WidgetProps {
  locationName: string;
  temperature: number;
  symbolCode: number;
  precipitation: number;
  buildNumber: string;
}

/**
 * Updates the widget with new data and forces immediate reload
 */
export async function updateWidget(props: WidgetProps): Promise<void> {
  console.log('📱 Updating widget with data:', props);

  try {
    // Update widget with new snapshot
    meteoblickWidget.updateSnapshot(props);

    // Force reload to apply immediately
    meteoblickWidget.reload();

    console.log('✅ Widget updated and reloaded');
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
