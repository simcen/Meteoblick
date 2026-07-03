import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SmartHomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={styles.title}>Smart Home</Text>
        <Text style={styles.subtitle}>Verfügbar in Version 2</Text>
        <Text style={styles.description}>
          Hier werden künftig Messwerte aus deinem Smart Home angezeigt:
        </Text>
        <View style={styles.featureList}>
          <Text style={styles.featureItem}>• Aussentemperatur</Text>
          <Text style={styles.featureItem}>• Niederschlagssensor (optional)</Text>
          <Text style={styles.featureItem}>• Weitere Sensordaten</Text>
        </View>
        <Text style={styles.integration}>
          Geplante Integration: Home Assistant / Loxone
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 32,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  featureList: {
    alignSelf: 'stretch',
    paddingHorizontal: 40,
    marginBottom: 32,
  },
  featureItem: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
  },
  integration: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});
