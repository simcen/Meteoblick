/**
 * SettingsScreen — main settings index, presented as a modal.
 *
 * Sections:
 * 1. Allgemein (new): theme preference toggle (Erscheinungsbild)
 * 2. Navigation items: Orte (POI search) and Smart Home (Loxone config)
 *    Each opens a dedicated sub-screen in the Settings stack.
 * 3. App Info (read-only): name, version, build, SDK
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { useColors } from '../hooks/useColors';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemePreference } from '../storage/SharedStorage';
import { Spacing, Typography, Shadows } from '../constants/designSystem';
import { BUILD_NUMBER } from '../constants';

// Expo SDK version — manual constant, Expo SDK is at 57
const EXPO_SDK_VERSION = '57';
const APP_VERSION = '1.0.0';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Automatisch' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useColors();
  const { preference, setPreference } = useTheme();

  const [locationName, setLocationName] = useState<string | null>(null);
  const [loxoneStatus, setLoxoneStatus] = useState<'configured' | 'enabled' | 'disabled' | 'none'>('none');

  // Reload summaries every time Settings opens
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const poiId = await SharedStorage.getPointId();
        if (!cancelled) setLocationName(poiId);

        const loxone = await SharedStorage.getLoxoneConfig();
        if (!cancelled) {
          if (!loxone) setLoxoneStatus('none');
          else if (loxone.enabled) setLoxoneStatus('enabled');
          else setLoxoneStatus('disabled');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Initial load (covers the case where Settings opens for the first time)
  useEffect(() => {
    (async () => {
      setLocationName(await SharedStorage.getPointId());
      const loxone = await SharedStorage.getLoxoneConfig();
      if (!loxone) setLoxoneStatus('none');
      else if (loxone.enabled) setLoxoneStatus('enabled');
      else setLoxoneStatus('disabled');
    })();
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: colors.background.primary },
        closeRow: {
          flexDirection: 'row',
          paddingHorizontal: Spacing.sm,
          paddingBottom: Spacing.sm,
        },
        closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
        closeIcon: { fontSize: 18, color: colors.label.primary, lineHeight: 20 },
        content: {
          paddingHorizontal: Spacing.screenHorizontal,
          paddingBottom: Spacing.lg,
        },
        title: { ...Typography.title2, color: colors.label.primary, marginBottom: Spacing.lg },
        section: {
          backgroundColor: colors.background.secondary,
          borderRadius: 12,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          marginBottom: Spacing.lg,
        },
        sectionHeader: {
          ...Typography.footnote,
          color: colors.label.secondary,
          paddingVertical: Spacing.sm,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        menuGroup: {
          backgroundColor: colors.background.secondary,
          borderRadius: 12,
          marginBottom: Spacing.lg,
          overflow: 'hidden',
        },
        menuItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator.nonOpaque,
        },
        menuItemLast: { borderBottomWidth: 0 },
        menuItemPressed: { backgroundColor: colors.fill.tertiary },
        menuIcon: { fontSize: 22, marginRight: Spacing.md },
        menuText: { flex: 1 },
        menuTitle: { ...Typography.body, color: colors.label.primary, fontWeight: '500' },
        menuSubtitle: { ...Typography.caption1, color: colors.label.secondary, marginTop: 2 },
        menuChevron: { fontSize: 24, color: colors.label.tertiary, marginLeft: Spacing.sm },
        themeRow: {
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator.nonOpaque,
        },
        themeRowLast: { borderBottomWidth: 0 },
        themeLabel: {
          ...Typography.body,
          color: colors.label.primary,
          fontWeight: '500',
          marginBottom: Spacing.sm,
        },
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: Spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator.nonOpaque,
        },
        rowLabel: { ...Typography.body, color: colors.label.primary },
        rowValue: {
          ...Typography.body,
          color: colors.label.secondary,
          flex: 1,
          textAlign: 'right',
          marginLeft: Spacing.md,
        },
      }),
    [colors],
  );

  const locationSubtitle = locationName ?? 'Nicht konfiguriert';
  const loxoneSubtitle =
    loxoneStatus === 'enabled'
      ? 'Aktiviert'
      : loxoneStatus === 'disabled'
        ? 'Deaktiviert'
        : 'Nicht konfiguriert';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* Close button — left-aligned, sits below the status bar. */}
      <View style={[styles.closeRow, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Schliessen"
          testID="modal-close-button"
          style={styles.closeButton}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Einstellungen</Text>

        {/* Allgemein (theme + future general settings) */}
        <View style={styles.menuGroup}>
          <Text style={[styles.sectionHeader, { paddingHorizontal: Spacing.md, marginTop: Spacing.sm }]}>
            Allgemein
          </Text>
          <View style={styles.themeRow}>
            <Text style={styles.themeLabel}>Erscheinungsbild</Text>
            <SegmentedControl
              options={THEME_OPTIONS}
              value={preference}
              onChange={setPreference}
            />
          </View>
        </View>

        {/* Navigation items */}
        <View style={styles.menuGroup}>
          <MenuItem
            icon="📍"
            title="Orte"
            subtitle={locationSubtitle}
            onPress={() => navigation.navigate('Orte' as never)}
          />
          <MenuItem
            icon="🏠"
            title="Smart Home"
            subtitle={loxoneSubtitle}
            onPress={() => navigation.navigate('Loxone' as never)}
            isLast
          />
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>App Info</Text>
          <Row label="Name" value="Meteoblick" />
          <Row label="Version" value={APP_VERSION} />
          <Row label="Build" value={BUILD_NUMBER} />
          <Row label="Expo SDK" value={EXPO_SDK_VERSION} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
  isLast,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const styles = useSettingsScreenStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        isLast && styles.menuItemLast,
        pressed && styles.menuItemPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title} öffnen`}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.menuChevron}>›</Text>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useSettingsScreenStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * SegmentedControl — iOS-style inline toggle, kept private to this screen.
 * Single-use today; if reused elsewhere, promote to src/components/.
 *
 * Visual: 3 segments in a rounded-rect container. Active segment has the
 * theme background primary fill + a subtle shadow for the iOS "lift" effect.
 */
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        segStyles.container,
        { backgroundColor: colors.fill.primary },
      ]}
      accessibilityRole="radiogroup"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={[
              segStyles.segment,
              active && [
                segStyles.segmentActive,
                { backgroundColor: colors.background.primary, ...Shadows.sm },
              ],
            ]}
          >
            <Text
              style={[
                segStyles.segmentLabel,
                {
                  color: active ? colors.label.primary : colors.label.secondary,
                  fontWeight: active ? '600' : '500',
                },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * useSettingsScreenStyles — shared theme-aware style bundle for MenuItem
 * and Row. Both sub-components render in the parent's tree so they inherit
 * the ThemeProvider; calling this hook at the top of each render keeps
 * hook order consistent (the previous wrapper function used
 * `useMemo(() => …, [])`, which skipped hook execution on re-renders and
 * tripped React's "Rendered fewer hooks" check).
 */
function useSettingsScreenStyles() {
  const colors = useColors();
  return useMemo(
    () =>
      StyleSheet.create({
        menuItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator.nonOpaque,
        },
        menuItemLast: { borderBottomWidth: 0 },
        menuItemPressed: { backgroundColor: colors.fill.tertiary },
        menuIcon: { fontSize: 22, marginRight: Spacing.md },
        menuText: { flex: 1 },
        menuTitle: { ...Typography.body, color: colors.label.primary, fontWeight: '500' },
        menuSubtitle: { ...Typography.caption1, color: colors.label.secondary, marginTop: 2 },
        menuChevron: { fontSize: 24, color: colors.label.tertiary, marginLeft: Spacing.sm },
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: Spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator.nonOpaque,
        },
        rowLabel: { ...Typography.body, color: colors.label.primary },
        rowValue: {
          ...Typography.body,
          color: colors.label.secondary,
          flex: 1,
          textAlign: 'right',
          marginLeft: Spacing.md,
        },
      }),
    [colors],
  );
}

const segStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 9,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  segmentActive: {},
  segmentLabel: {
    ...Typography.subheadline,
    textAlign: 'center',
  },
});