/**
 * SensorVisibilityScreen — detail screen for a single sensor's
 * visibility setting (App / Widget / Beide).
 *
 * Reached by tapping a sensor row in LoxoneConfigScreen. Renders the
 * sensor name as header + 3-state SegmentedControl for showInApp /
 * showInWidget. Live-updates on tap. Also exposes a delete button
 * (parity with swipe-to-delete on the parent screen).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { Button } from '../components/Button';
import { LiquidGlassCloseButton } from '../components/LiquidGlassCloseButton';
import { Shadows, Spacing, Typography, Layout } from '../constants/designSystem';
import { useColors } from '../hooks/useColors';

type Target = 'app' | 'widget' | 'beide';

const targetToState: Record<Target, { showInApp: boolean; showInWidget: boolean }> = {
  app: { showInApp: true, showInWidget: false },
  widget: { showInApp: false, showInWidget: true },
  beide: { showInApp: true, showInWidget: true },
};

const stateToTarget = (showInApp: boolean, showInWidget: boolean): Target => {
  if (showInApp && showInWidget) return 'beide';
  if (showInApp) return 'app';
  if (showInWidget) return 'widget';
  return 'beide'; // legacy (false, false) → default to "beide"
};

const TARGETS: { value: Target; label: string }[] = [
  { value: 'app', label: 'App' },
  { value: 'widget', label: 'Widget' },
  { value: 'beide', label: 'Beide' },
];

export default function SensorVisibilityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useColors();
  const route = useRoute<RouteProp<{ SensorVisibility: { uuid: string } }, 'SensorVisibility'>>();
  const uuid = route.params?.uuid;

  const [sensorName, setSensorName] = useState<string | null>(null);
  const [target, setTarget] = useState<Target>('beide');
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load the sensor once on mount
  useEffect(() => {
    if (!uuid) return;
    let cancelled = false;
    (async () => {
      const config = await SharedStorage.getLoxoneConfig();
      if (cancelled || !config) return;
      const sensor = config.sensors.find((s) => s.uuid === uuid);
      if (sensor) {
        setSensorName(sensor.name);
        setTarget(stateToTarget(sensor.showInApp, sensor.showInWidget));
      }
      setHasLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [uuid]);

  const onChange = useCallback(
    async (next: Target) => {
      setTarget(next);
      if (!uuid) return;
      const { showInApp, showInWidget } = targetToState[next];
      try {
        await SharedStorage.updateSensor(uuid, { showInApp, showInWidget });
      } catch (error) {
        console.warn('[SensorVisibility] updateSensor failed:', error);
      }
    },
    [uuid],
  );

  const onRename = useCallback(() => {
    if (!uuid) return;
    Alert.prompt(
      'Sensor umbenennen',
      undefined,
      async (text) => {
        const next = text?.trim();
        if (!next || next === sensorName) return;
        try {
          await SharedStorage.updateSensor(uuid, { name: next });
          setSensorName(next);
        } catch (error) {
          console.warn('[SensorVisibility] rename failed:', error);
        }
      },
      'plain-text',
      sensorName ?? undefined,
    );
  }, [uuid, sensorName]);

  const labelValueText = (t: Target) =>
    t === 'beide' ? 'App + Widget' : t === 'app' ? 'App' : 'Widget';

  const onDelete = useCallback(() => {
    if (!uuid) return;
    Alert.alert(
      'Sensor löschen?',
      `${sensorName ?? 'Sensor'} wirklich aus der Konfiguration entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            await SharedStorage.removeSensor(uuid);
            (navigation as any).goBack();
          },
        },
      ],
    );
  }, [uuid, sensorName, navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: colors.background.grouped },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + Spacing.sm,
          paddingBottom: 0,
          paddingHorizontal: Spacing.md,
        },
        headerSpacer: { width: 92 },
        headerTitle: {
          flex: 1,
          textAlign: 'center',
          ...Typography.title2,
          lineHeight: 36,
          color: colors.label.primary,
        },
        contentContainer: {
          paddingHorizontal: Spacing.screenHorizontal,
          paddingTop: Spacing.md,
          paddingBottom: Spacing.lg,
        },
        card: {
          backgroundColor: colors.background.groupedSecondary,
          borderRadius: Layout.radius.lg,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.lg,
        },
        bezeichnungRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: Spacing.sm,
        },
        bezeichnungLabel: {
          ...Typography.body,
          color: colors.label.secondary,
          width: 120,
        },
        bezeichnungValue: {
          ...Typography.body,
          color: colors.label.primary,
          flex: 1,
          textAlign: 'right',
        },
        sichtbarkeitLabel: {
          ...Typography.caption2,
          color: colors.label.secondary,
          marginBottom: Spacing.sm,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.separator.nonOpaque,
          marginVertical: Spacing.sm,
        },
        segmentedRow: {
          flexDirection: 'row',
          borderRadius: 9,
          padding: 2,
          backgroundColor: colors.fill.primary,
        },
        segment: {
          flex: 1,
          paddingVertical: 7,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
        },
        segmentLabel: {
          ...Typography.caption1,
          color: colors.label.secondary,
          fontWeight: '500',
        },
        segmentLabelActive: {
          color: colors.label.primary,
          fontWeight: '600',
        },
        deleteAction: { marginTop: Spacing.lg },
      }),
    [colors, insets.top],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          Konfiguration
        </Text>
        <LiquidGlassCloseButton
          onPress={() => (navigation as any).goBack()}
          label="Fertig"
        />
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <TouchableOpacity
            onLongPress={onRename}
            delayLongPress={400}
            style={styles.bezeichnungRow}
            accessibilityRole="button"
            accessibilityLabel={`${sensorName ?? 'Sensor'} umbenennen, lange drücken`}
            accessibilityHint="Lange drücken zum Umbenennen"
          >
            <Text style={styles.bezeichnungLabel}>Bezeichnung</Text>
            <Text style={styles.bezeichnungValue} numberOfLines={1}>
              {sensorName ?? 'Sensor'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sichtbarkeitLabel}>Sichtbarkeit</Text>
          <View style={styles.segmentedRow}>
            {TARGETS.map((opt) => {
              const active = target === opt.value;
              return (
                <View
                  key={opt.value}
                  style={[
                    styles.segment,
                    active && {
                      backgroundColor: colors.background.primary,
                      ...Shadows.sm,
                    },
                  ]}
                  onTouchEnd={!hasLoaded ? undefined : () => onChange(opt.value)}
                >
                  <Text
                    style={[
                      styles.segmentLabel,
                      active && styles.segmentLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.deleteAction}>
          <Button
            title="Sensor löschen"
            onPress={onDelete}
            variant="secondary"
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
