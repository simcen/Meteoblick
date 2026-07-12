// MUST be first import — gesture-handler monkey-patches internals on import.
import 'react-native-gesture-handler';

import { NavigationContainer, DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { View } from 'react-native';
import { AppProvider } from '../src/providers/AppProvider';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import type { Palette } from '../src/constants/designSystem';
import { ScrollProvider, useScrollContext } from '../src/contexts/ScrollContext';
import { AppHeader } from '../src/components/AppHeader';
import { DrawerContent } from '../src/components/DrawerContent';

import HomeScreen from '../src/screens/HomeScreen';
import SmartHomeScreen from '../src/screens/SmartHomeScreen';
import DebugScreen from '../src/screens/DebugScreen';
import SettingsScreen from '../src/screens/SettingsScreen';
import OrteScreen from '../src/screens/OrteScreen';
import LoxoneConfigScreen from '../src/screens/LoxoneConfigScreen';

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

// Stack wraps the Main screen as the default route, plus Settings, Orte,
// Loxone and Debug modals that slide in from the bottom. iOS-standard modal
// presentation shows the underlying Main screen (with header) slightly visible
// at the top.
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
      <Stack.Screen
        name="Orte"
        component={OrteScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="Loxone"
        component={LoxoneConfigScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="Debug"
        component={DebugScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
}

function Shell({ colors }: { colors: Palette }) {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: '75%',
          backgroundColor: colors.background.primary,
          // The default drawer casts a soft white drop-shadow on its right
          // edge. On real iPhone ProMotion displays this reads as a thin
          // white line during the open/close animation in dark mode.
          // Removing the shadow eliminates the flicker while keeping the
          // drawer background opaque.
          shadowColor: 'transparent',
        },
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
          <ThemeProvider>
            <ThemedShell />
          </ThemeProvider>
        </SafeAreaProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}

// ThemedShell reads the resolved theme and wires StatusBar + NavigationContainer.
// Kept separate so it can call useTheme() (which requires ThemeProvider above).
function ThemedShell() {
  const { effectiveScheme, colors } = useTheme();

  const navTheme = useMemo<Theme>(() => {
    const base = effectiveScheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: effectiveScheme === 'dark',
      colors: {
        ...base.colors,
        primary: colors.tint,
        background: colors.background.primary,
        card: colors.background.secondary,
        text: colors.label.primary,
        border: colors.separator.opaque,
        notification: colors.accent.red,
      },
    };
  }, [effectiveScheme, colors]);

  return (
    <>
      <StatusBar style={effectiveScheme === 'dark' ? 'light' : 'dark'} />
      <ScrollProvider>
        <NavigationContainer theme={navTheme}>
          <Shell colors={colors} />
        </NavigationContainer>
      </ScrollProvider>
    </>
  );
}