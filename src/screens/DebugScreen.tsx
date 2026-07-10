import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { LoxoneAPI } from '../api/loxone';
import { updateWidget } from '../widgets/widgetManager';
import { Button } from '../components/Button';
import { BUILD_NUMBER, API_BASE_URL } from '../constants';
import { useScrollContext } from '../contexts/ScrollContext';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

export default function DebugScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { sharedScrollY } = useScrollContext();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      sharedScrollY.value = e.contentOffset.y;
    },
  });
  useFocusEffect(
    useCallback(() => {
      return () => {
        sharedScrollY.value = 0;
      };
    }, [sharedScrollY])
  );

  const [lastFetchInfo, setLastFetchInfo] = useState<any>(null);
  const [widgetSnapshotWrittenAt, setWidgetSnapshotWrittenAt] = useState<string | null>(null);
  const [widgetTimelineCalled, setWidgetTimelineCalled] = useState<string | null>(null);
  const [nextTimelineCall, setNextTimelineCall] = useState<string | null>(null);
  const [backendDebugInfo, setBackendDebugInfo] = useState<any>(null);
  const [nextAppFetch, setNextAppFetch] = useState<string | null>(null);
  const [bgFetchStatus, setBgFetchStatus] = useState<string>('unknown');
  const [nextBgFetch, setNextBgFetch] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loxoneConfig, setLoxoneConfig] = useState<any>(null);
  const [loxoneSensorData, setLoxoneSensorData] = useState<any>(null);

  useEffect(() => {
    loadDebugInfo();

    // Auto-refresh debug info every 10 seconds
    const interval = setInterval(() => {
      loadDebugInfo();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadDebugInfo = async () => {
    // Load app fetch info
    const info = await MeteoSwissAPI.getLastFetchInfo();
    setLastFetchInfo(info);

    // Load widget timing info
    const snapshotWrittenAt = await SharedStorage.getWidgetSnapshotWrittenAt();
    setWidgetSnapshotWrittenAt(snapshotWrittenAt);
    const timelineCalled = await SharedStorage.getWidgetTimelineCalled();
    setWidgetTimelineCalled(timelineCalled);
    if (timelineCalled) {
      const next = new Date(timelineCalled).getTime() + 15 * 60 * 1000;
      setNextTimelineCall(new Date(next).toISOString());
    }

    // Load Loxone info
    const config = await SharedStorage.getLoxoneConfig();
    setLoxoneConfig(config);
    const sensorData = await SharedStorage.getLoxoneSensorData();
    setLoxoneSensorData(sensorData);

    // Check background fetch status
    const status = await BackgroundFetch.getStatusAsync();
    const statusMap: Record<number, string> = {
      1: 'Available',
      2: 'Denied',
      3: 'Restricted',
    };
    setBgFetchStatus(status !== null ? statusMap[status] || 'Unknown' : 'Unknown');

    // Load backend debug info
    try {
      const response = await fetch(`${API_BASE_URL}/api/debug`);
      const data = await response.json();
      setBackendDebugInfo(data);
    } catch (error) {
      console.error('Failed to load backend debug info:', error);
    }

    // Calculate next app fetch (5 minutes from last fetch)
    if (info?.timestamp) {
      const lastFetchTime = new Date(info.timestamp).getTime();
      const nextFetchTime = lastFetchTime + 5 * 60 * 1000;
      setNextAppFetch(new Date(nextFetchTime).toISOString());
    }

    // Calculate next background fetch (15 minutes from last app fetch)
    if (info?.timestamp) {
      const now = Date.now();
      const calculated = new Date(info.timestamp).getTime() + 15 * 60 * 1000;
      setNextBgFetch(new Date(Math.max(calculated, now)).toISOString());
    }
  };

  const testBackgroundFetch = async () => {
    setTesting(true);
    console.log('[Debug] Testing background fetch manually...');

    const pointId = await SharedStorage.getPointId();
    if (!pointId) {
      Alert.alert('Fehler', 'Kein POI konfiguriert');
      setTesting(false);
      return;
    }

    // 1. MeteoSwiss — independent of Loxone, with cache fallback.
    let weather = await SharedStorage.getWeatherData();
    let meteoFresh = false;
    try {
      const fresh = await MeteoSwissAPI.fetchWeatherData(pointId);
      await SharedStorage.setWeatherData(fresh);
      weather = fresh;
      meteoFresh = true;
    } catch (error: any) {
      console.warn('[Debug] MeteoSwiss fetch failed:', error);
    }

    // 2. Loxone — independent of MeteoSwiss, with cache fallback.
    let loxoneTemp: number | undefined;
    let loxoneTimestamp: string | undefined;
    let loxoneFresh = false;

    const loxoneConfig = await SharedStorage.getLoxoneConfig();
    if (loxoneConfig?.enabled && loxoneConfig.temperatureSensorUUID) {
      try {
        const api = new LoxoneAPI(loxoneConfig);
        const temp = await api.getTemperature(loxoneConfig.temperatureSensorUUID);
        loxoneTemp = temp;
        loxoneTimestamp = new Date().toISOString();
        await SharedStorage.setLoxoneSensorData({
          temperature: temp,
          timestamp: loxoneTimestamp,
        });
        loxoneFresh = true;
      } catch (error: any) {
        console.warn('[Debug] Loxone fetch failed:', error);
        const cached = await SharedStorage.getLoxoneSensorData();
        if (cached) {
          loxoneTemp = cached.temperature;
          loxoneTimestamp = cached.timestamp;
        }
      }
    }

    // 3. Update widget — only if we have any weather data.
    if (weather) {
      try {
        await updateWidget({
          locationName: weather.locationName,
          temperatureActual: weather.temperatureActual,
          temperatureForecast: weather.temperatureForecast,
          temperatureLoxone: loxoneTemp,
          symbolCode: weather.symbolCode,
          precipitation: weather.precipitation,
          buildNumber: BUILD_NUMBER,
          timestampActual: weather.timestampActual,
          timestampForecast: weather.timestampForecast,
          timestampLoxone: loxoneTimestamp,
        });
      } catch (error: any) {
        Alert.alert('Fehler', `Widget-Update fehlgeschlagen: ${error.message}`);
        setTesting(false);
        return;
      }
    } else {
      Alert.alert('Fehler', 'Keine Wetterdaten verfügbar (weder frisch noch Cache).');
      setTesting(false);
      return;
    }

    // Compose result message
    const meteoStatus = meteoFresh ? 'frisch' : 'aus Cache';
    const loxoneStatus = loxoneFresh
      ? `frisch (${loxoneTemp?.toFixed(1)}°C)`
      : loxoneTemp !== undefined
        ? `aus Cache (${loxoneTemp.toFixed(1)}°C)`
        : 'deaktiviert';

    Alert.alert(
      'Widget aktualisiert',
      `MeteoSwiss: ${meteoStatus}\n` +
        `Temp IST: ${weather.temperatureActual}°C\n` +
        `Temp Prognose: ${weather.temperatureForecast}°C\n` +
        `Ort: ${weather.locationName}\n\n` +
        `Loxone: ${loxoneStatus}`,
    );
    await loadDebugInfo();
    setTesting(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDebugInfo();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={[styles.closeRow, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Schliessen"
          style={styles.closeButton}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
      <Animated.ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={[styles.container, { paddingTop: 16 }]}>
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>🔍 Debug Info</Text>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>App Build:</Text>
              <Text style={styles.debugValue}>{BUILD_NUMBER}</Text>
            </View>

            <Text style={styles.debugSectionTitle}>📱 App Fetch (Foreground)</Text>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Letzter Fetch:</Text>
              <Text style={styles.debugValue}>
                {lastFetchInfo?.timestamp ? new Date(lastFetchInfo.timestamp).toLocaleString('de-CH') : 'n/a'}
              </Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Nächster Fetch:</Text>
              <Text style={styles.debugValue}>
                {nextAppFetch ? new Date(nextAppFetch).toLocaleString('de-CH') : 'n/a'}
              </Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Intervall:</Text>
              <Text style={styles.debugValue}>5 min</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Response Zeit:</Text>
              <Text style={styles.debugValue}>{lastFetchInfo?.responseTime ? `${lastFetchInfo.responseTime}ms` : 'n/a'}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>POI ID:</Text>
              <Text style={styles.debugValue}>{lastFetchInfo?.pointId || 'n/a'}</Text>
            </View>

            <Text style={styles.debugSectionTitle}>📊 Widget</Text>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Daten geschrieben:</Text>
              <Text style={styles.debugValue}>
                {widgetSnapshotWrittenAt ? new Date(widgetSnapshotWrittenAt).toLocaleString('de-CH') : 'n/a'}
              </Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Widget gerendert:</Text>
              <Text style={styles.debugValue}>
                {widgetTimelineCalled ? new Date(widgetTimelineCalled).toLocaleString('de-CH') : 'n/a'}
              </Text>
            </View>
            <View style={styles.debugRow}>
              <View style={styles.labelWithIcon}>
                <Text style={styles.debugLabel}>getTimeline() nächstes:</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert(
                    'Widget Timeline',
                    'Das Widget fordert alle 15 Minuten einen Refresh an. iOS entscheidet den genauen Zeitpunkt selbst — basierend auf App-Nutzung, Batteriestand und anderen System-Bedingungen.'
                  )}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.infoIcon}>ℹ️</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.debugValue}>
                {nextTimelineCall ? new Date(nextTimelineCall).toLocaleString('de-CH') : 'n/a'}
              </Text>
            </View>

            <Text style={styles.debugSectionTitle}>🏠 Loxone</Text>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Aktiviert:</Text>
              <Text style={styles.debugValue}>{loxoneConfig?.enabled ? '✅ Ja' : '❌ Nein'}</Text>
            </View>
            {loxoneConfig && (
              <>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>Cloud SNR:</Text>
                  <Text style={styles.debugValue}>{loxoneConfig.cloudAddress}</Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>Username:</Text>
                  <Text style={styles.debugValue}>{loxoneConfig.username}</Text>
                </View>
                {loxoneConfig.localIP && (
                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>Lokale IP:</Text>
                    <Text style={styles.debugValue}>{loxoneConfig.localIP}</Text>
                  </View>
                )}
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>Sensor UUID:</Text>
                  <Text style={[styles.debugValue, styles.uuidText]} numberOfLines={1}>
                    {loxoneConfig.temperatureSensorUUID || 'n/a'}
                  </Text>
                </View>
              </>
            )}
            {loxoneSensorData ? (
              <>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>Letzte Temperatur:</Text>
                  <Text style={styles.debugValue}>{loxoneSensorData.temperature.toFixed(1)}°C</Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>Sensor Update:</Text>
                  <Text style={styles.debugValue}>
                    {new Date(loxoneSensorData.timestamp).toLocaleString('de-CH')}
                  </Text>
                </View>
              </>
            ) : loxoneConfig?.enabled ? (
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Sensor Daten:</Text>
                <Text style={styles.debugValue}>Noch keine Daten</Text>
              </View>
            ) : null}

            <Text style={styles.debugSectionTitle}>🔄 Background Fetch</Text>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Status:</Text>
              <Text style={styles.debugValue}>{bgFetchStatus}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Intervall:</Text>
              <Text style={styles.debugValue}>15 min (iOS Minimum)</Text>
            </View>
            <View style={styles.debugRow}>
              <View style={styles.labelWithIcon}>
                <Text style={styles.debugLabel}>Nächster Run:</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert(
                    'Background Fetch Timing',
                    'iOS kontrolliert den genauen Zeitpunkt des Background Fetch basierend auf App-Nutzung, Batteriestand und anderen System-Bedingungen. Die angezeigte Zeit ist die früheste mögliche Ausführung.'
                  )}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.infoIcon}>ℹ️</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.debugValue}>
                {nextBgFetch ? new Date(nextBgFetch).toLocaleString('de-CH') : 'n/a'}
              </Text>
            </View>
            <View style={styles.debugButton}>
              <Button
                title="Background Fetch testen"
                onPress={testBackgroundFetch}
                loading={testing}
                variant="secondary"
              />
            </View>

            <Text style={styles.debugSectionTitle}>🖥️ Backend</Text>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Letzter Sync:</Text>
              <Text style={styles.debugValue}>
                {backendDebugInfo?.backend?.lastSync ? new Date(backendDebugInfo.backend.lastSync).toLocaleString('de-CH') : 'n/a'}
              </Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Nächster Sync:</Text>
              <Text style={styles.debugValue}>
                {backendDebugInfo?.backend?.nextSync ? new Date(backendDebugInfo.backend.nextSync).toLocaleString('de-CH') : 'n/a'}
              </Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Sync Intervall:</Text>
              <Text style={styles.debugValue}>
                {backendDebugInfo?.backend?.syncIntervalMinutes ? `${backendDebugInfo.backend.syncIntervalMinutes} min` : 'n/a'}
              </Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  closeRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 18,
    color: '#333',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  debugContainer: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  debugSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#555',
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  debugLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  debugValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  uuidText: {
    fontSize: 10,
    fontFamily: 'Courier',
  },
  debugButton: {
    marginTop: 16,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  infoIcon: {
    fontSize: 14,
    opacity: 0.6,
  },
});
