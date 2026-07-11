/**
 * AppHeader — animated gradient header with hamburger menu and centered title.
 *
 * Layout:
 *   [☰]    Meteoblick    [spacer]
 *
 * Animation:
 * - Gradient + title fade together on scroll (opacity 1 → 0).
 * - Hamburger stays visible but its color interpolates from white to the
 *   theme-aware primary label color so it remains visible against the
 *   screen content after the gradient has faded away.
 * - A theme-background fade overlay sits in the status bar / Dynamic Island
 *   area and fades IN as scroll increases, creating a fade effect on the top
 *   edge of the screen content.
 * - A circular puck behind the hamburger fades IN on scroll; its color
 *   matches the current theme so it provides contrast against any content.
 *
 * Theme awareness:
 * - Hamburger interpolation target reads `colors.label.primary` via closure.
 *   When the theme changes, the worklet is re-evaluated with the new value.
 * - Fade overlay and puck colors are theme-aware via inline styles.
 * - The brand gradient and title color stay fixed (gradient is identical
 *   across light/dark and white text reads well on it).
 *
 * Positioning:
 * - Container is absolute at top: 0, height = insets.top + VISUAL_HEIGHT.
 *   The gradient extends behind the Dynamic Island.
 */
import { useMemo } from 'react';
import { StyleSheet, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  interpolateColor,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { Colors, Spacing, Typography } from '../constants/designSystem';
import { useColors } from '../hooks/useColors';

interface AppHeaderProps {
  scrollY: SharedValue<number>;
  title?: string;
}

const FADE_END = 80; // px of scroll at which header becomes fully transparent
const VISUAL_HEIGHT = 56; // px of the visual header area (below safe area top)
const FADE_OVERLAY_EXTRA = 24; // px the fade overlay extends below the status bar
// Hamburger icon at scrollY=0 sits on the brand gradient (identical in both modes),
// so white is correct regardless of theme.
const HAMBURGER_COLOR_LIGHT = '#FFFFFF';

export function AppHeader({ scrollY, title = 'Meteoblick' }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useColors();

  // Fades the gradient + title together
  const fadeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, FADE_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Fade overlay sits in the Dynamic Island area and fades IN as scroll
  // increases. Color matches the theme background so it adapts to light/dark.
  const fadeOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Hamburger puck fades IN as scroll increases. Bg color is theme-aware.
  const hamburgerBgStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Hamburger color transitions from white (on gradient) to the theme-aware
  // primary label color (on screen content). The worklet captures `colors`
  // via closure; re-renders on theme change rebuild the worklet with the new value.
  const hamburgerStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      scrollY.value,
      [0, FADE_END],
      [HAMBURGER_COLOR_LIGHT, colors.label.primary],
    );
    return { color };
  });

  // Fade-overlay gradient: theme background at top → transparent at bottom.
  const fadeOverlayColors = useMemo(
    () => [`${colors.background.primary}FF`, `${colors.background.primary}00`] as const,
    [colors.background.primary],
  );

  const totalHeight = insets.top + VISUAL_HEIGHT;

  return (
    <Animated.View
      style={[styles.container, { height: totalHeight }]}
      pointerEvents="box-none"
    >
      {/* Animated layer: gradient + title fade together */}
      <Animated.View style={[styles.animatedLayer, fadeStyle]} pointerEvents="box-none">
        <View style={styles.gradientLayer} pointerEvents="none">
          <LinearGradient
            colors={[Colors.gradientStart, Colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={[styles.titleRow, { top: insets.top, height: VISUAL_HEIGHT }]} pointerEvents="box-none">
          <View style={styles.row} pointerEvents="box-none">
            <View style={styles.sideSlot} />
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.sideSlot} />
          </View>
        </View>
      </Animated.View>

      {/* Fade overlay — sits at the top covering the Dynamic Island area,
          fades in on scroll. Theme-background → transparent. */}
      <Animated.View
        style={[
          styles.fadeOverlay,
          {
            top: 0,
            height: insets.top + FADE_OVERLAY_EXTRA,
          },
          fadeOverlayStyle,
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={fadeOverlayColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Hamburger — icon always visible and clickable. Theme-aware puck
          fades in on scroll without affecting the icon or blocking touches. */}
      <View
        style={[styles.hamburgerSlot, { top: insets.top, height: VISUAL_HEIGHT }]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.hamburgerBg,
            { backgroundColor: colors.background.primary },
            hamburgerBgStyle,
          ]}
          pointerEvents="none"
        />
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Menü öffnen"
          testID="hamburger-menu"
          style={styles.hamburgerButton}
        >
          <Animated.Text style={[styles.hamburgerIcon, hamburgerStyle]}>☰</Animated.Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  animatedLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  gradientLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  titleRow: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  fadeOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  sideSlot: {
    width: 44,
  },
  title: {
    ...Typography.headline,
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  hamburgerSlot: {
    position: 'absolute',
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44 + Spacing.md,
    paddingLeft: Spacing.md,
  },
  // White circle positioned to be centered on the 32x32 button.
  // Slot content area center: x = Spacing.md (16) + (44-32)/2 + 16 = 38,
  // y = VISUAL_HEIGHT/2 = 28. Circle (40x40) → left=18, top=8.
  // backgroundColor is applied inline (theme-aware); shadow stays dark in both modes.
  hamburgerBg: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    left: 18,
    top: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  hamburgerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerIcon: {
    fontSize: 22,
    lineHeight: 24,
  },
});