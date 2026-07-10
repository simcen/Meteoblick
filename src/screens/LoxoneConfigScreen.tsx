/**
 * LoxoneConfigScreen — full Loxone configuration UI.
 *
 * Reached from Settings > Smart Home. Owns:
 * - Connection credentials (cloud SNR, username, password)
 * - Sensor selection (load sensors, pick one, preview live temperature)
 * - Save / edit / delete the configuration
 * - Enable/disable toggle (this is also accessible from the read-only
 *   SmartHome tab for quick toggling without opening this screen)
 *
 * On save, persists the sensor name as `temperatureSensorName` so the
 * read-only SmartHomeScreen can display it without re-fetching.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
} from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { LoxoneAPI, type LoxoneTemperatureSensor } from '../api/loxone';
import { useWeather } from '../providers/WeatherContext';
import { useScrollContext } from '../contexts/ScrollContext';
import { Button } from '../components/Button';
import { Colors, Typography, Spacing, Layout } from '../constants/designSystem';

export default function LoxoneConfigScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { refresh: refreshWeather } = useWeather();
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
  const [cloudAddress, setCloudAddress] = useState('504F94A1874F'); // Pre-filled
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedSensorUUID, setSelectedSensorUUID] = useState<string | undefined>();
  const [sensors, setSensors] = useState<LoxoneTemperatureSensor[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingSensors, setLoadingSensors] = useState(false);
  const [sensorSearchQuery, setSensorSearchQuery] = useState('');
  const [configSaved, setConfigSaved] = useState(false);
  const [showSensors, setShowSensors] = useState(true);
  const [showConnection, setShowConnection] = useState(true);
  const [previewTemperature, setPreviewTemperature] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
      setSelectedSensorUUID(config.temperatureSensorUUID);
      if (config.enabled && config.temperatureSensorUUID) {
        setConfigSaved(true);
        setShowConnection(false);
        setShowSensors(false);
      }
    }
  };

  const testConnection = async () => {
    if (!username || !password) {
      Alert.alert('Fehler', 'Bitte Username und Passwort eingeben');
      return;
    }

    setTesting(true);
    try {
      const api = new LoxoneAPI({
        cloudAddress,
        username,
        password,
      });

      const connection = await api.getConnection();
      const connectionType = connection.type === 'local' ? 'Lokal' : 'Cloud';

      Alert.alert(
        'Verbindung erfolgreich',
        `Typ: ${connectionType}\n` +
          `URL: ${connection.baseURL}\n\n` +
          'Die Verbindung zum Loxone Miniserver funktioniert!',
      );
    } catch (error: any) {
      Alert.alert('Verbindung fehlgeschlagen', error.message || 'Unbekannter Fehler');
    } finally {
      setTesting(false);
    }
  };

  const selectSensor = async (uuid: string, name: string) => {
    setSelectedSensorUUID(uuid);

    if (!username || !password) return;

    setPreviewLoading(true);
    setPreviewTemperature(null);

    try {
      const api = new LoxoneAPI({
        cloudAddress,
        username,
        password,
      });
      const temp = await api.getTemperature(uuid);
      setPreviewTemperature(temp);
    } catch (error: any) {
      setPreviewTemperature(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadSensors = async () => {
    if (!username || !password) {
      Alert.alert('Fehler', 'Bitte Username und Passwort eingeben');
      return;
    }

    setLoadingSensors(true);
    setSensors([]);
    setPreviewTemperature(null);

    try {
      const api = new LoxoneAPI({
        cloudAddress,
        username,
        password,
      });

      const foundSensors = await api.getTemperatureSensors();

      if (foundSensors.length === 0) {
        Alert.alert('Keine Sensoren gefunden', 'Im Miniserver wurden keine Temperatursensoren gefunden.');
        return;
      }

      setSensors(foundSensors);
      Alert.alert('Sensoren geladen', `${foundSensors.length} Temperatursensor(en) gefunden.`);
    } catch (error: any) {
      Alert.alert('Fehler beim Laden', error.message || 'Konnte Sensoren nicht laden');
    } finally {
      setLoadingSensors(false);
    }
  };

  const saveConfig = async () => {
    if (enabled && !selectedSensorUUID) {
      Alert.alert('Fehler', 'Bitte einen Temperatursensor auswählen');
      return;
    }

    setLoading(true);
    try {
      // Look up the sensor name to persist alongside the UUID
      const sensor = sensors.find((s) => s.uuid === selectedSensorUUID);
      const temperatureSensorName = sensor?.name;

      await SharedStorage.setLoxoneConfig({
        cloudAddress,
        username,
        password,
        temperatureSensorUUID: selectedSensorUUID,
        temperatureSensorName,
        enabled,
      });

      // Trigger a weather refresh so the widget picks up the new sensor
      await refreshWeather();

      setConfigSaved(true);
      setShowConnection(false);
      setShowSensors(false);

      Alert.alert('Gespeichert', 'Loxone Konfiguration wurde gespeichert.');
    } catch (error: any) {
      Alert.alert('Fehler', 'Konnte Konfiguration nicht speichern');
    } finally {
      setLoading(false);
    }
  };

  const deleteConfig = async () => {
    Alert.alert(
      'Konfiguration löschen?',
      'Möchtest du die Loxone Konfiguration wirklich löschen?',
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
            setSelectedSensorUUID(undefined);
            setSensors([]);
            setConfigSaved(false);
            setShowConnection(true);
            setShowSensors(true);
            setPreviewTemperature(null);
            Alert.alert('Gelöscht', 'Loxone Konfiguration wurde gelöscht.');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={[styles.closeRow, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Schliessen"
          style={styles.closeButton}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Smart Home Konfiguration</Text>
          <Text style={styles.subtitle}>
            Loxone-Sensor ins Widget integrieren
          </Text>
        </View>

        {/* Enable/Disable Toggle */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Text style={styles.label}>Loxone aktivieren</Text>
              <Text style={styles.hint}>Zeigt Loxone Temperatur im Widget</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={(value) => {
                setEnabled(value);
                // Persist toggle immediately (works on existing configs).
                (async () => {
                  try {
                    const existing = await SharedStorage.getLoxoneConfig();
                    if (!existing) return;
                    await SharedStorage.setLoxoneConfig({ ...existing, enabled: value });
                    if (!value) {
                      refreshWeather();
                    }
                  } catch (error) {
                    console.warn('[LoxoneConfig] Toggle persist failed:', error);
                  }
                })();
              }}
              trackColor={{ false: Colors.separator.opaque, true: Colors.tint }}
              thumbColor={Colors.background.primary}
            />
          </View>
        </View>

        {/* Configuration Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowConnection(!showConnection)}
          >
            <Text style={styles.sectionTitle}>
              {showConnection ? '▼' : '▶'} Verbindung
            </Text>
            {configSaved && !showConnection && (
              <Text style={styles.sectionSummary}>✓ {cloudAddress}</Text>
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
                autoCapitalize="characters"
                editable={!loading}
              />

              <Text style={styles.inputLabel}>Benutzername</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Miniserver Benutzer"
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

        {/* Sensor Selection */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowSensors(!showSensors)}
          >
            <Text style={styles.sectionTitle}>
              {showSensors ? '▼' : '▶'} Temperatursensor
            </Text>
            {configSaved && !showSensors && (
              <Text style={styles.sectionSummary}>✓ Ausgewählt</Text>
            )}
          </TouchableOpacity>

          {showSensors && (
            <View>
              {!configSaved && (
                <>
                  <Button
                    title="Sensoren laden"
                    onPress={loadSensors}
                    disabled={!username || !password || loadingSensors}
                    loading={loadingSensors}
                  />

                  {loadingSensors && (
                    <View style={styles.loadingHint}>
                      <Text style={styles.loadingHintText}>
                        Structure File wird geladen...{'\n'}
                        Bei großen Loxone-Projekten kann dies bis zu 90 Sekunden dauern.
                      </Text>
                    </View>
                  )}
                </>
              )}

              {sensors.length > 0 ? (
                <View style={styles.sensorList}>
                  <Text style={styles.sensorListTitle}>
                    {sensors.length} Sensor(en) gefunden
                  </Text>

                  {!configSaved && (
                    <TextInput
                      style={styles.input}
                      value={sensorSearchQuery}
                      onChangeText={setSensorSearchQuery}
                      placeholder="🔍 Sensor suchen (Name, Raum, Typ)..."
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  )}

                  {sensors
                    .filter((sensor) => {
                      if (configSaved) {
                        return sensor.uuid === selectedSensorUUID;
                      }
                      if (!sensorSearchQuery.trim()) return true;
                      const query = sensorSearchQuery.toLowerCase();
                      return (
                        sensor.name.toLowerCase().includes(query) ||
                        sensor.room.toLowerCase().includes(query) ||
                        sensor.type.toLowerCase().includes(query) ||
                        sensor.category.toLowerCase().includes(query)
                      );
                    })
                    .map((sensor) => (
                      <TouchableOpacity
                        key={sensor.uuid}
                        style={[
                          styles.sensorItem,
                          selectedSensorUUID === sensor.uuid && styles.sensorItemSelected,
                        ]}
                        onPress={() => !configSaved && selectSensor(sensor.uuid, sensor.name)}
                        disabled={configSaved}
                      >
                        <View style={styles.sensorInfo}>
                          <Text style={styles.sensorName}>{sensor.name}</Text>
                          <Text style={styles.sensorDetails}>
                            {sensor.room} • {sensor.type}
                          </Text>
                          {selectedSensorUUID === sensor.uuid && !configSaved && (
                            <View style={styles.previewRow}>
                              {previewLoading ? (
                                <Text style={styles.previewLoading}>🌡️ Lade...</Text>
                              ) : previewTemperature !== null ? (
                                <Text style={styles.previewTemp}>
                                  🌡️ Aktuell: {previewTemperature.toFixed(1)}°C
                                </Text>
                              ) : (
                                <Text style={styles.previewError}>
                                  ⚠️ Konnte nicht abgerufen werden
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                        {selectedSensorUUID === sensor.uuid && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Save/Delete Actions */}
        <View style={styles.actions}>
          {!configSaved && (
            <Button
              title="Speichern"
              onPress={saveConfig}
              disabled={loading}
              loading={loading}
              fullWidth
            />
          )}

          {configSaved && (
            <>
              <Button
                title="Konfiguration bearbeiten"
                onPress={() => {
                  setConfigSaved(false);
                  setShowConnection(true);
                  setShowSensors(true);
                }}
                fullWidth
              />
              <Button title="Konfiguration löschen" onPress={deleteConfig} fullWidth />
            </>
          )}
        </View>

        {!configSaved && (
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Hinweise:</Text>
            <Text style={styles.infoText}>
              • Die App verbindet sich automatisch lokal (WLAN) oder über die Cloud{'\n'}
              • Credentials werden sicher auf dem Gerät gespeichert{'\n'}
              • Die Temperatur wird alle 5-15 Minuten aktualisiert
            </Text>
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.screenHorizontal,
    paddingBottom: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title2,
    color: Colors.label.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.subheadline,
    color: Colors.label.secondary,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.label.primary,
    marginBottom: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  toggleLabel: {
    flex: 1,
    marginRight: Spacing.md,
  },
  label: {
    ...Typography.body,
    color: Colors.label.primary,
    marginBottom: Spacing.xs,
  },
  hint: {
    ...Typography.caption1,
    color: Colors.label.secondary,
  },
  inputLabel: {
    ...Typography.subheadline,
    color: Colors.label.primary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    ...Typography.body,
    backgroundColor: Colors.background.secondary,
    borderRadius: Layout.radius.md,
    borderWidth: Layout.border.normal,
    borderColor: Colors.separator.opaque,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    color: Colors.label.primary,
  },
  sensorList: {
    marginTop: Spacing.md,
  },
  sensorListTitle: {
    ...Typography.subheadline,
    color: Colors.label.secondary,
    marginBottom: Spacing.sm,
  },
  sensorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: Layout.radius.md,
    borderWidth: Layout.border.normal,
    borderColor: Colors.separator.opaque,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sensorItemSelected: {
    borderColor: Colors.tint,
    borderWidth: 2,
    backgroundColor: `${Colors.tint}10`,
  },
  sensorInfo: {
    flex: 1,
  },
  sensorName: {
    ...Typography.body,
    color: Colors.label.primary,
    marginBottom: Spacing.xs,
  },
  sensorDetails: {
    ...Typography.caption1,
    color: Colors.label.secondary,
  },
  checkmark: {
    fontSize: 20,
    color: Colors.tint,
    marginLeft: Spacing.sm,
  },
  actions: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  infoSection: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: Colors.background.secondary,
    borderRadius: Layout.radius.md,
  },
  infoTitle: {
    ...Typography.subheadline,
    color: Colors.label.primary,
    marginBottom: Spacing.xs,
  },
  infoText: {
    ...Typography.caption1,
    color: Colors.label.secondary,
    lineHeight: 18,
  },
  loadingHint: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: `${Colors.tint}15`,
    borderRadius: Layout.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.tint,
  },
  loadingHintText: {
    ...Typography.caption1,
    color: Colors.label.secondary,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  sectionSummary: {
    ...Typography.subheadline,
    color: Colors.tint,
    fontWeight: '600',
  },
  previewRow: {
    marginTop: Spacing.xs,
  },
  previewLoading: {
    ...Typography.caption1,
    color: Colors.label.secondary,
    fontStyle: 'italic',
  },
  previewTemp: {
    ...Typography.caption1,
    color: Colors.tint,
    fontWeight: '600',
  },
  previewError: {
    ...Typography.caption1,
    color: '#FF6B6B',
    fontStyle: 'italic',
  },
});