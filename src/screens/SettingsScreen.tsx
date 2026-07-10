/**
 * SettingsScreen — main settings index, presented as a modal.
 *
 * Three sections:
 * 1. Navigation items: Orte (POI search) and Smart Home (Loxone config)
 *    Each opens a dedicated sub-screen in the Settings stack.
 * 2. App Info (read-only): name, version, build, SDK
 */
import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { Colors, Spacing, Typography } from '../constants/designSystem';
import { BUILD_NUMBER } from '../constants';

// Expo SDK version — manual constant, Expo SDK is at 57
const EXPO_SDK_VERSION = '57';
const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

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
          style={styles.closeButton}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Einstellungen</Text>

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
          <Text style={styles.sectionTitle}>App Info</Text>
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
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  closeRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 18,
    color: Colors.label.primary,
    lineHeight: 20,
  },
  content: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.lg,
  },
  title: {
    ...Typography.title2,
    color: Colors.label.primary,
    marginBottom: Spacing.lg,
  },
  menuGroup: {
    backgroundColor: Colors.background.secondary,
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
    borderBottomColor: Colors.separator.nonOpaque,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemPressed: {
    backgroundColor: Colors.fill.tertiary,
  },
  menuIcon: {
    fontSize: 22,
    marginRight: Spacing.md,
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    ...Typography.body,
    color: Colors.label.primary,
    fontWeight: '500',
  },
  menuSubtitle: {
    ...Typography.caption1,
    color: Colors.label.secondary,
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 24,
    color: Colors.label.tertiary,
    marginLeft: Spacing.sm,
  },
  section: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.subheadline,
    color: Colors.label.secondary,
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator.nonOpaque,
  },
  rowLabel: {
    ...Typography.body,
    color: Colors.label.primary,
  },
  rowValue: {
    ...Typography.body,
    color: Colors.label.secondary,
    flex: 1,
    textAlign: 'right',
    marginLeft: Spacing.md,
  },
});