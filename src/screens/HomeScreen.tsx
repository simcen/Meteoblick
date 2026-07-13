/**
 * HomeScreen — read-only weather display (MeteoSwiss only).
 *
 * Shows current temperature, forecast, precipitation, location name and
 * timestamps for the configured POI. The "Standort ändern" button
 * navigates to Settings > Orte where the POI can be re-configured.
 *
 * Loxone temperature is included as a secondary row when available.
 */
import { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useScrollContext } from '../contexts/ScrollContext';
import { useWeather } from '../providers/WeatherContext';
import { Typography, Spacing, Layout } from '../constants/designSystem';
import { useColors } from '../hooks/useColors';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useColors();
  const { weather: weatherData, loxoneTemp, loxoneTimestamp, isFetching: refreshing, refresh } = useWeather();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: colors.background.grouped },
        container: { flex: 1 },
        contentContainer: {
          paddingHorizontal: Spacing.screenHorizontal,
          paddingBottom: Spacing.lg,
        },
        title: { ...Typography.title2, color: colors.label.primary, marginBottom: Spacing.md },
        weatherCard: {
          backgroundColor: colors.background.primary,
          borderRadius: Layout.radius.md,
          padding: Spacing.md,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        },
        location: { ...Typography.title3, color: colors.label.primary, marginBottom: Spacing.md },
        tempRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: Spacing.md,
        },
        tempBlock: { flex: 1, alignItems: 'center' },
        tempDivider: {
          width: StyleSheet.hairlineWidth,
          backgroundColor: colors.separator.opaque,
          alignSelf: 'stretch',
          marginHorizontal: Spacing.md,
        },
        tempLabel: { ...Typography.caption1, color: colors.label.secondary, marginBottom: Spacing.xs },
        tempValue: { fontSize: 36, fontWeight: '700', color: colors.label.primary },
        detailRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: Spacing.sm,
          borderBottomWidth: Layout.border.thin,
          borderBottomColor: colors.separator.opaque,
        },
        detailRowLast: {
          // Niederschlag row: its own bottom border is dropped so the timestamp
          // borderTopWidth below becomes the single divider between them.
          borderBottomWidth: 0,
        },
        detailLabel: { ...Typography.subheadline, color: colors.label.secondary },
        detailValue: { ...Typography.body, color: colors.label.primary, fontWeight: '500' },
        timestamps: {
          ...Typography.footnote,
          color: colors.label.tertiary,
          marginTop: Spacing.md,
          paddingTop: Spacing.md,
          borderTopWidth: Layout.border.thin,
          borderTopColor: colors.separator.opaque,
          lineHeight: 18,
        },
        changeLocationButton: {
          marginTop: Spacing.lg,
          paddingVertical: Spacing.md,
          alignItems: 'center',
        },
        changeLocationText: { ...Typography.headline, color: colors.tint },
        emptyCard: {
          backgroundColor: colors.background.primary,
          borderRadius: Layout.radius.md,
          padding: Spacing.md,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        },
        emptyTitle: { ...Typography.headline, color: colors.label.primary, marginBottom: Spacing.sm },
        emptyBody: { ...Typography.subheadline, color: colors.label.secondary },
      }),
    [colors],
  );

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

  const onRefresh = async () => {
    await refresh();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Animated.ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + Layout.height.appHeader + Spacing.md },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Text style={styles.title}>Wetter</Text>

        {weatherData ? (
          <View style={styles.weatherCard}>
            <Text style={styles.location}>{weatherData.locationName}</Text>

            <View style={styles.tempRow}>
              <View style={styles.tempBlock}>
                <Text style={styles.tempLabel}>Aktuell</Text>
                <Text style={styles.tempValue}>
                  {weatherData.temperatureActual?.toFixed(1) ?? '--'}°
                </Text>
              </View>
              <View style={styles.tempDivider} />
              <View style={styles.tempBlock}>
                <Text style={styles.tempLabel}>Prognose</Text>
                <Text style={styles.tempValue}>
                  {weatherData.temperatureForecast?.toFixed(1) ?? '--'}°
                </Text>
              </View>
            </View>

            <View style={[styles.detailRow, styles.detailRowLast]}>
              <Text style={styles.detailLabel}>Niederschlag</Text>
              <Text style={styles.detailValue}>
                {weatherData.precipitation.toFixed(1)} mm
              </Text>
            </View>

            {(weatherData.timestampActual || loxoneTimestamp) && (
              <Text style={styles.timestamps}>
                {weatherData.timestampActual &&
                  `MeteoSwiss IST: ${new Date(weatherData.timestampActual).toLocaleString('de-CH')}`}
                {weatherData.timestampActual && weatherData.timestampForecast ? '\n' : ''}
                {weatherData.timestampForecast &&
                  `Prognose: ${new Date(weatherData.timestampForecast).toLocaleString('de-CH')}`}
                {loxoneTimestamp ? '\n' : ''}
                {loxoneTimestamp &&
                  `Loxone: ${new Date(loxoneTimestamp).toLocaleString('de-CH')}`}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Keine Wetterdaten</Text>
            <Text style={styles.emptyBody}>
              Wähle einen Standort in den Einstellungen, um Wetterprognosen zu sehen.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.changeLocationButton}
          onPress={() => (navigation.getParent() as any)?.navigate('Orte')}
          accessibilityRole="button"
          accessibilityLabel="Standort ändern"
          testID="change-location-button"
        >
          <Text style={styles.changeLocationText}>Standort ändern</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}