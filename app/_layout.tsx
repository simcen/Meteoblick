// MUST be first import — gesture-handler monkey-patches internals on import.
import 'react-native-gesture-handler';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View } from 'react-native';
import { AppProvider } from '../src/providers/AppProvider';
import { ScrollProvider, useScrollContext } from '../src/contexts/ScrollContext';
import { AppHeader } from '../src/components/AppHeader';
import { DrawerContent } from '../src/components/DrawerContent';

import HomeScreen from '../src/screens/HomeScreen';
import SmartHomeScreen from '../src/screens/SmartHomeScreen';
import DebugScreen from '../src/screens/DebugScreen';
import SettingsScreen from '../src/screens/SettingsScreen';

// Import widget to ensure Metro bundles it for expo-widgets compiler
import '../widgets/MeteoblickWidget';

const Tabs = createNativeBottomTabNavigator();
const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

// SF Symbols for iOS (Apple HIG compliant)
const TabBarIcon = (sfSymbolName: string) => {
  return () => ({
    sfSymbol: sfSymbolName,
  });
};

function TabNavigator() {
  return (
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
  );
}

// Main screen wraps the bottom tabs with the AppHeader above. The header is
// part of this screen so it's covered by the Drawer overlay when opened, and
// remains visible behind the Settings modal as part of the underlying screen.
function MainScreen() {
  const { sharedScrollY } = useScrollContext();
  return (
    <View style={{ flex: 1 }}>
      <AppHeader scrollY={sharedScrollY} />
      <TabNavigator />
    </View>
  );
}

// Stack wraps the Main screen as the default route, plus a Settings modal that
// slides in from the bottom. iOS-standard modal presentation shows the
// underlying Main screen (with header) slightly visible at the top.
function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainScreen} />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
}

function Shell() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerStyle: { width: '75%' },
      }}
      drawerContent={(props) => <DrawerContent {...props} />}
    >
      <Drawer.Screen name="Main" component={MainStack} />
    </Drawer.Navigator>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <SafeAreaProvider>
          <ScrollProvider>
            <NavigationContainer>
              <Shell />
            </NavigationContainer>
          </ScrollProvider>
        </SafeAreaProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}