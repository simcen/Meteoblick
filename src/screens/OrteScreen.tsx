/**
 * OrteScreen — POI (location) search & configuration.
 *
 * Reached from the Settings modal. Owns the full POI search flow:
 * - Type a query (city name, PLZ, etc.)
 * - Pick a POI from MeteoSwiss suggestions
 * - Save it; the WeatherContext refreshes and the widget updates
 *
 * Reads the currently-saved POI on focus and pre-fills the search input
 * with the cached location name so the user sees what's already set.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { Button } from '../components/Button';
import { Typography, Spacing, Layout } from '../constants/designSystem';
import { useScrollContext } from '../contexts/ScrollContext';
import { useWeather } from '../providers/WeatherContext';
import { useColors } from '../hooks/useColors';
import type { POI } from '../types/poi';

export default function OrteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [poiList, setPoiList] = useState<POI[]>([]);
  const [loadingPOIs, setLoadingPOIs] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

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
        keyboardAvoid: { flex: 1 },
        container: { flex: 1 },
        contentContainer: {
          paddingHorizontal: Spacing.screenHorizontal,
          paddingBottom: Spacing.lg,
        },
        title: { ...Typography.title2, color: colors.label.primary, marginBottom: Spacing.xs },
        subtitle: { ...Typography.subheadline, color: colors.label.secondary, marginBottom: Spacing.lg },
        label: { ...Typography.headline, color: colors.label.primary, marginBottom: Spacing.sm },
        searchContainer: { position: 'relative', marginBottom: Spacing.md },
        input: {
          height: Layout.height.input,
          backgroundColor: colors.background.secondary,
          borderRadius: Layout.radius.sm,
          paddingHorizontal: Spacing.md,
          fontSize: Typography.body.fontSize,
          color: colors.label.primary,
          borderWidth: Layout.border.thin,
          borderColor: colors.separator.opaque,
        },
        searchLoadingIndicator: {
          position: 'absolute',
          right: Spacing.md,
          top: 12,
        },
        suggestionsContainer: {
          marginTop: Spacing.sm,
          backgroundColor: colors.background.primary,
          borderRadius: Layout.radius.md,
          borderWidth: Layout.border.normal,
          borderColor: colors.separator.opaque,
          overflow: 'hidden',
        },
        suggestionsHeader: {
          ...Typography.caption1,
          color: colors.label.secondary,
          padding: Spacing.md,
          paddingBottom: Spacing.xs,
        },
        suggestionsList: { maxHeight: 250 },
        suggestionItem: {
          minHeight: Layout.height.listItem,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          backgroundColor: colors.background.primary,
          borderBottomWidth: Layout.border.thin,
          borderBottomColor: colors.separator.opaque,
        },
        suggestionName: {
          ...Typography.body,
          color: colors.label.primary,
          marginBottom: 2,
        },
        suggestionMeta: { ...Typography.caption1, color: colors.label.secondary },
        buttonContainer: { marginTop: Spacing.lg },
      }),
    [colors],
  );

  // Weather + Loxone state come from the shared context so the widget
  // updates automatically after a save.
  const { weather: weatherData, refresh } = useWeather();

  // Wire scroll into the AppHeader's shared scrollY value for the fade.
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

  // On focus: pre-fill the search input with the currently-saved location.
  useFocusEffect(
    useCallback(() => {
      const currentName = weatherData?.locationName;
      if (currentName) {
        setSearchQuery(currentName);
      }
    }, [weatherData?.locationName])
  );

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchPOIs();
    } else {
      setPoiList([]);
    }
  }, [searchQuery]);

  const searchPOIs = async () => {
    try {
      setLoadingPOIs(true);
      const pois = await MeteoSwissAPI.fetchPOIList(searchQuery);
      setPoiList(pois);
      if (pois.length > 0) {
        setShowSuggestions(true);
      }
    } catch (error: any) {
      console.error('Failed to search POIs:', error);
      setPoiList([]);
    } finally {
      setLoadingPOIs(false);
    }
  };

  const handlePOISelect = (poi: POI) => {
    setSearchQuery(poi.name);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleSave = async () => {
    // Find selected POI from search query
    const selectedPOI = poiList.find(
      (poi) =>
        poi.name.toLowerCase() === searchQuery.toLowerCase() ||
        poi.id === searchQuery,
    );

    if (!selectedPOI) {
      Alert.alert('Fehler', 'Bitte einen Standort aus der Liste auswählen');
      return;
    }

    setLoading(true);

    try {
      await SharedStorage.setPointId(selectedPOI.id);

      // Trigger a fresh fetch via the shared context (also updates the widget).
      await refresh();

      Alert.alert(
        'Gespeichert',
        `Standort "${selectedPOI.name}" gespeichert und Widget aktualisiert.`,
      );

      setShowSuggestions(false);
      Keyboard.dismiss();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
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
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingTop: Spacing.md },
          ]}
          keyboardShouldPersistTaps="handled"
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          <Text style={styles.title}>Orte</Text>
          <Text style={styles.subtitle}>
            Wähle deinen Standort für die Wetterprognose und das Widget.
          </Text>

          <Text style={styles.label}>Standort suchen</Text>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.input}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setShowSuggestions(text.length >= 2);
              }}
              placeholder="z.B. Frauenkappelen, Bern, Basel..."
              placeholderTextColor={colors.label.tertiary}
              autoCapitalize="words"
              editable={!loading}
              selectTextOnFocus={true}
              returnKeyType="search"
              onFocus={() => setShowSuggestions(searchQuery.length >= 2)}
            />
            {loadingPOIs && (
              <ActivityIndicator size="small" style={styles.searchLoadingIndicator} />
            )}
          </View>

          {showSuggestions && poiList.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsHeader}>
                {poiList.length} Ergebnisse für "{searchQuery}"
              </Text>
              <FlatList
                data={poiList}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => handlePOISelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionName}>{item.name}</Text>
                    <Text style={styles.suggestionMeta}>
                      {item.plz || `ID: ${item.id}`}
                    </Text>
                  </TouchableOpacity>
                )}
                style={styles.suggestionsList}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={false}
              />
            </View>
          )}

          <View style={styles.buttonContainer}>
            <Button
              title="Speichern"
              onPress={handleSave}
              disabled={!searchQuery.trim()}
              loading={loading}
              fullWidth
            />
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}