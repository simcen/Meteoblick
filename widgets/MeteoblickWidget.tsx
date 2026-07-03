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
  temperature: number;
  symbolCode: number;
  precipitation: number;
  buildNumber: string;
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
        spacing={4}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' }),
          padding({ all: 12 }),
        ]}
      >
        {/* Header */}
        <HStack spacing={6} alignment="center">
          <Text
            modifiers={[
              font({ size: 12, weight: 'semibold' }),
              foregroundStyle('#FFFFFF')
            ]}
            lineLimit={1}
          >
            {props.locationName || 'Keine Daten'}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 20 })]}>
            {weatherIcon}
          </Text>
        </HStack>

        <Spacer />

        {/* Temperature */}
        <HStack spacing={2}>
          <Text modifiers={[font({ size: 32, weight: 'bold' }), foregroundStyle('#FFFFFF')]}>
            {props.temperature?.toFixed(1) || '--'}
          </Text>
          <Text modifiers={[font({ size: 16, weight: 'medium' }), foregroundStyle('#FFFFFF')]}>
            °C
          </Text>
        </HStack>

        {/* Precipitation */}
        {props.precipitation > 0 && (
          <HStack spacing={4}>
            <Text modifiers={[font({ size: 12 })]}>💧</Text>
            <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle('#FFFFFF')]}>
              {props.precipitation.toFixed(1)} mm
            </Text>
          </HStack>
        )}

        <Spacer />

        {/* Build number */}
        <HStack>
          <Spacer />
          <Text modifiers={[font({ size: 9 }), foregroundStyle('#FFFFFF80')]}>
            Build {props.buildNumber || 'dev'}
          </Text>
        </HStack>
      </VStack>
    </ZStack>
  );
};

// Export widget instance directly (required for expo-widgets compiler to find it)
export default createWidget('MeteoblickWidget', MeteoblickWidget);
