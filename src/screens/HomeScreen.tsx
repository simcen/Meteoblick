import { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Button, Alert, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SharedStorage } from '../storage/SharedStorage';
import { MeteoSwissAPI } from '../api/meteoswiss';
import { NativeModules } from 'react-native';

const { WidgetReloadBridge } = NativeModules;
import type { WeatherData } from '../types/weather';
import type { POI } from '../types/poi';

const BUILD_NUMBER = '260703-1332';

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

      // Fetch weather data from API (this caches it in SharedStorage)
      await fetchWeatherData(selectedPOI.id);

      // Force widget reload - widget reads from SharedStorage
      console.log('🔄 Calling WidgetReloadBridge.reloadAllTimelines()');
      if (WidgetReloadBridge) {
        WidgetReloadBridge.reloadAllTimelines();
        console.log('✅ Widget reload triggered');
      } else {
        console.warn('❌ WidgetReloadBridge not available');
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
                      >
                        <Text style={styles.suggestionName}>{item.name}</Text>
                        <Text style={styles.suggestionId}>POI {item.id}</Text>
                      </TouchableOpacity>
                    )}
                    style={styles.suggestionsList}
                    keyboardShouldPersistTaps="handled"
                  />
                </View>
              )}

          <View style={styles.buttonContainer}>
            {loading ? (
              <ActivityIndicator size="small" />
            ) : (
              <Button
                title="Speichern & Wetter laden"
                onPress={handleSave}
                disabled={!searchQuery.trim()}
              />
            )}
          </View>

              {weatherData && (
                <View style={styles.weatherContainer}>
                  <Text style={styles.weatherTitle}>Aktuelle Wetterdaten</Text>
                  <View style={styles.weatherRow}>
                    <Text style={styles.weatherLabel}>POI:</Text>
                    <Text style={styles.weatherValue}>{weatherData.location}</Text>
                  </View>
                  <View style={styles.weatherRow}>
                    <Text style={styles.weatherLabel}>Temperatur:</Text>
                    <Text style={styles.weatherValue}>{weatherData.temperature.toFixed(1)}°C</Text>
                  </View>
                  <View style={styles.weatherRow}>
                    <Text style={styles.weatherLabel}>Symbol Code:</Text>
                    <Text style={styles.weatherValue}>{weatherData.symbolCode}</Text>
                  </View>
                  <View style={styles.weatherRow}>
                    <Text style={styles.weatherLabel}>Niederschlag:</Text>
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
    backgroundColor: '#fff',
  },
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  searchContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  searchLoadingIndicator: {
    position: 'absolute',
    right: 12,
    top: 10,
  },
  suggestionsContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  debugText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  suggestionsList: {
    maxHeight: 250,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  suggestionId: {
    fontSize: 12,
    color: '#999',
  },
  noResults: {
    padding: 20,
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  buttonContainer: {
    marginTop: 16,
    minHeight: 40,
    justifyContent: 'center',
  },
  weatherContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  weatherTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  weatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  weatherLabel: {
    fontSize: 14,
    color: '#666',
  },
  weatherValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  weatherTimestamp: {
    marginTop: 12,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
