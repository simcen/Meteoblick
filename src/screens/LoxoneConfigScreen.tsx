/**
 * LoxoneConfigScreen — full Loxone configuration UI.
 *
 * Reached from Settings > Smart Home. Owns:
 * - Connection credentials (cloud SNR, username, password)
 * - Sensor list: ordered, per-sensor flags (in-app / in-widget), rename, delete
 * - Master enable/disable toggle
 *
 * Phase 2.1: multi-sensor rows with reorder + flags + delete (no add/rename yet —
 * those land in Phase 2.2 / 2.3).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { LoxoneAPI } from '../api/loxone';
import { useWeather } from '../providers/WeatherContext';
import { Button } from '../components/Button';
import { LiquidGlassCloseButton } from '../components/LiquidGlassCloseButton';
import { Typography, Spacing, Layout, Shadows } from '../constants/designSystem';
import { useColors } from '../hooks/useColors';

type Sensor = {
  uuid: string;
  name: string;
  showInApp: boolean;
  showInWidget: boolean;
  order: number;
};

export default function LoxoneConfigScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useColors();
  const { refresh: refreshWeather } = useWeather();

  const [enabled, setEnabled] = useState(false);
  const [cloudAddress, setCloudAddress] = useState('504F94A1874F');
  const [sensors, setSensors] = useState<Sensor[]>([]);
  // Connection edit lives in LoxoneConnectionScreen (separate modal).
  // Here we just show a summary card with the SNR + chevron to navigate.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

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
        headerSpacer: { width: 92 }, // matches LiquidGlassCloseButton minWidth
        headerTitle: {
          flex: 1,
          textAlign: 'center',
          ...Typography.title2,
          lineHeight: 36, // match button box height
          color: colors.label.primary,
        },
        scrollView: { flex: 1 },
        contentContainer: {
          paddingHorizontal: Spacing.screenHorizontal,
          paddingTop: Spacing.md, // matches Debug screen's spacing
          paddingBottom: Spacing.lg,
        },
        title: { ...Typography.title2, color: colors.label.primary, marginBottom: Spacing.xs },
        subtitle: { ...Typography.subheadline, color: colors.label.secondary, marginBottom: Spacing.lg },
        section: {
          backgroundColor: colors.background.groupedSecondary,
          borderRadius: Layout.radius.lg,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          marginBottom: Spacing.lg,
        },
        sectionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: Spacing.sm,
        },
        sectionTitle: { ...Typography.headline, color: colors.label.primary, marginBottom: Spacing.md },
        toggleRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: Spacing.sm,
        },
        toggleLabel: { flex: 1, marginRight: Spacing.md },
        label: { ...Typography.body, color: colors.label.primary, marginBottom: Spacing.xs },
        hint: { ...Typography.caption1, color: colors.label.secondary },
        inputLabel: {
          ...Typography.subheadline,
          color: colors.label.primary,
          marginBottom: Spacing.xs,
          marginTop: Spacing.md,
        },
        input: {
          ...Typography.body,
          backgroundColor: colors.fill.tertiary,
          borderRadius: Layout.radius.md,
          borderWidth: Layout.border.normal,
          borderColor: colors.separator.opaque,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          marginBottom: Spacing.md,
          color: colors.label.primary,
        },
        // ─── Sensor rows (Phase 2.1) — iOS-Settings detail-row layout ──
        sensorRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator.nonOpaque,
          backgroundColor: colors.background.groupedSecondary,
        },
        sensorRowLast: { borderBottomWidth: 0 },
        sensorDragHandle: {
          width: 32,
          height: 28,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: Spacing.xs,
        },
        sensorDragHandleIcon: {
          fontSize: 18,
          color: colors.label.tertiary,
          letterSpacing: -3, // tighten the three dots into stripes
          fontWeight: '700',
        },
        sensorNameInline: {
          ...Typography.body,
          color: colors.label.primary,
          flex: 1,
          marginRight: Spacing.sm,
        },
        sensorValueInline: {
          ...Typography.body,
          color: colors.label.secondary,
          marginRight: Spacing.xs,
        },
        sensorChevronInline: {
          fontSize: 24,
          color: colors.label.tertiary,
        },
        // (Phase 5.5 — these styles are kept around for back-compat but
        //  no longer used. Remove in a follow-up if not referenced.)
        sensorTopRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        sensorMain: { flex: 1, marginRight: Spacing.sm },
        sensorName: {
          ...Typography.body,
          color: colors.label.primary,
        },
        sensorFlagRow: {
          marginTop: Spacing.sm,
          marginLeft: 40,
          paddingVertical: Spacing.sm,
          paddingRight: Spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
        },
        sensorFlagValueLabel: {
          ...Typography.body,
          color: colors.label.secondary,
          flex: 1,
          textAlign: 'right',
          marginRight: Spacing.sm,
        },
        sensorFlagChevron: {
          fontSize: 24,
          color: colors.label.tertiary,
        },
        sensorFlagLabel: {
          ...Typography.caption2,
          color: colors.label.secondary,
          marginBottom: Spacing.xs,
        },
        // Swipe-to-delete action — red background with label
        sensorSwipeAction: {
          backgroundColor: colors.accent.red,
          justifyContent: 'center',
          alignItems: 'center',
          width: 96,
          paddingHorizontal: Spacing.md,
        },
        sensorSwipeActionText: {
          ...Typography.headline,
          color: '#FFFFFF',
          fontWeight: '600',
        },
        emptyState: {
          paddingVertical: Spacing.lg,
          alignItems: 'center',
        },
        emptyStateText: {
          ...Typography.subheadline,
          color: colors.label.secondary,
          textAlign: 'center',
          marginBottom: Spacing.md,
        },
        addButton: {
          marginTop: Spacing.md,
          paddingVertical: Spacing.sm,
          alignItems: 'center',
        },
        addButtonText: {
          ...Typography.headline,
          color: colors.tint,
        },
        // Connection summary card — navigates to LoxoneConnection on tap
        connectionCardRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: Spacing.sm,
        },
        connectionCardMain: { flex: 1 },
        connectionCardLabel: {
          ...Typography.body,
          color: colors.label.primary,
        },
        connectionSeparator: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.separator.nonOpaque,
          marginVertical: Spacing.xs,
        },
        connectionCardActive: {
          ...Typography.caption1,
          color: colors.tint,
          fontWeight: '600',
          marginRight: Spacing.xs,
        },
        connectionCardChevron: {
          fontSize: 24,
          color: colors.label.tertiary,
          marginLeft: Spacing.sm,
        },
        actions: { marginTop: Spacing.lg, gap: Spacing.md },
        infoSection: {
          marginTop: Spacing.xl,
          padding: Spacing.md,
          backgroundColor: colors.background.groupedSecondary,
          borderRadius: Layout.radius.lg,
        },
        infoTitle: { ...Typography.subheadline, color: colors.label.primary, marginBottom: Spacing.xs },
        infoText: { ...Typography.caption1, color: colors.label.secondary, lineHeight: 18 },
      }),
    [colors],
  );

  // ─── Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const config = await SharedStorage.getLoxoneConfig();
    if (config) {
      setEnabled(config.enabled);
      setCloudAddress(config.cloudAddress);
      setSensors(config.sensors);
    }
    setHasLoadedOnce(true);
  };

  // ─── Master toggle: persist enabled immediately (sensors persist
  //    via granular ops from the row UI) ─────────────────────────
  const toggleEnabled = async (value: boolean) => {
    setEnabled(value);
    try {
      const existing = await SharedStorage.getLoxoneConfig();
      if (!existing) return;
      await SharedStorage.setLoxoneConfig({ ...existing, enabled: value });
      if (!value) refreshWeather();
    } catch (error) {
      console.warn('[LoxoneConfig] Toggle persist failed:', error);
    }
  };

  // ─── Navigation to connection edit screen ──────────────────────
  const openConnectionEdit = () => {
    (navigation as any).navigate('LoxoneConnection');
  };



  // ─── Sensor row actions (Phase 2.1) ─────────────────────────────
  const onDragEnd = async ({ data }: { data: Sensor[] }) => {
    setSensors(data);
    await SharedStorage.reorderSensors(data.map((s) => s.uuid));
  };

  // Phase 5: 3-state visibility SegmentedControl ("App" / "Widget" /
  // Phase 5.5: visibility editing moved to SensorVisibilityScreen.
  // Tapping the row navigates there. The state lives there and the
  // SharedStorage update is owned by that screen. (No setVisibility
  // helper here anymore.)

  const deleteSensorWithConfirm = async (uuid: string) => {
    const sensor = sensors.find((s) => s.uuid === uuid);
    if (!sensor) return;
    Alert.alert(
      'Sensor löschen?',
      `"${sensor.name}" wirklich aus der Konfiguration entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            setSensors((prev) => prev.filter((s) => s.uuid !== uuid));
            await SharedStorage.removeSensor(uuid);
          },
        },
      ],
    );
  };

  // ─── Rename (Phase 2.3) ─────────────────────────────────────────
  // iOS only — RN's Alert.prompt isn't supported on Android. Fine for
  // this app (iOS-only).
  const renameSensor = (uuid: string) => {
    const sensor = sensors.find((s) => s.uuid === uuid);
    if (!sensor) return;
    Alert.prompt(
      'Sensor umbenennen',
      undefined,
      async (text) => {
        const next = text?.trim();
        if (!next || next === sensor.name) return;
        setSensors((prev) => prev.map((s) => (s.uuid === uuid ? { ...s, name: next } : s)));
        await SharedStorage.updateSensor(uuid, { name: next });
      },
      'plain-text',
      sensor.name,
    );
  };

  // ─── Sensor picker (Phase 2.2) ──────────────────────────────────
  const [pickerVisible, setPickerVisible] = useState(false);
  const openPicker = () => {
    if (!cloudAddress) {
      Alert.alert('Fehler', 'Bitte zuerst eine Verbindung konfigurieren.');
      return;
    }
    setPickerVisible(true);
  };
  const handleSensorPicked = async (sensor: { uuid: string; name: string }) => {
    setPickerVisible(false);
    const updated = await SharedStorage.addSensor({
      uuid: sensor.uuid,
      name: sensor.name,
      showInApp: true,
      showInWidget: true,
    });
    if (updated) setSensors(updated.sensors);
    await refreshWeather();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Loxone</Text>
        <LiquidGlassCloseButton onPress={() => navigation.goBack()} label="Fertig" />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Smart Home Konfiguration</Text>
        <Text style={styles.subtitle}>
          Wetterprognose und aktuelle Messwerte für den gewählten Standort.
        </Text>

        {/* Master enable + Connection summary — combined card. Top row
            has the Loxone master toggle, bottom row is the connection
            summary (label + Aktiv status + chevron) that navigates to
            LoxoneConnection. */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Text style={styles.label}>Loxone aktivieren</Text>
              <Text style={styles.hint}>Sensoren in App und Widget anzeigen</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggleEnabled}
              trackColor={{ false: colors.separator.opaque, true: colors.tint }}
              thumbColor={colors.background.primary}
            />
          </View>

          <View style={styles.connectionSeparator} />

          <TouchableOpacity
            style={styles.connectionCardRow}
            onPress={openConnectionEdit}
            accessibilityRole="button"
            accessibilityLabel="Verbindung bearbeiten"
          >
            <View style={styles.connectionCardMain}>
              <Text style={styles.connectionCardLabel}>Verbindung</Text>
            </View>
            {enabled && (
              <Text style={styles.connectionCardActive}>Aktiv</Text>
            )}
            <Text style={styles.connectionCardChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Sensor list (Phase 2.1) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Temperatursensoren</Text>

          {sensors.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Noch keine Sensoren konfiguriert. Verbindung herstellen und Sensor hinzufügen.
              </Text>
            </View>
          ) : (
            <DraggableFlatList
              data={sensors}
              keyExtractor={(item) => item.uuid}
              onDragEnd={onDragEnd}
              scrollEnabled={false}
              renderItem={({ item, drag, isActive }: RenderItemParams<Sensor>) => (
                <ScaleDecorator>
                  <Swipeable
                    renderRightActions={() => (
                      <TouchableOpacity
                        style={styles.sensorSwipeAction}
                        onPress={() => deleteSensorWithConfirm(item.uuid)}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name} löschen`}
                      >
                        <Text style={styles.sensorSwipeActionText}>Löschen</Text>
                      </TouchableOpacity>
                    )}
                    friction={2}
                    rightThreshold={48}
                    overshootRight={false}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        (navigation as any).navigate('SensorVisibility', { uuid: item.uuid })
                      }
                      onLongPress={drag}
                      delayLongPress={150}
                      disabled={isActive}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name} Sichtbarkeit bearbeiten`}
                      style={[styles.sensorRow, isActive && { opacity: 0.85 }]}
                    >
                      {/* Drag handle — three-stripe icon (☰) on the left */}
                      <View style={styles.sensorDragHandle} pointerEvents="none">
                        <Text style={styles.sensorDragHandleIcon}>≡</Text>
                      </View>

                      {/* Name (flex: 1) */}
                      <Text style={styles.sensorNameInline} numberOfLines={1}>
                        {item.name}
                      </Text>

                      {/* Value (right) + chevron */}
                      <Text style={styles.sensorValueInline}>
                        {item.showInApp && item.showInWidget
                          ? 'Beide'
                          : item.showInApp
                            ? 'App'
                            : item.showInWidget
                              ? 'Widget'
                              : 'Beide'}
                      </Text>
                      <Text style={styles.sensorChevronInline}>›</Text>
                    </TouchableOpacity>
                  </Swipeable>
                </ScaleDecorator>
              )}
            />
          )}

          {/* Add sensor (Phase 2.2: opens picker) */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={openPicker}
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>+ Sensor hinzufügen</Text>
          </TouchableOpacity>
        </View>

        {hasLoadedOnce && (
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Hinweise:</Text>
            <Text style={styles.infoText}>
              • Verbindung oben konfigurieren (Cloud-SNR, Zugangsdaten){'\n'}
              • App-Schalter: zeigt den Sensor in der Smart-Home-Tab{'\n'}
              • Widget-Schalter: zeigt den Sensor im iOS-Widget
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sensor picker modal (Phase 2.2) */}
      <LoxoneSensorPicker
        visible={pickerVisible}
        existingUuids={sensors.map((s) => s.uuid)}
        onClose={() => setPickerVisible(false)}
        onSelect={handleSensorPicked}
      />
    </SafeAreaView>
  );
}

/**
 * LoxoneSensorPicker — modal that scans the configured Loxone Miniserver
 * for temperature sensors and lets the user add one to the configured list.
 * Reads its own credentials + cloud address from SharedStorage so the
 * parent doesn't need to forward them. Already-configured UUIDs are
 * filtered out so the user can't add duplicates.
 *
 * Phase 2.2: name = Loxone name on add (D6 pre-fill, editable later).
 * Filters by name / room / type via a search field.
 */
function LoxoneSensorPicker({
  visible,
  existingUuids,
  onClose,
  onSelect,
}: {
  visible: boolean;
  existingUuids: string[];
  onClose: () => void;
  onSelect: (sensor: { uuid: string; name: string }) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sensors, setSensors] = useState<{ uuid: string; name: string; room: string; type: string; category: string }[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const cfg = await SharedStorage.getLoxoneConfig();
        if (!cfg) {
          Alert.alert('Nicht konfiguriert', 'Bitte zuerst die Loxone Verbindung konfigurieren.');
          return;
        }
        const api = new LoxoneAPI({
          cloudAddress: cfg.cloudAddress,
          username: cfg.username,
          password: cfg.password,
        });
        const found = await api.getTemperatureSensors();
        if (cancelled) return;
        const available = found.filter((s) => !existingUuids.includes(s.uuid));
        setSensors(available);
      } catch (error: any) {
        if (cancelled) return;
        Alert.alert('Fehler beim Laden', error.message || 'Konnte Sensoren nicht laden');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, existingUuids.join(",")]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        modalRoot: { flex: 1, backgroundColor: colors.background.grouped },
        modalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.md,
          paddingTop: insets.top + Spacing.sm,
          paddingBottom: Spacing.sm,
        },
        modalTitle: { ...Typography.headline, color: colors.label.primary },
        modalCancel: { ...Typography.body, color: colors.tint },
        search: {
          backgroundColor: colors.fill.tertiary,
          borderRadius: Layout.radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          marginHorizontal: Spacing.md,
          marginBottom: Spacing.sm,
          color: colors.label.primary,
          ...Typography.body,
        },
        row: {
          backgroundColor: colors.background.groupedSecondary,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator.nonOpaque,
        },
        rowName: { ...Typography.body, color: colors.label.primary, fontWeight: '500' },
        rowMeta: {
          ...Typography.caption2,
          color: colors.label.secondary,
          marginTop: 2,
        },
        empty: {
          paddingVertical: Spacing.xl,
          alignItems: 'center',
        },
        emptyText: { ...Typography.subheadline, color: colors.label.secondary },
        list: { paddingBottom: Spacing.lg },
      }),
    [colors, insets.top],
  );

  const filtered = query.trim()
    ? sensors.filter((s) => {
        const q = query.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.room.toLowerCase().includes(q) ||
          s.type.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
        );
      })
    : sensors;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalRoot} edges={['bottom']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.modalCancel}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Sensor wählen</Text>
          <View style={{ width: 70 }} />
        </View>

        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="🔍 Sensor suchen (Name, Raum, Typ)..."
          placeholderTextColor={colors.label.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {sensors.length === 0
                ? 'Keine weiteren Temperatursensoren im Miniserver gefunden.'
                : 'Kein Sensor passt zur Suche.'}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list}>
            {filtered.map((sensor) => (
              <TouchableOpacity
                key={sensor.uuid}
                style={styles.row}
                onPress={() => onSelect(sensor)}
                accessibilityRole="button"
                accessibilityLabel={`Sensor ${sensor.name} hinzufügen`}
              >
                <Text style={styles.rowName}>{sensor.name}</Text>
                <Text style={styles.rowMeta}>
                  {sensor.room} · {sensor.type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
