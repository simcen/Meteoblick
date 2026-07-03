import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerBackgroundFetch } from '../src/tasks/weatherBackgroundTask';

import HomeScreen from '../src/screens/HomeScreen';
import SmartHomeScreen from '../src/screens/SmartHomeScreen';
import DebugScreen from '../src/screens/DebugScreen';

const Tabs = createNativeBottomTabNavigator();

export default function RootLayout() {
  useEffect(() => {
    registerBackgroundFetch();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer independent={true}>
        <Tabs.Navigator>
          <Tabs.Screen
            name="Wetter"
            component={HomeScreen}
            options={{
              title: 'Wetter',
            }}
          />
          <Tabs.Screen
            name="SmartHome"
            component={SmartHomeScreen}
            options={{
              title: 'Smart Home',
            }}
          />
          <Tabs.Screen
            name="Debug"
            component={DebugScreen}
            options={{
              title: 'Debug',
            }}
          />
        </Tabs.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
