/**
 * SmartHomeScreen — read-only view of the Loxone smart home sensor.
 *
 * Shows the current sensor temperature, sensor name, cloud SNR and last
 * update timestamp. The Loxone enable/disable toggle stays here for
 * quick on/off without opening the full configuration screen.
 *
 * Configuration UI lives in LoxoneConfigScreen (reached via Settings).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { useWeather } from '../providers/WeatherContext';
import { useScrollContext } from '../contexts/ScrollContext';
import { Button } from '../components/Button';
import { Colors, Typography, Spacing, Layout, ComponentStyles } from '../constants/designSystem';

export default function SmartHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loxoneTemp, loxoneTimestamp, isFetching: refreshing, refresh } = useWeather();
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

  const [enabled, setEnabled] = useState(false);
  const [cloudAddress, setCloudAddress] = useState<string | null>(null);
  const [sensorName, setSensorName] = useState<string | null>(null);
  const [hasConfig, setHasConfig] = useState(false);

  // Reload config on every focus so the sensor name + enabled state stay in sync
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const config = await SharedStorage.getLoxoneConfig();
        if (cancelled || !config) return;
        setEnabled(config.enabled);
        setCloudAddress(config.cloudAddress);
        setSensorName(config.temperatureSensorName ?? null);
        setHasConfig(true);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    // initial load
    (async () => {
      const config = await SharedStorage.getLoxoneConfig();
      if (!config) return;
      setEnabled(config.enabled);
      setCloudAddress(config.cloudAddress);
      setSensorName(config.temperatureSensorName ?? null);
      setHasConfig(true);
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + Layout.height.appHeader + Spacing.md },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Text style={styles.title}>Smart Home</Text>
        <Text style={styles.subtitle}>
          Aktuelle Loxone-Sensordaten für das Widget.
        </Text>

        {!hasConfig ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Loxone ist nicht konfiguriert</Text>
            <Text style={styles.emptyBody}>
              Lege Cloud-Adresse, Zugangsdaten und einen Temperatursensor fest,
              um die Aussentemperatur im Widget anzuzeigen.
            </Text>
            <Button
              title="Loxone konfigurieren"
              onPress={() => (navigation.getParent() as any)?.navigate('Loxone')}
              fullWidth
            />
          </View>
        ) : (
          <>
            {/* Current reading */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Aktueller Wert</Text>
              {loxoneTemp !== null ? (
                <Text style={styles.temperature}>
                  🌡️ {loxoneTemp.toFixed(1)}°C
                </Text>
              ) : (
                <Text style={styles.temperaturePlaceholder}>— °C</Text>
              )}
              {sensorName && (
                <Text style={styles.sensorName}>{sensorName}</Text>
              )}
              {loxoneTimestamp && (
                <Text style={styles.timestamp}>
                  Aktualisiert: {new Date(loxoneTimestamp).toLocaleString('de-CH')}
                </Text>
              )}
            </View>

            {/* Connection details */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Verbindung</Text>
              <Row label="Cloud SNR" value={cloudAddress ?? '—'} />
              <Row label="Status" value={enabled ? 'Aktiviert' : 'Deaktiviert'} />
              <TouchableOpacity
                onPress={() => (navigation.getParent() as any)?.navigate('Loxone')}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>Konfiguration bearbeiten</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.screenHorizontal,
    paddingBottom: Spacing.lg,
  },
  title: {
    ...Typography.title2,
    color: Colors.label.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.subheadline,
    color: Colors.label.secondary,
    marginBottom: Spacing.lg,
  },
  toggleCard: {
    ...ComponentStyles.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  toggleLabel: {
    flex: 1,
    marginRight: Spacing.md,
  },
  card: {
    ...ComponentStyles.card,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.headline,
    color: Colors.label.primary,
    marginBottom: Spacing.md,
  },
  temperature: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.label.primary,
    marginBottom: Spacing.xs,
  },
  temperaturePlaceholder: {
    fontSize: 48,
    fontWeight: '300',
    color: Colors.label.tertiary,
    marginBottom: Spacing.xs,
  },
  sensorName: {
    ...Typography.subheadline,
    color: Colors.label.secondary,
    marginBottom: Spacing.md,
  },
  timestamp: {
    ...Typography.footnote,
    color: Colors.label.tertiary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: Layout.border.thin,
    borderBottomColor: Colors.separator.opaque,
  },
  rowLabel: {
    ...Typography.subheadline,
    color: Colors.label.secondary,
  },
  rowValue: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.label.primary,
    flex: 1,
    textAlign: 'right',
    marginLeft: Spacing.md,
  },
  editButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  editButtonText: {
    ...Typography.subheadline,
    color: Colors.tint,
    fontWeight: '600',
  },
  emptyCard: {
    ...ComponentStyles.card,
  },
  emptyTitle: {
    ...Typography.headline,
    color: Colors.label.primary,
    marginBottom: Spacing.sm,
  },
  emptyBody: {
    ...Typography.subheadline,
    color: Colors.label.secondary,
    marginBottom: Spacing.lg,
  },
});