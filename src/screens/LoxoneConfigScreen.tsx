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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { LoxoneAPI } from '../api/loxone';
import { useWeather } from '../providers/WeatherContext';
import { Button } from '../components/Button';
import { LiquidGlassCloseButton } from '../components/LiquidGlassCloseButton';
import { Typography, Spacing, Layout } from '../constants/designSystem';
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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [showConnection, setShowConnection] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
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
        // ─── Sensor rows (Phase 2.1) ──────────────────────────────────
        sensorRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: Spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator.nonOpaque,
          backgroundColor: colors.background.groupedSecondary,
        },
        sensorRowLast: { borderBottomWidth: 0 },
        sensorDragHandle: {
          width: 32,
          height: 44,
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
        sensorMain: { flex: 1, marginRight: Spacing.sm },
        sensorName: {
          ...Typography.body,
          color: colors.label.primary,
          fontWeight: '500',
        },
        sensorMeta: {
          ...Typography.caption2,
          color: colors.label.tertiary,
          marginTop: 2,
        },
        sensorFlags: { flexDirection: 'row', alignItems: 'center', marginRight: Spacing.xs },
        sensorFlag: {
          marginLeft: Spacing.sm,
          alignItems: 'center',
        },
        sensorFlagLabel: {
          ...Typography.caption2,
          color: colors.label.secondary,
          marginBottom: 2,
        },
        sensorDeleteBtn: {
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
        },
        sensorDeleteBtnText: {
          fontSize: 18,
          color: colors.accent.red,
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
      setUsername(config.username);
      setPassword(config.password);
      setSensors(config.sensors);
      if (config.enabled && config.sensors.length > 0) {
        setConfigSaved(true);
        setShowConnection(false);
      }
    }
    setHasLoadedOnce(true);
  };

  // ─── Master toggle: persist enabled + sensors immediately ───────
  const persistNow = useCallback(
    async (next: { enabled?: boolean; sensors?: Sensor[]; cloudAddress?: string; username?: string; password?: string }) => {
      const cfg = await SharedStorage.getLoxoneConfig();
      if (!cfg) {
        // No existing config — save a fresh one with current inputs
        await SharedStorage.setLoxoneConfig({
          cloudAddress: next.cloudAddress ?? cloudAddress,
          username: next.username ?? username,
          password: next.password ?? password,
          enabled: next.enabled ?? enabled,
          sensors: next.sensors ?? sensors,
        });
      } else {
        await SharedStorage.setLoxoneConfig({
          ...cfg,
          ...next,
        });
      }
    },
    [cloudAddress, username, password, enabled, sensors],
  );

  // ─── Connection test (unchanged behavior) ────────────────────────
  const testConnection = async () => {
    if (!username || !password) {
      Alert.alert('Fehler', 'Bitte Username und Passwort eingeben');
      return;
    }
    setTesting(true);
    try {
      const api = new LoxoneAPI({ cloudAddress, username, password });
      const connection = await api.getConnection();
      const connectionType = connection.type === 'local' ? 'Lokal' : 'Cloud';
      Alert.alert(
        'Verbindung erfolgreich',
        `Typ: ${connectionType}\nURL: ${connection.baseURL}\n\nDie Verbindung zum Loxone Miniserver funktioniert!`,
      );
    } catch (error: any) {
      Alert.alert('Verbindung fehlgeschlagen', error.message || 'Unbekannter Fehler');
    } finally {
      setTesting(false);
    }
  };

  // ─── Sensor row actions (Phase 2.1) ─────────────────────────────
  const onDragEnd = async ({ data }: { data: Sensor[] }) => {
    setSensors(data);
    await SharedStorage.reorderSensors(data.map((s) => s.uuid));
  };

  const toggleShowInApp = async (uuid: string) => {
    const sensor = sensors.find((s) => s.uuid === uuid);
    if (!sensor) return;
    const next = !sensor.showInApp;
    setSensors((prev) => prev.map((s) => (s.uuid === uuid ? { ...s, showInApp: next } : s)));
    await SharedStorage.updateSensor(uuid, { showInApp: next });
  };

  const toggleShowInWidget = async (uuid: string) => {
    const sensor = sensors.find((s) => s.uuid === uuid);
    if (!sensor) return;
    const next = !sensor.showInWidget;
    setSensors((prev) => prev.map((s) => (s.uuid === uuid ? { ...s, showInWidget: next } : s)));
    await SharedStorage.updateSensor(uuid, { showInWidget: next });
  };

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
    if (!username || !password) {
      Alert.alert('Fehler', 'Bitte zuerst Username und Passwort eingeben');
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

  // ─── Save (master + sensors) ────────────────────────────────────
  const saveConfig = async () => {
    setLoading(true);
    try {
      await SharedStorage.setLoxoneConfig({
        cloudAddress,
        username,
        password,
        enabled,
        sensors,
      });
      await refreshWeather();
      setConfigSaved(true);
      setShowConnection(false);
      Alert.alert('Gespeichert', 'Loxone Konfiguration wurde gespeichert.');
    } catch (error: any) {
      Alert.alert('Fehler', 'Konnte Konfiguration nicht speichern');
    } finally {
      setLoading(false);
    }
  };

  const deleteConfig = () => {
    Alert.alert(
      'Konfiguration löschen?',
      'Möchtest du die Loxone Konfiguration wirklich komplett löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            await SharedStorage.deleteLoxoneConfig();
            await refreshWeather();
            setEnabled(false);
            setUsername('');
            setPassword('');
            setSensors([]);
            setConfigSaved(false);
            setShowConnection(true);
            Alert.alert('Gelöscht', 'Loxone Konfiguration wurde gelöscht.');
          },
        },
      ],
    );
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

        {/* Master enable toggle */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Text style={styles.label}>Loxone aktivieren</Text>
              <Text style={styles.hint}>Sensoren in App und Widget anzeigen</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={async (value) => {
                setEnabled(value);
                try {
                  const existing = await SharedStorage.getLoxoneConfig();
                  if (!existing) return;
                  await SharedStorage.setLoxoneConfig({ ...existing, enabled: value });
                  if (!value) refreshWeather();
                } catch (error) {
                  console.warn('[LoxoneConfig] Toggle persist failed:', error);
                }
              }}
              trackColor={{ false: colors.separator.opaque, true: colors.tint }}
              thumbColor={colors.background.primary}
            />
          </View>
        </View>

        {/* Connection section (collapsible) */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowConnection(!showConnection)}
          >
            <Text style={styles.sectionTitle}>
              {showConnection ? '▼' : '▶'} Verbindung
            </Text>
            {configSaved && !showConnection && (
              <Text style={[Typography.subheadline, { color: colors.tint, fontWeight: '600' }]}>
                ✓ {cloudAddress}
              </Text>
            )}
          </TouchableOpacity>

          {showConnection && (
            <View>
              <Text style={styles.inputLabel}>Cloud-Adresse (SNR)</Text>
              <TextInput
                style={styles.input}
                value={cloudAddress}
                onChangeText={setCloudAddress}
                placeholder="z.B. 504F94A1874F"
                placeholderTextColor={colors.label.tertiary}
                autoCapitalize="characters"
                editable={!loading}
              />

              <Text style={styles.inputLabel}>Benutzername</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Miniserver Benutzer"
                placeholderTextColor={colors.label.tertiary}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />

              <Text style={styles.inputLabel}>Passwort</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Miniserver Passwort"
                placeholderTextColor={colors.label.tertiary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />

              <Button
                title="Verbindung testen"
                onPress={testConnection}
                disabled={!username || !password || testing}
                loading={testing}
              />
            </View>
          )}
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
                  <TouchableOpacity
                    onLongPress={drag}
                    delayLongPress={150}
                    disabled={isActive}
                    style={[styles.sensorRow, isActive && { opacity: 0.85 }]}
                  >
                    {/* Drag handle — three-stripe icon (☰) on the left */}
                    <View style={styles.sensorDragHandle} pointerEvents="none">
                      <Text style={styles.sensorDragHandleIcon}>≡</Text>
                    </View>

                    {/* Name + meta */}
                    <View style={styles.sensorMain}>
                      <TouchableOpacity
                        onLongPress={() => renameSensor(item.uuid)}
                        delayLongPress={500}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name} umbenennen, lange drücken`}
                        accessibilityHint="Lange drücken zum Umbenennen"
                      >
                        <Text style={styles.sensorName} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.sensorMeta} numberOfLines={1}>
                        {item.uuid.slice(0, 8)}…
                      </Text>
                    </View>

                    {/* Flags: in-app + in-widget */}
                    <View style={styles.sensorFlags}>
                      <View style={styles.sensorFlag}>
                        <Text style={styles.sensorFlagLabel}>App</Text>
                        <Switch
                          value={item.showInApp}
                          onValueChange={() => toggleShowInApp(item.uuid)}
                          trackColor={{ false: colors.separator.opaque, true: colors.tint }}
                          thumbColor={colors.background.primary}
                        />
                      </View>
                      <View style={styles.sensorFlag}>
                        <Text style={styles.sensorFlagLabel}>Widget</Text>
                        <Switch
                          value={item.showInWidget}
                          onValueChange={() => toggleShowInWidget(item.uuid)}
                          trackColor={{ false: colors.separator.opaque, true: colors.tint }}
                          thumbColor={colors.background.primary}
                        />
                      </View>
                    </View>

                    {/* Delete */}
                    <TouchableOpacity
                      onPress={() => deleteSensorWithConfirm(item.uuid)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityLabel={`${item.name} löschen`}
                      accessibilityRole="button"
                      style={styles.sensorDeleteBtn}
                    >
                      <Text style={styles.sensorDeleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
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

        {/* Save / Delete actions */}
        <View style={styles.actions}>
          <Button
            title="Konfiguration speichern"
            onPress={saveConfig}
            disabled={loading}
            loading={loading}
            fullWidth
          />
          {configSaved && (
            <Button title="Konfiguration löschen" onPress={deleteConfig} fullWidth variant="secondary" />
          )}
        </View>

        {hasLoadedOnce && !configSaved && (
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Hinweise:</Text>
            <Text style={styles.infoText}>
              • Verbindung testen, dann Sensoren aus dem Miniserver hinzufügen{'\n'}
              • App-Schalter: zeigt den Sensor in der Smart-Home-Tab{'\n'}
              • Widget-Schalter: zeigt den Sensor im iOS-Widget
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sensor picker modal (Phase 2.2) */}
      <LoxoneSensorPicker
        visible={pickerVisible}
        cloudAddress={cloudAddress}
        username={username}
        password={password}
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
 * Already-configured UUIDs are filtered out so the user can't add duplicates.
 *
 * Phase 2.2: name = Loxone name on add (D6 pre-fill, editable later).
 * Filters by name / room / type via a search field.
 */
function LoxoneSensorPicker({
  visible,
  cloudAddress,
  username,
  password,
  existingUuids,
  onClose,
  onSelect,
}: {
  visible: boolean;
  cloudAddress: string;
  username: string;
  password: string;
  existingUuids: string[];
  onClose: () => void;
  onSelect: (sensor: { uuid: string; name: string }) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sensors, setSensors] = useState<{ uuid: string; name: string; room: string; type: string; category: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const api = new LoxoneAPI({ cloudAddress, username, password });
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
  }, [visible]);

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
