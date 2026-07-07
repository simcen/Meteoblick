/**
 * AppHeader — animated gradient header with hamburger menu and centered title.
 *
 * Layout:
 *   [☰]    Meteoblick    [spacer]
 *
 * Positioning:
 * - Container is absolute at top: insets.top so the header sits BELOW the
 *   status bar / Dynamic Island, not behind it.
 * - All visual layers use absoluteFill inside the container — gradient fills
 *   the visual header area only (not the status bar area).
 * - Hamburger + title are vertically centered in the visual header area.
 *
 * - Title + gradient fade together on scroll (opacity 1 → 0) via shared scrollY.
 * - Hamburger stays visible always and dispatches DrawerActions.toggleDrawer().
 */
import { StyleSheet, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
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

export function AppHeader({ scrollY, title = 'Meteoblick' }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Animates only the title — gradient stays full opacity at the top so the
  // status bar / Dynamic Island area is always covered.
  const titleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, FADE_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  const totalHeight = insets.top + VISUAL_HEIGHT;

  return (
    <Animated.View
      style={[styles.container, { height: totalHeight }]}
      pointerEvents="box-none"
    >
      {/* Full-bleed gradient — covers status bar + visual header area, never fades */}
      <View style={styles.gradientLayer} pointerEvents="none">
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Title row — vertically centered in the visual header area (below status bar) */}
      <Animated.View
        style={[
          styles.titleRow,
          { top: insets.top, height: VISUAL_HEIGHT },
          titleAnimatedStyle,
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.row} pointerEvents="box-none">
          <View style={styles.sideSlot} />
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.sideSlot} />
        </View>
      </Animated.View>

      {/* Hamburger — always visible, vertically centered in the visual header area */}
      <View
        style={[styles.hamburgerSlot, { top: insets.top, height: VISUAL_HEIGHT }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Menü öffnen"
          style={styles.hamburgerButton}
        >
          <Text style={styles.hamburgerIcon}>☰</Text>
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
  hamburgerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    lineHeight: 24,
  },
});