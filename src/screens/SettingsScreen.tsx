/**
 * SettingsScreen — main settings index, presented as a modal.
 *
 * Sections:
 * 1. Allgemein (new): theme preference toggle (Erscheinungsbild)
 * 2. Navigation items: Orte (POI search) and Smart Home (Loxone config)
 *    Each opens a dedicated sub-screen in the Settings stack.
 * 3. App Info (read-only): name, version, build, SDK
 *
 * Header layout (iOS 26 navigation-bar style):
 *   [Status bar / safe area]
 *   ┌─────────────────────────────────────────┐
 *   │              Einstellungen  [Schliessen] │  ← title centered, close right,
 *   └─────────────────────────────────────────┘    vertically aligned, tight
 *                                                    against the card below
 *   ┌─ ALLGEMEIN ──────────────────────────┐
 *   │ ...                                  │
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { useColors } from '../hooks/useColors';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemePreference } from '../storage/SharedStorage';
import { Spacing, Typography, Shadows, Layout } from '../constants/designSystem';
import { LiquidGlassCloseButton } from '../components/LiquidGlassCloseButton';
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
        safeArea: { flex: 1, backgroundColor: colors.background.grouped },
        // Navigation-bar-style header. lineHeight: 36 on the title matches
        // the LiquidGlassCloseButton's 36pt box height so both glyphs sit on
        // the same horizontal line. Spacer matches the new button width.
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + Spacing.sm,
          // paddingBottom: 0 — title row sits flush against the first card.
          paddingBottom: 0,
          paddingHorizontal: Spacing.md,
        },
        headerSpacer: { width: 76 }, // matches LiquidGlassCloseButton minWidth (76pt)
        headerTitle: {
          flex: 1,
          textAlign: 'center',
          ...Typography.title2,
          lineHeight: 36, // match button box height for vertical alignment
          color: colors.label.primary,
        },
        content: {
          paddingHorizontal: Spacing.screenHorizontal,
          // paddingTop matches Debug screen's inline spacing between headerRow
          // and the first card content.
          paddingTop: Spacing.md,
          paddingBottom: Spacing.lg,
        },
        section: {
          backgroundColor: colors.background.groupedSecondary,
          borderRadius: Layout.radius.lg,
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
          backgroundColor: colors.background.groupedSecondary,
          borderRadius: Layout.radius.lg,
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
    [colors, insets.top],
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
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Einstellungen</Text>
        <LiquidGlassCloseButton onPress={() => navigation.goBack()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
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

/**
 * LiquidGlassCloseButton — extracted to src/components/. The inline copy
 * previously here was promoted so Debug (and future modals) can reuse it.
 */

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
 * useSettingsScreenStyles — shared theme-aware style bundle for MenuItem
 * and Row. Both sub-components render in the parent's tree so they inherit
 * the ThemeProvider; calling this hook at the top of each render keeps
 * hook order consistent.
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

const segStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Layout.radius.lg, // 16pt — matches menuGroup + LiquidGlass button
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    // Layout.radius.md (12pt) leaves a 2pt corner margin inside the 16pt
    // container — matches iOS segmented control proportions.
    borderRadius: Layout.radius.md,
  },
  segmentActive: {},
  segmentLabel: {
    ...Typography.subheadline,
    textAlign: 'center',
  },
});