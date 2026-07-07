/**
 * AppHeader — animated gradient header with hamburger menu and centered title.
 *
 * Layout:
 *   [☰]    Meteoblick    [spacer]
 *
 * Animation:
 * - Gradient + title fade together on scroll (opacity 1 → 0).
 * - Hamburger stays visible but its color interpolates from white to the
 *   primary label color so it remains visible against the white screen
 *   content after the gradient has faded away.
 * - A white → transparent fade overlay sits in the status bar / Dynamic Island
 *   area and fades IN as scroll increases, creating a fade effect on the top
 *   edge of the screen content.
 * - A white circular background behind the hamburger fades IN on scroll.
 *
 * Positioning:
 * - Container is absolute at top: 0, height = insets.top + VISUAL_HEIGHT.
 *   The gradient extends behind the Dynamic Island.
 */
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

interface AppHeaderProps {
  scrollY: SharedValue<number>;
  title?: string;
}

const FADE_END = 80; // px of scroll at which header becomes fully transparent
const VISUAL_HEIGHT = 56; // px of the visual header area (below safe area top)
const FADE_OVERLAY_EXTRA = 24; // px the fade overlay extends below the status bar
const HAMBURGER_COLOR_LIGHT = '#FFFFFF';
const HAMBURGER_COLOR_DARK = Colors.label.primary;

export function AppHeader({ scrollY, title = 'Meteoblick' }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

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

  // Fade overlay (white → transparent) sits in the Dynamic Island area and
  // fades IN as scroll increases, creating a fade effect on the top edge of
  // the screen content as it scrolls under the status bar.
  const fadeOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // White circle behind the hamburger fades IN as scroll increases.
  const hamburgerBgStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Hamburger color transitions from white (on gradient) to dark (on white
  // screen content) as the header fades
  const hamburgerStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      scrollY.value,
      [0, FADE_END],
      [HAMBURGER_COLOR_LIGHT, HAMBURGER_COLOR_DARK],
    );
    return { color };
  });

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
          fades in on scroll. White at top → transparent at bottom. */}
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
          colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Hamburger — icon always visible and clickable. White circle is a
          separate sibling that fades in on scroll without affecting the icon
          or blocking touches. */}
      <View
        style={[styles.hamburgerSlot, { top: insets.top, height: VISUAL_HEIGHT }]}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.hamburgerBg, hamburgerBgStyle]} pointerEvents="none" />
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Menü öffnen"
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
  hamburgerBg: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
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