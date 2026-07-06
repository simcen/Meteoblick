import { HStack, VStack, Spacer, Text, ZStack, Rectangle } from '@expo/ui/swift-ui';
import {
  padding,
  font,
  foregroundStyle,
  frame,
  clipShape,
  containerBackground,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

interface WeatherProps {
  locationName: string;
  temperatureActual: number;       // IST Temperatur (letzte vergangene Stunde)
  temperatureForecast: number;     // Prognose Temperatur (nächste zukünftige Stunde)
  symbolCode: number;
  precipitation: number;
  buildNumber: string;
  timestampActual?: string;        // ISO timestamp für IST
  timestampForecast?: string;      // ISO timestamp für Prognose
  refreshedAt?: string;            // ISO timestamp when widget was updated
}

/**
 * Meteoblick Weather Widget
 *
 * IMPORTANT:
 * - The 'widget' directive MUST be inside the function body!
 * - Styling MUST use modifiers={[...]} syntax, NOT direct props
 * - This gets compiled to native SwiftUI at build-time
 *
 * Source: https://docs.expo.dev/versions/latest/sdk/widgets/
 * Example: /Users/siba5/Development/_projects/expo-example/with-widgets
 */
const MeteoblickWidget = (
  props: WeatherProps,
  environment: WidgetEnvironment
) => {
  'widget';  // <- MUST be inside the function!

  // Helper function MUST be inside the widget component!
  const getWeatherSymbol = (code: number): string => {
    switch (code) {
      case 1:
        return '☀️';
      case 2:
        return '🌤️';
      case 3:
      case 4:
        return '⛅';
      case 5:
      case 6:
        return '☁️';
      case 7:
      case 8:
      case 9:
        return '🌧️';
      case 10:
      case 11:
      case 12:
        return '⛈️';
      case 13:
      case 14:
      case 15:
        return '🌨️';
      default:
        return '🌡️';
    }
  };

  const weatherIcon = getWeatherSymbol(props.symbolCode);
  const isFullColor =
    environment.widgetRenderingMode == null || environment.widgetRenderingMode === 'fullColor';

  // Responsive sizing based on widget family
  const family = environment.widgetFamily;
  const isSmall = family === 'systemSmall' || family === 'accessoryCircular' || family === 'accessoryRectangular';
  const isMedium = family === 'systemMedium';
  const isLarge = family === 'systemLarge' || family === 'systemExtraLarge';

  // Adaptive font sizes
  const headerFontSize = isSmall ? 10 : isMedium ? 12 : 14;
  const iconFontSize = isSmall ? 16 : isMedium ? 20 : 24;
  const tempFontSize = isSmall ? 24 : isMedium ? 32 : 40;
  const unitFontSize = isSmall ? 12 : isMedium ? 16 : 20;
  const precipFontSize = isSmall ? 10 : isMedium ? 12 : 14;
  const buildFontSize = isSmall ? 8 : 9;

  // Adaptive spacing
  const containerPadding = isSmall ? 8 : isMedium ? 12 : 16;
  const contentSpacing = isSmall ? 2 : 4;

  // Format timestamp for display (only show time, not date)
  const formatTimestamp = (isoString?: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <ZStack
      alignment="leading"
      modifiers={[
        containerBackground('#3366CC', 'widget'),
        clipShape('containerRelativeShape'),
      ]}
    >
      {/* Gradient background */}
      {isFullColor && (
        <Rectangle
          modifiers={[
            foregroundStyle({
              type: 'linearGradient',
              colors: ['#58BEF6', '#3366CC'],
              startPoint: { x: 0.5, y: 0 },
              endPoint: { x: 0.5, y: 1 },
            }),
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
          ]}
        />
      )}

      {/* Content */}
      <VStack
        alignment="leading"
        spacing={contentSpacing}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' }),
          padding({ all: containerPadding }),
        ]}
      >
        {/* Header */}
        <HStack spacing={contentSpacing + 2} alignment="center">
          <Text
            modifiers={[
              font({ size: headerFontSize, weight: 'semibold' }),
              foregroundStyle('#FFFFFF')
            ]}
            lineLimit={1}
          >
            {props.locationName || 'Keine Daten'}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: iconFontSize })]}>
            {weatherIcon}
          </Text>
        </HStack>

        <Spacer />

        {/* Temperature (IST) */}
        <HStack spacing={2}>
          <Text modifiers={[font({ size: tempFontSize, weight: 'bold' }), foregroundStyle('#FFFFFF')]}>
            {props.temperatureActual?.toFixed(1) || '--'}
          </Text>
          <Text modifiers={[font({ size: unitFontSize, weight: 'medium' }), foregroundStyle('#FFFFFF')]}>
            °C
          </Text>
        </HStack>

        {/* Precipitation - hide on small widgets to save space */}
        {props.precipitation > 0 && !isSmall && (
          <HStack spacing={contentSpacing}>
            <Text modifiers={[font({ size: precipFontSize })]}>💧</Text>
            <Text modifiers={[font({ size: precipFontSize, weight: 'medium' }), foregroundStyle('#FFFFFF')]}>
              {props.precipitation.toFixed(1)} mm
            </Text>
          </HStack>
        )}

        <Spacer />

        {/* Timestamp and Build number - hide on very small widgets */}
        {!isSmall && (
          <HStack spacing={8}>
            {props.timestampActual && (
              <Text modifiers={[font({ size: buildFontSize }), foregroundStyle('#FFFFFF80')]}>
                📊 {formatTimestamp(props.timestampActual)}
              </Text>
            )}
            {props.refreshedAt && (
              <Text modifiers={[font({ size: buildFontSize }), foregroundStyle('#FFFFFF80')]}>
                🔄 {formatTimestamp(props.refreshedAt)}
              </Text>
            )}
            <Spacer />
            <Text modifiers={[font({ size: buildFontSize }), foregroundStyle('#FFFFFF80')]}>
              Build {props.buildNumber || 'dev'}
            </Text>
          </HStack>
        )}
      </VStack>
    </ZStack>
  );
};

// Export widget instance directly (required for expo-widgets compiler to find it)
export default createWidget('MeteoblickWidget', MeteoblickWidget);
