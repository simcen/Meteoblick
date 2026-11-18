/**
 * LoxoneConnectionScreen — connection edit form.
 *
 * Reached by tapping the Connection summary card in LoxoneConfigScreen.
 * Owns the Loxone connection (Miniserver address + protocol, username,
 * password). Sensors are NOT managed here — they're managed via the
 * sensor list in LoxoneConfigScreen.
 *
 * Inputs are native SwiftUI controls via @expo/ui.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import {
  Host,
  Picker,
  SecureField,
  Text as NativeText,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  disabled,
  keyboardType,
  pickerStyle,
  tag,
  textContentType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { LoxoneAPI, parseLoxoneAddress, type LoxoneProtocol } from '../api/loxone';
import { useWeather } from '../providers/WeatherContext';
import { Button } from '../components/Button';
import { LiquidGlassCloseButton } from '../components/LiquidGlassCloseButton';
import { Typography, Spacing, Layout } from '../constants/designSystem';
import { useColors } from '../hooks/useColors';
import { useTheme } from '../contexts/ThemeContext';

export default function LoxoneConnectionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useColors();
  const { effectiveScheme } = useTheme();
  const { refresh: refreshWeather } = useWeather();

  const [host, setHost] = useState('');
  const [protocol, setProtocol] = useState<LoxoneProtocol>('http');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Native field contents — written to when a stored config is loaded or reset.
  const hostText = useNativeState('');
  const usernameText = useNativeState('');
  const passwordText = useNativeState('');
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
          backgroundColor: colors.fill.tertiary,
          borderRadius: Layout.radius.md,
          borderWidth: Layout.border.normal,
          borderColor: colors.separator.opaque,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          marginBottom: Spacing.md,
        },
        protocolPicker: { marginBottom: Spacing.md },
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
      setHost(config.host);
      setProtocol(config.protocol);
      setUsername(config.username);
      setPassword(config.password);
      setEnabled(config.enabled);
      hostText.set(config.host);
      usernameText.set(config.username);
      passwordText.set(config.password);
    }
    setHasLoadedOnce(true);
  }, [hostText, usernameText, passwordText]);

  // Validates the address field. A pasted URL ("https://host/…") also sets
  // the protocol switch and is reduced to the host.
  const resolveAddress = useCallback(() => {
    const parsed = parseLoxoneAddress(host);
    if (!parsed) {
      Alert.alert('Fehler', 'Bitte eine gültige Adresse eingeben (IP oder DNS-Name, optional mit Port).');
      return null;
    }
    const resolved = { host: parsed.host, protocol: parsed.protocol ?? protocol };
    if (resolved.host !== host) {
      setHost(resolved.host);
      hostText.set(resolved.host);
    }
    setProtocol(resolved.protocol);
    return resolved;
  }, [host, protocol, hostText]);

  const testConnection = useCallback(async () => {
    if (!username || !password) {
      Alert.alert('Fehler', 'Bitte Username und Passwort eingeben');
      return;
    }
    const address = resolveAddress();
    if (!address) return;
    setTesting(true);
    try {
      const api = new LoxoneAPI({ ...address, username, password });
      const connection = await api.testConnection();
      Alert.alert(
        'Verbindung erfolgreich',
        `URL: ${connection.baseURL}\n\nDer Miniserver ist unter dieser Adresse erreichbar.`,
      );
    } catch (error: any) {
      Alert.alert('Verbindung fehlgeschlagen', error.message || 'Unbekannter Fehler');
    } finally {
      setTesting(false);
    }
  }, [resolveAddress, username, password]);

  const saveConfig = useCallback(async () => {
    const address = resolveAddress();
    if (!address) return;
    setLoading(true);
    try {
      const existing = await SharedStorage.getLoxoneConfig();
      await SharedStorage.setLoxoneConfig({
        ...address,
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
  }, [resolveAddress, username, password, refreshWeather]);

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
            setHost('');
            setProtocol('http');
            setUsername('');
            setPassword('');
            setEnabled(false);
            hostText.set('');
            usernameText.set('');
            passwordText.set('');
            Alert.alert('Gelöscht', 'Loxone Konfiguration wurde gelöscht.');
          },
        },
      ],
    );
  }, [refreshWeather, hostText, usernameText, passwordText]);

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
          <Text style={styles.sectionTitle}>Miniserver</Text>

          <Text style={styles.inputLabel}>Adresse</Text>
          <View style={styles.input}>
            <Host matchContents={{ vertical: true }} colorScheme={effectiveScheme}>
              <TextField
                text={hostText}
                onTextChange={setHost}
                placeholder="192.168.1.47 oder miniserver.lan"
                modifiers={[
                  keyboardType('url'),
                  textContentType('URL'),
                  textInputAutocapitalization('never'),
                  autocorrectionDisabled(),
                  disabled(loading),
                ]}
              />
            </Host>
          </View>

          <Text style={styles.inputLabel}>Protokoll</Text>
          <Host
            matchContents={{ vertical: true }}
            colorScheme={effectiveScheme}
            style={styles.protocolPicker}
          >
            <Picker
              selection={protocol}
              onSelectionChange={setProtocol}
              modifiers={[pickerStyle('segmented'), disabled(loading)]}
            >
              <NativeText modifiers={[tag('http')]}>HTTP</NativeText>
              <NativeText modifiers={[tag('https')]}>HTTPS</NativeText>
            </Picker>
          </Host>

          <Text style={styles.inputLabel}>Benutzername</Text>
          <View style={styles.input}>
            <Host matchContents={{ vertical: true }} colorScheme={effectiveScheme}>
              <TextField
                text={usernameText}
                onTextChange={setUsername}
                placeholder="Miniserver Benutzer"
                modifiers={[
                  textContentType('username'),
                  textInputAutocapitalization('never'),
                  autocorrectionDisabled(),
                  disabled(loading),
                ]}
              />
            </Host>
          </View>

          <Text style={styles.inputLabel}>Passwort</Text>
          <View style={styles.input}>
            <Host matchContents={{ vertical: true }} colorScheme={effectiveScheme}>
              <SecureField
                text={passwordText}
                onTextChange={setPassword}
                placeholder="Miniserver Passwort"
                modifiers={[textContentType('password'), disabled(loading)]}
              />
            </Host>
          </View>

          <Button
            title="Verbindung testen"
            onPress={testConnection}
            disabled={!host || !username || !password || testing}
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
