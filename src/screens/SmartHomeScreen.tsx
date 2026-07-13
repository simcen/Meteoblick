/**
 * SmartHomeScreen — read-only view of the Loxone smart home sensor.
 *
 * Shows the current sensor temperature, sensor name, cloud SNR and last
 * update timestamp. The Loxone enable/disable toggle stays here for
 * quick on/off without opening the full configuration screen.
 *
 * Configuration UI lives in LoxoneConfigScreen (reached via Settings).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Typography, Spacing, Layout } from '../constants/designSystem';
import { useColors } from '../hooks/useColors';

export default function SmartHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useColors();
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: colors.background.grouped },
        scrollView: { flex: 1 },
        contentContainer: {
          padding: Spacing.screenHorizontal,
          paddingBottom: Spacing.lg,
        },
        title: { ...Typography.title2, color: colors.label.primary, marginBottom: Spacing.xs },
        subtitle: { ...Typography.subheadline, color: colors.label.secondary, marginBottom: Spacing.lg },
        card: {
          backgroundColor: colors.background.primary,
          borderRadius: Layout.radius.md,
          padding: Spacing.md,
          marginBottom: Spacing.md,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        },
        cardTitle: { ...Typography.headline, color: colors.label.primary, marginBottom: Spacing.md },
        temperature: {
          fontSize: 48,
          fontWeight: '700',
          color: colors.label.primary,
          marginBottom: Spacing.xs,
        },
        temperaturePlaceholder: {
          fontSize: 48,
          fontWeight: '300',
          color: colors.label.tertiary,
          marginBottom: Spacing.xs,
        },
        sensorName: { ...Typography.subheadline, color: colors.label.secondary, marginBottom: Spacing.md },
        timestamp: { ...Typography.footnote, color: colors.label.tertiary },
        editButton: { marginTop: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center' },
        editButtonText: { ...Typography.subheadline, color: colors.tint, fontWeight: '600' },
        emptyCard: {
          backgroundColor: colors.background.primary,
          borderRadius: Layout.radius.md,
          padding: Spacing.md,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        },
        emptyTitle: { ...Typography.headline, color: colors.label.primary, marginBottom: Spacing.sm },
        emptyBody: { ...Typography.subheadline, color: colors.label.secondary, marginBottom: Spacing.lg },
      }),
    [colors],
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
                testID="edit-config-button"
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
  // `styles` is captured from the module scope below — but Row is rendered
  // inside SmartHomeScreen which already established the theme. Re-import
  // from the same useMemo via closure by passing styles as a prop would be
  // awkward; instead Row reads from the local styles via a shared ref.
  // Simpler: define Row inline by re-reading from useColors + Typography/Spacing.
  const colors = useColors();
  const rowStyles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: Spacing.sm,
          borderBottomWidth: Layout.border.thin,
          borderBottomColor: colors.separator.opaque,
        },
        rowLabel: { ...Typography.subheadline, color: colors.label.secondary },
        rowValue: {
          ...Typography.body,
          fontWeight: '500',
          color: colors.label.primary,
          flex: 1,
          textAlign: 'right',
          marginLeft: Spacing.md,
        },
      }),
    [colors],
  );
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.rowLabel}>{label}</Text>
      <Text style={rowStyles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}