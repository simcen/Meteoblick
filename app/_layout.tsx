import { NavigationContainer } from '@react-navigation/native';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../src/providers/AppProvider';

import HomeScreen from '../src/screens/HomeScreen';
import SmartHomeScreen from '../src/screens/SmartHomeScreen';
import DebugScreen from '../src/screens/DebugScreen';

// Import widget to ensure Metro bundles it for expo-widgets compiler
import '../widgets/MeteoblickWidget';

const Tabs = createNativeBottomTabNavigator();

// SF Symbols for iOS (Apple HIG compliant)
// Returns a function that renders the icon with proper props
const TabBarIcon = (sfSymbolName: string) => {
  return () => ({
    sfSymbol: sfSymbolName,
  });
};

export default function RootLayout() {
  return (
    <AppProvider>
      <SafeAreaProvider>
        <NavigationContainer independent={true}>
          <Tabs.Navigator>
          <Tabs.Screen
            name="Wetter"
            component={HomeScreen}
            options={{
              title: 'Wetter',
              tabBarIcon: TabBarIcon('cloud.sun.fill'),
              tabBarAccessibilityLabel: 'Wetter-Tab',
            }}
          />
          <Tabs.Screen
            name="SmartHome"
            component={SmartHomeScreen}
            options={{
              title: 'Smart Home',
              tabBarIcon: TabBarIcon('house.fill'),
              tabBarAccessibilityLabel: 'Smart Home Tab',
            }}
          />
          <Tabs.Screen
            name="Debug"
            component={DebugScreen}
            options={{
              title: 'Debug',
              tabBarIcon: TabBarIcon('wrench.and.screwdriver.fill'),
              tabBarAccessibilityLabel: 'Debug-Tab',
            }}
          />
        </Tabs.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </AppProvider>
  );
}
