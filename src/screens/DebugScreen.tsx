import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { updateWidget } from '../widgets/widgetManager';
import { Button } from '../components/Button';
import { BUILD_NUMBER, API_BASE_URL } from '../constants';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

export default function DebugScreen() {
  const [lastFetchInfo, setLastFetchInfo] = useState<any>(null);
  const [widgetLastRefresh, setWidgetLastRefresh] = useState<string | null>(null);
  const [backendDebugInfo, setBackendDebugInfo] = useState<any>(null);
  const [nextAppFetch, setNextAppFetch] = useState<string | null>(null);
  const [bgFetchStatus, setBgFetchStatus] = useState<string>('unknown');
  const [testing, setTesting] = useState(false);

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

    // Load widget refresh info
    const timestamp = await SharedStorage.getWidgetLastRefresh();
    setWidgetLastRefresh(timestamp);

    // Check background fetch status
    const status = await BackgroundFetch.getStatusAsync();
    const statusMap: Record<number, string> = {
      1: 'Available',
      2: 'Denied',
      3: 'Restricted',
    };
    setBgFetchStatus(statusMap[status] || 'Unknown');

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
  };

  const testBackgroundFetch = async () => {
    setTesting(true);
    try {
      console.log('[Debug] Testing background fetch manually...');

      const pointId = await SharedStorage.getPointId();
      if (!pointId) {
        Alert.alert('Fehler', 'Kein POI konfiguriert');
        return;
      }

      const weather = await MeteoSwissAPI.fetchWeatherData(pointId);
      await SharedStorage.setWeatherData(weather);

      await updateWidget({
        locationName: weather.locationName,
        temperature: weather.temperature,
        symbolCode: weather.symbolCode,
        precipitation: weather.precipitation,
        buildNumber: BUILD_NUMBER,
        timestamp: weather.timestamp,
      });

      Alert.alert('Erfolg', `Widget aktualisiert!\n\nTemp: ${weather.temperature}°C\nOrt: ${weather.locationName}`);
      await loadDebugInfo();
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>
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
              <Text style={styles.debugLabel}>Letztes Refresh:</Text>
              <Text style={styles.debugValue}>
                {widgetLastRefresh ? new Date(widgetLastRefresh).toLocaleString('de-CH') : 'n/a'}
              </Text>
            </View>

            <Text style={styles.debugSectionTitle}>🔄 Background Fetch</Text>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Status:</Text>
              <Text style={styles.debugValue}>{bgFetchStatus}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Intervall:</Text>
              <Text style={styles.debugValue}>15 min (iOS Minimum)</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
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
  debugButton: {
    marginTop: 16,
  },
});
