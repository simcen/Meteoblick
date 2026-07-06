import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Alert, ActivityIndicator, FlatList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { LoxoneAPI } from '../api/loxone';
import { updateWidget } from '../widgets/widgetManager';
import { Button } from '../components/Button';
import { Colors, Typography, Spacing, Layout, ComponentStyles } from '../constants/designSystem';
import { BUILD_NUMBER } from '../constants';
import type { WeatherData } from '../types/weather';
import type { POI } from '../types/poi';

export default function HomeScreen() {
  const [pointId, setPointId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [poiList, setPoiList] = useState<POI[]>([]);
  const [loadingPOIs, setLoadingPOIs] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loxoneTemp, setLoxoneTemp] = useState<number | null>(null);
  const [loxoneTimestamp, setLoxoneTimestamp] = useState<string | null>(null);

  // Reload data every time the screen comes into focus
  // This ensures fresh Loxone data after changing sensor in SmartHomeScreen
  useFocusEffect(
    useCallback(() => {
      loadData();

      // Refetch weather if POI is set
      const refetch = async () => {
        const storedPoi = await SharedStorage.getPointId();
        if (storedPoi) {
          await fetchWeatherData(storedPoi);
        }
      };
      refetch();
    }, [])
  );

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchPOIs();
    } else {
      setPoiList([]);
    }
  }, [searchQuery]);

  const loadData = async () => {
    const storedPoi = await SharedStorage.getPointId();
    if (storedPoi) {
      setPointId(storedPoi);
    }

    const storedWeather = await SharedStorage.getWeatherData();
    if (storedWeather) {
      setWeatherData(storedWeather);
    }

    // Load cached Loxone data
    const cachedLoxone = await SharedStorage.getLoxoneSensorData();
    if (cachedLoxone) {
      setLoxoneTemp(cachedLoxone.temperature);
      setLoxoneTimestamp(cachedLoxone.timestamp);
    }
  };

  const fetchWeatherData = async (poiId: string): Promise<WeatherData | null> => {
    // 1. MeteoSwiss — independent of Loxone so backend downtime doesn't block Loxone updates.
    let weather = await SharedStorage.getWeatherData(); // cache as fallback
    try {
      const fresh = await MeteoSwissAPI.fetchWeatherData(poiId);
      await SharedStorage.setWeatherData(fresh);
      weather = fresh;
      setWeatherData(fresh);
      console.log('[HomeScreen] MeteoSwiss fetched:', fresh.temperatureActual);
    } catch (error) {
      console.warn('[HomeScreen] MeteoSwiss fetch failed (continuing):', error);
    }

    // 2. Loxone (if configured) — independent of MeteoSwiss.
    let newLoxoneTemp: number | null = null;
    let newLoxoneTimestamp: string | null = null;

    const loxoneConfig = await SharedStorage.getLoxoneConfig();
    if (loxoneConfig?.enabled && loxoneConfig.temperatureSensorUUID) {
      try {
        const api = new LoxoneAPI(loxoneConfig);
        const temp = await api.getTemperature(loxoneConfig.temperatureSensorUUID);
        newLoxoneTemp = temp;
        newLoxoneTimestamp = new Date().toISOString();
        await SharedStorage.setLoxoneSensorData({ temperature: temp, timestamp: newLoxoneTimestamp });
        console.log('[HomeScreen] Loxone temperature:', temp);
      } catch (err) {
        console.warn('[HomeScreen] Loxone fetch failed:', err);
        const cached = await SharedStorage.getLoxoneSensorData();
        if (cached) {
          newLoxoneTemp = cached.temperature;
          newLoxoneTimestamp = cached.timestamp;
        }
      }
    }

    // Update local Loxone state
    setLoxoneTemp(newLoxoneTemp);
    setLoxoneTimestamp(newLoxoneTimestamp);

    // 3. Update widget — only if we have any weather data (fresh or cached).
    if (weather) {
      try {
        await updateWidget({
          locationName: weather.locationName,
          temperatureActual: weather.temperatureActual,
          temperatureForecast: weather.temperatureForecast,
          temperatureLoxone: newLoxoneTemp ?? undefined,
          symbolCode: weather.symbolCode,
          precipitation: weather.precipitation,
          buildNumber: BUILD_NUMBER,
          timestampActual: weather.timestampActual,
          timestampForecast: weather.timestampForecast,
          timestampLoxone: newLoxoneTimestamp ?? undefined,
        });
      } catch (widgetError) {
        console.error('[HomeScreen] Widget update failed:', widgetError);
      }
    } else {
      console.log('[HomeScreen] No weather data available (no fresh, no cache) — skipping widget update');
    }

    return weather;
  };

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

  console.log('Search query:', searchQuery);
  console.log('Total POIs in list:', poiList.length);
  console.log('Show suggestions:', showSuggestions);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const storedPoi = await SharedStorage.getPointId();
      if (storedPoi) {
        await fetchWeatherData(storedPoi);
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePOISelect = (poi: POI) => {
    setSearchQuery(poi.name);
    setShowSuggestions(false);
    Keyboard.dismiss();
    // Will be saved when user presses "Speichern"
  };

  const handleSave = async () => {
    // Find selected POI from search query
    const selectedPOI = poiList.find(poi =>
      poi.name.toLowerCase() === searchQuery.toLowerCase() ||
      poi.id === searchQuery
    );

    if (!selectedPOI) {
      Alert.alert('Fehler', 'Bitte einen Standort aus der Liste auswählen');
      return;
    }

    setLoading(true);

    try {
      // Save POI first
      await SharedStorage.setPointId(selectedPOI.id);
      setPointId(selectedPOI.id);

      // Fetch weather data from API
      const weather = await fetchWeatherData(selectedPOI.id);

      // Update widget with new data
      if (weather) {
        await updateWidget({
          locationName: weather.locationName,
          temperatureActual: weather.temperatureActual,
          temperatureForecast: weather.temperatureForecast,
          symbolCode: weather.symbolCode,
          precipitation: weather.precipitation,
          buildNumber: BUILD_NUMBER,
          timestampActual: weather.timestampActual,
          timestampForecast: weather.timestampForecast,
        });
      }

      Alert.alert(
        'Gespeichert',
        `Standort "${selectedPOI.name}" gespeichert und Widget aktualisiert.`
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Standort suchen</Text>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.input}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setShowSuggestions(text.length >= 2);
              }}
              placeholder="z.B. Zürich, Bern, Basel..."
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
                  <Text style={styles.debugText}>
                    Debug: {poiList.length} Ergebnisse für "{searchQuery}"
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
                  />
                </View>
              )}

          <View style={styles.buttonContainer}>
            <Button
              title="Speichern & Wetter laden"
              onPress={handleSave}
              disabled={!searchQuery.trim()}
              loading={loading}
              fullWidth
            />
          </View>

              {weatherData && (
                <View style={styles.weatherCard}>
                  <Text style={styles.weatherTitle}>Aktuelles Wetter</Text>
                  <View style={styles.weatherRow}>
                    <Text style={styles.weatherLabel}>Standort</Text>
                    <Text style={styles.weatherValue}>{weatherData.locationName}</Text>
                  </View>
                  <View style={styles.weatherRow}>
                    <Text style={styles.weatherLabel}>POI ID</Text>
                    <Text style={styles.weatherValue}>{weatherData.location}</Text>
                  </View>
                  <View style={styles.weatherRow}>
                    <Text style={styles.weatherLabel}>☁️ MeteoSwiss IST</Text>
                    <Text style={styles.weatherValue}>{weatherData.temperatureActual?.toFixed(1) ?? '--'}°C</Text>
                  </View>
                  <View style={styles.weatherRow}>
                    <Text style={styles.weatherLabel}>☁️ MeteoSwiss Prognose</Text>
                    <Text style={styles.weatherValue}>{weatherData.temperatureForecast?.toFixed(1) ?? '--'}°C</Text>
                  </View>
                  {loxoneTemp !== null && (
                    <View style={styles.weatherRow}>
                      <Text style={styles.weatherLabel}>🏠 Loxone Sensor IST</Text>
                      <Text style={styles.weatherValue}>{loxoneTemp.toFixed(1)}°C</Text>
                    </View>
                  )}
                  <View style={[styles.weatherRow, styles.weatherRowLast]}>
                    <Text style={styles.weatherLabel}>Niederschlag</Text>
                    <Text style={styles.weatherValue}>{weatherData.precipitation.toFixed(1)} mm</Text>
                  </View>
                  <Text style={styles.weatherTimestamp}>
                    {weatherData.timestampActual && `MeteoSwiss IST: ${new Date(weatherData.timestampActual).toLocaleString('de-CH')}`}
                    {weatherData.timestampActual && weatherData.timestampForecast && '\n'}
                    {weatherData.timestampForecast && `Prognose: ${new Date(weatherData.timestampForecast).toLocaleString('de-CH')}`}
                    {loxoneTimestamp && '\n'}
                    {loxoneTimestamp && `Loxone: ${new Date(loxoneTimestamp).toLocaleString('de-CH')}`}
                  </Text>
                </View>
              )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
  },
  label: {
    ...Typography.headline,
    color: Colors.label.primary,
    marginBottom: Spacing.sm,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  input: {
    ...ComponentStyles.input,
  },
  searchLoadingIndicator: {
    position: 'absolute',
    right: Spacing.md,
    top: 12,
  },
  suggestionsContainer: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.background.primary,
    borderRadius: Layout.radius.md,
    borderWidth: Layout.border.normal,
    borderColor: Colors.separator.opaque,
    overflow: 'hidden',
  },
  suggestionsList: {
    maxHeight: 250,
  },
  suggestionItem: {
    ...ComponentStyles.listItem,
  },
  suggestionName: {
    ...Typography.body,
    color: Colors.label.primary,
    marginBottom: 2,
  },
  suggestionMeta: {
    ...Typography.caption1,
    color: Colors.label.secondary,
  },
  noResults: {
    padding: Spacing.lg,
    textAlign: 'center',
    ...Typography.body,
    color: Colors.label.tertiary,
  },
  buttonContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  weatherCard: {
    ...ComponentStyles.card,
    marginTop: Spacing.section,
  },
  weatherTitle: {
    ...Typography.title2,
    color: Colors.label.primary,
    marginBottom: Spacing.md,
  },
  weatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: Layout.border.thin,
    borderBottomColor: Colors.separator.opaque,
  },
  weatherRowLast: {
    borderBottomWidth: 0,
  },
  weatherLabel: {
    ...Typography.subheadline,
    color: Colors.label.secondary,
  },
  weatherValue: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.label.primary,
  },
  weatherTimestamp: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: Layout.border.thin,
    borderTopColor: Colors.separator.opaque,
    ...Typography.footnote,
    color: Colors.label.tertiary,
    textAlign: 'center',
  },
});
