/**
 * LoxoneConnectionScreen — connection edit form.
 *
 * Reached by tapping the Connection summary card in LoxoneConfigScreen.
 * Owns the Loxone credentials (cloud SNR / username / password) and the
 * master enable toggle. Sensors are NOT managed here — they're managed
 * via the sensor list in LoxoneConfigScreen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { LoxoneAPI } from '../api/loxone';
import { useWeather } from '../providers/WeatherContext';
import { Button } from '../components/Button';
import { LiquidGlassCloseButton } from '../components/LiquidGlassCloseButton';
import { Typography, Spacing, Layout } from '../constants/designSystem';
import { useColors } from '../hooks/useColors';

export default function LoxoneConnectionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useColors();
  const { refresh: refreshWeather } = useWeather();

  const [cloudAddress, setCloudAddress] = useState('504F94A1874F');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
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
        section: {
          backgroundColor: colors.background.groupedSecondary,
          borderRadius: Layout.radius.lg,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          marginBottom: Spacing.lg,
        },
        sectionTitle: {
          ...Typography.headline,
          color: colors.label.primary,
          marginBottom: Spacing.md,
        },
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
        toggleRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: Spacing.sm,
        },
        toggleLabel: { flex: 1, marginRight: Spacing.md },
        label: { ...Typography.body, color: colors.label.primary, marginBottom: Spacing.xs },
        hint: { ...Typography.caption1, color: colors.label.secondary },
        actions: { marginTop: Spacing.lg, gap: Spacing.md },
        infoText: { ...Typography.caption1, color: colors.label.secondary, lineHeight: 18 },
      }),
    [colors],
  );

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = useCallback(async () => {
    const config = await SharedStorage.getLoxoneConfig();
    if (config) {
      setCloudAddress(config.cloudAddress);
      setUsername(config.username);
      setPassword(config.password);
      setEnabled(config.enabled);
    }
    setHasLoadedOnce(true);
  }, []);

  const testConnection = useCallback(async () => {
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
  }, [cloudAddress, username, password]);

  const saveConfig = useCallback(async () => {
    setLoading(true);
    try {
      const existing = await SharedStorage.getLoxoneConfig();
      await SharedStorage.setLoxoneConfig({
        cloudAddress,
        username,
        password,
        enabled: existing?.enabled ?? false,
        sensors: existing?.sensors ?? [],
      });
      await refreshWeather();
      Alert.alert('Gespeichert', 'Verbindung gespeichert.');
    } catch (error: any) {
      Alert.alert('Fehler', 'Konnte Konfiguration nicht speichern');
    } finally {
      setLoading(false);
    }
  }, [cloudAddress, username, password, refreshWeather]);

  const deleteConfig = useCallback(() => {
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
            setCloudAddress('504F94A1874F');
            setUsername('');
            setPassword('');
            setEnabled(false);
            Alert.alert('Gelöscht', 'Loxone Konfiguration wurde gelöscht.');
          },
        },
      ],
    );
  }, [refreshWeather]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Verbindung</Text>
        <LiquidGlassCloseButton
          onPress={() => navigation.goBack()}
          label="Fertig"
        />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cloud-Verbindung</Text>

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

        <View style={styles.actions}>
          <Button
            title="Verbindung speichern"
            onPress={saveConfig}
            disabled={loading}
            loading={loading}
            fullWidth
          />
          {hasLoadedOnce && enabled && (
            <Button
              title="Konfiguration löschen"
              onPress={deleteConfig}
              fullWidth
              variant="secondary"
            />
          )}
        </View>

        {hasLoadedOnce && !enabled && (
          <Text style={styles.infoText}>
            Hinweis: Loxone ist deaktiviert. Aktiviere es in der Sensor-Übersicht.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
