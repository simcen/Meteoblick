import { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Alert, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { updateWidget } from '../widgets/widgetManager';
import { Button } from '../components/Button';
import { Colors, Typography, Spacing, Layout, ComponentStyles } from '../constants/designSystem';
import type { WeatherData } from '../types/weather';
import type { POI } from '../types/poi';

const BUILD_NUMBER = '260703-1400';

export default function HomeScreen() {
  const [pointId, setPointId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [poiList, setPoiList] = useState<POI[]>([]);
  const [loadingPOIs, setLoadingPOIs] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    loadData();

    // Initial weather fetch if POI is set
    const initialFetch = async () => {
      const storedPoi = await SharedStorage.getPointId();
      if (storedPoi) {
        await fetchWeatherData(storedPoi);
      }
    };
    initialFetch();

    // Auto-refresh weather data every 5 minutes
    const weatherInterval = setInterval(async () => {
      const storedPoi = await SharedStorage.getPointId();
      if (storedPoi) {
        console.log('[App] Auto-refreshing weather data...');
        await fetchWeatherData(storedPoi);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(weatherInterval);
    };
  }, []);

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
  };

  const fetchWeatherData = async (poiId: string): Promise<WeatherData | null> => {
    try {
      const weather = await MeteoSwissAPI.fetchWeatherData(poiId);
      await SharedStorage.setWeatherData(weather);
      setWeatherData(weather);
      return weather;
    } catch (error) {
      console.error('Failed to fetch weather data:', error);
      return null;
    }
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
          temperature: weather.temperature,
          symbolCode: weather.symbolCode,
          precipitation: weather.precipitation,
          buildNumber: BUILD_NUMBER,
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
        <View style={styles.container}>
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
                    <Text style={styles.weatherLabel}>Temperatur</Text>
                    <Text style={styles.weatherValue}>{weatherData.temperature.toFixed(1)}°C</Text>
                  </View>
                  <View style={[styles.weatherRow, styles.weatherRowLast]}>
                    <Text style={styles.weatherLabel}>Niederschlag</Text>
                    <Text style={styles.weatherValue}>{weatherData.precipitation.toFixed(1)} mm</Text>
                  </View>
                  <Text style={styles.weatherTimestamp}>
                    Aktualisiert: {new Date(weatherData.timestamp).toLocaleString('de-CH')}
                  </Text>
                </View>
              )}
        </View>
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
    padding: Spacing.screenHorizontal,
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
