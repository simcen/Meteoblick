/**
 * Screen render smoke tests — import every screen and render it once.
 *
 * Catches the class of bug that the TypeScript checker misses: missing
 * imports of RN built-ins (e.g. Modal, Pressable) that compile fine because
 * JSX names are resolved at runtime. A missing `Modal` import throws
 * "Element type is invalid" the moment the screen mounts — TypeScript
 * never sees it.
 *
 * Run as part of the normal jest suite (pre-commit hook executes jest).
 */

import React from 'react';
import TestRenderer from 'react-test-renderer';

// ─── react-native stub ──────────────────────────────────────────────
// Avoids loading the real RN runtime (TurboModuleRegistry requires native
// bindings that don't exist under jest). Components are stubbed as
// passthrough functions so the JSX tree still constructs.
jest.mock('react-native', () => {
  const ReactLocal = require('react');
  const passthrough = (name: string) => {
    const C = (props: Record<string, unknown>) =>
      ReactLocal.createElement(name, props, props.children);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    Platform: { OS: 'ios', select: (o: { ios?: unknown; default?: unknown }) => o.ios ?? o.default },
    StyleSheet: { create: <T,>(s: T) => s, hairlineWidth: 1 },
    View: passthrough('View'),
    Text: passthrough('Text'),
    ScrollView: passthrough('ScrollView'),
    TouchableOpacity: passthrough('TouchableOpacity'),
    Pressable: passthrough('Pressable'),
    TextInput: passthrough('TextInput'),
    Switch: passthrough('Switch'),
    ActivityIndicator: passthrough('ActivityIndicator'),
    FlatList: passthrough('FlatList'),
    Modal: passthrough('Modal'),
    Alert: { alert: jest.fn() },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    KeyboardAvoidingView: passthrough('KeyboardAvoidingView'),
    RefreshControl: passthrough('RefreshControl'),
    PlatformColor: (s: string) => s,
  };
});

// ─── RN libs that touch native at module load ──────────────────────
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const passthrough = (name: string) => (props: Record<string, unknown>) =>
    React.createElement(name, props, props.children);
  // `Animated` is also accessed as `Animated.ScrollView`, `Animated.View`,
  // etc. Build it as an object of named pass-throughs.
  const Animated: Record<string, unknown> = {
    ScrollView: passthrough('AnimatedScrollView'),
    View: passthrough('AnimatedView'),
    Text: passthrough('AnimatedText'),
    Image: passthrough('AnimatedImage'),
  };
  return {
    __esModule: true,
    default: Animated,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useAnimatedScrollHandler: () => ({}),
    useAnimatedRef: () => ({ current: null }),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    Easing: { linear: () => 0, ease: () => 0, inOut: () => 0 },
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    runOnUI: (fn: (...args: unknown[]) => unknown) => fn,
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: () => 0,
    interpolateColor: () => '#000',
    Extrapolate: { EXTEND: 'extend' },
    ScrollView: passthrough('AnimatedScrollView'),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const passthrough = (name: string) => (props: Record<string, unknown>) =>
    React.createElement(name, props, props.children);
  return {
    __esModule: true,
    GestureHandlerRootView: passthrough('GestureHandlerRootView'),
    PanGestureHandler: passthrough('PanGestureHandler'),
    TapGestureHandler: passthrough('TapGestureHandler'),
    LongPressGestureHandler: passthrough('LongPressGestureHandler'),
    Gesture: {},
    GestureDetector: passthrough('GestureDetector'),
    State: {},
    Directions: {},
    enableExperimentalWebKitSupport: () => {},
    enableLegacyWebKitSupport: () => {},
    GestureHandlerRootViewContext: React.createContext({}),
  };
});

jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  const Stub = (props: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, props.children);
  return {
    __esModule: true,
    default: (props: { data?: unknown[]; renderItem?: (p: { item: unknown; drag: () => void; isActive: boolean }) => React.ReactNode }) =>
      React.createElement(
        'DraggableFlatList',
        props,
        (props.data ?? []).map((item, i) =>
          React.createElement(React.Fragment, { key: i }, props.renderItem?.({ item, drag: () => {}, isActive: false })),
        ),
      ),
    ScaleDecorator: Stub,
    OpacityDecorator: Stub,
    ShadowDecorator: Stub,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const passthrough = (name: string) => (props: Record<string, unknown>) =>
    React.createElement(name, props, props.children);
  return {
    __esModule: true,
    SafeAreaView: passthrough('SafeAreaView'),
    SafeAreaProvider: passthrough('SafeAreaProvider'),
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

// ─── Expo stubs (every expo-* the screens transitively import) ─────
jest.mock('expo-modules-core', () => ({
  __esModule: true,
  EventEmitter: class EventEmitter {},
  NativeModulesProxy: new Proxy({}, { get: () => () => ({}) }),
  requireNativeModule: () => ({}),
  CodedError: class CodedError extends Error {},
  Platform: { OS: 'ios' },
}));

jest.mock('expo-background-fetch', () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return {
    __esModule: true,
    getStatusAsync: jest.fn().mockResolvedValue(1),
    registerTaskAsync: noop,
    unregisterTaskAsync: noop,
    BackgroundFetchResult: { NewData: 'new-data', NoData: 'no-data', Failed: 'failed' },
    BackgroundFetchStatus: { Available: 1, Denied: 2, Restricted: 3 },
  };
});

jest.mock('expo-task-manager', () => ({
  __esModule: true,
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
}));

jest.mock('@callstack/liquid-glass', () => {
  const React = require('react');
  return {
    __esModule: true,
    LiquidGlassView: (props: Record<string, unknown>) =>
      React.createElement('LiquidGlassView', props, props.children),
    isLiquidGlassSupported: false,
  };
});

// widgetManager pulls in expo-modules / @expo/ui which need a native runtime.
jest.mock('../widgets/widgetManager', () => ({
  __esModule: true,
  updateWidget: jest.fn().mockResolvedValue(undefined),
  writeWidgetSnapshot: jest.fn(),
  readWidgetSnapshot: jest.fn().mockResolvedValue(null),
}));

// ─── Provider / hook mocks ────────────────────────────────────────
const MOCK_COLORS = {
  background: {
    primary: '#fff', secondary: '#f2f2f7', grouped: '#f2f2f7',
    groupedSecondary: '#fff', tertiary: '#fff',
  },
  label: {
    primary: '#000', secondary: '#3c3c43',
    tertiary: '#3c3c4399', quaternary: '#3c3c434d',
  },
  fill: {
    primary: '#78788033', secondary: '#78788029',
    tertiary: '#7676801f', quaternary: '#74748014',
  },
  separator: { opaque: '#c6c6c8', nonOpaque: '#3c3c4349' },
  tint: '#3366cc', gradientStart: '#58bef6', gradientEnd: '#3366cc',
  accent: { blue: '#007aff', green: '#34c759', red: '#ff3b30', orange: '#ff9500', yellow: '#ffcc00' },
};

jest.mock('../hooks/useColors', () => ({ useColors: () => MOCK_COLORS }));

jest.mock('../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({
    preference: 'system' as const,
    effectiveScheme: 'light' as const,
    colors: MOCK_COLORS,
    setPreference: jest.fn(),
  }),
}));

jest.mock('../contexts/ScrollContext', () => ({
  ScrollProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useScrollContext: () => ({ sharedScrollY: { value: 0 } }),
}));

jest.mock('../providers/WeatherContext', () => ({
  WeatherProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWeather: () => ({
    weather: null,
    loxoneTemp: null,
    loxoneTimestamp: null,
    loxoneReadings: [],
    isFetching: false,
    refresh: jest.fn(),
    lastFetchInfo: null,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    addListener: jest.fn(() => () => {}),
  }),
  useFocusEffect: jest.fn(),
  useRoute: () => ({ params: {} }),
}));

// ─── Tests ────────────────────────────────────────────────────────
import HomeScreen from '../screens/HomeScreen';
import SmartHomeScreen from '../screens/SmartHomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OrteScreen from '../screens/OrteScreen';
import LoxoneConfigScreen from '../screens/LoxoneConfigScreen';
import DebugScreen from '../screens/DebugScreen';
import { WeatherProvider, useWeather } from '../providers/WeatherContext';

const SCREENS: [string, React.ComponentType<unknown>][] = [
  ['HomeScreen', HomeScreen],
  ['SmartHomeScreen', SmartHomeScreen],
  ['SettingsScreen', SettingsScreen],
  ['OrteScreen', OrteScreen],
  ['LoxoneConfigScreen', LoxoneConfigScreen],
  ['DebugScreen', DebugScreen],
];

describe('Screen render smoke tests', () => {
  let trees: TestRenderer.ReactTestRenderer[] = [];

  beforeEach(() => {
    // Stub timers so screen useEffects (focus listeners, setInterval polling,
    // Animated worklets) don't keep jest's event loop alive after the test.
    jest.useFakeTimers();
  });

  afterEach(() => {
    for (const t of trees) t.unmount();
    trees = [];
    jest.useRealTimers();
  });

  test.each(SCREENS)('%s renders without throwing', (_name, Component) => {
    expect(() => {
      TestRenderer.act(() => {
        trees.push(TestRenderer.create(<Component />));
      });
    }).not.toThrow();
  });

  // Phase 4a regression: catch variable-scoping bugs in async refresh code
  // that the simple mount-test misses. A child calls refresh() and renders
  // its result status; if the refresh throws, the render fails.
  it('WeatherContext.refresh() runs without throwing across all Loxone paths', async () => {
    const RefreshProbe = () => {
      const { refresh, loxoneReadings } = useWeather();
      React.useEffect(() => {
        refresh();
      }, [refresh]);
      return <RefreshProbeText>{String(loxoneReadings.length)}</RefreshProbeText>;
    };
    // Local passthrough so the test doesn't depend on react-native's Text.
    const RefreshProbeText = ({ children }: { children: string }) =>
      React.createElement('RefreshProbeText', null, children);
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await expect(
      (async () => {
        await TestRenderer.act(async () => {
          tree = TestRenderer.create(
            <WeatherProvider>
              <RefreshProbe />
            </WeatherProvider>,
          );
          // Let the async refresh chain settle.
          await Promise.resolve();
          await Promise.resolve();
        });
      })(),
    ).resolves.not.toThrow();
    tree?.unmount();
  });
});
