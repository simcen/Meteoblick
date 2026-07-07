/**
 * SettingsScreen — placeholder for app-level configuration, presented as a
 * modal that slides up from the bottom and partially covers the app header.
 *
 * Currently shows static "App Info" (name, build, description). POI selection
 * and Loxone config will be moved here in a follow-up task.
 */
import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography } from '../constants/designSystem';
import { BUILD_NUMBER } from '../constants';

// Expo SDK version — manual constant, Expo SDK is at 57
const EXPO_SDK_VERSION = '57';
const APP_VERSION = '1.0.0';
const APP_DESCRIPTION = 'Wetter für deinen Standort – inklusive Smart-Home-Temperatur im Widget.';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

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
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.lg + Spacing.md },
        ]}
      >
        <Text style={styles.title}>Einstellungen</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <Row label="Name" value="Meteoblick" />
          <Row label="Version" value={APP_VERSION} />
          <Row label="Build" value={BUILD_NUMBER} />
          <Row label="Expo SDK" value={EXPO_SDK_VERSION} />
        </View>

        <Text style={styles.description}>{APP_DESCRIPTION}</Text>
      </ScrollView>
    </SafeAreaView>
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
    padding: Spacing.screenHorizontal,
    paddingBottom: Spacing.lg,
  },
  title: {
    ...Typography.title2,
    color: Colors.label.primary,
    marginBottom: Spacing.lg,
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
  description: {
    ...Typography.footnote,
    color: Colors.label.secondary,
    lineHeight: 20,
  },
});