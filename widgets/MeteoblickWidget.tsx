'use client';
'use widget';

import { Column, Row, Spacer, Text } from '@expo/ui';
import type { WidgetEnvironment } from 'expo-widgets';

interface WeatherProps {
  locationName: string;
  temperature: number;
  symbolCode: number;
  precipitation: number;
  buildNumber: string;
}

export default function MeteoblickWidget(
  props: WeatherProps,
  environment: WidgetEnvironment
) {
  const weatherIcon = getWeatherSymbol(props.symbolCode);

  return (
    <Column
      padding={12}
      backgroundColor="linear-gradient(135deg, #6699FF 0%, #3366CC 100%)"
      height="100%"
      width="100%"
    >
      <Row justifyContent="space-between" alignItems="center">
        <Text fontSize={14} fontWeight="semibold" color="white">
          {props.locationName || 'Keine Daten'}
        </Text>
        <Text fontSize={24}>{weatherIcon}</Text>
      </Row>

      <Spacer />

      <Row alignItems="baseline">
        <Text fontSize={32} fontWeight="bold" color="white">
          {props.temperature?.toFixed(1) || '--'}
        </Text>
        <Text fontSize={16} fontWeight="medium" color="rgba(255,255,255,0.9)">
          °C
        </Text>
      </Row>

      {props.precipitation > 0 && (
        <Row gap={4} alignItems="center">
          <Text fontSize={12}>💧</Text>
          <Text fontSize={12} fontWeight="medium" color="rgba(255,255,255,0.9)">
            {props.precipitation.toFixed(1)} mm
          </Text>
        </Row>
      )}

      <Spacer />

      <Row justifyContent="flex-end">
        <Text fontSize={9} color="rgba(255,255,255,0.6)">
          Build {props.buildNumber || 'dev'}
        </Text>
      </Row>
    </Column>
  );
}

function getWeatherSymbol(code: number): string {
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
}
