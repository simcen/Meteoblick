import { WidgetPreview } from 'expo-widgets';

export default function WeatherWidget() {
  const widgetData = {
    location: 'Zürich',
    temperature: '22°C',
    condition: '⛅',
  };

  return (
    <WidgetPreview>
      {JSON.stringify(widgetData)}
    </WidgetPreview>
  );
}
