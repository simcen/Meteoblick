/**
 * LiquidGlassCloseButton — iOS 26 native Liquid Glass close button.
 *
 * Wraps `@callstack/liquid-glass`'s <LiquidGlassView>, which on iOS 26+
 * renders the real UIGlassEffect/UIVisualEffectView. On iOS <26 the
 * library falls back to a plain <View> (no effect, no crash); we adapt
 * the background with a translucent rgba fallback so the button remains
 * legible on older devices.
 *
 * Text uses PlatformColor('labelColor') which auto-flips light/dark when
 * rendered on the glass surface (per library README; views < 65pt tall).
 *
 * Pressed state is handled by the parent Pressable via opacity.
 */
import { Pressable, Text, StyleSheet, PlatformColor } from 'react-native';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { Spacing, Typography, Layout } from '../constants/designSystem';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  onPress: () => void;
  label?: string;
  testID?: string;
}

export function LiquidGlassCloseButton({
  onPress,
  label = 'Fertig',
  testID = 'modal-close-button',
}: Props) {
  const { effectiveScheme } = useTheme();
  const isDark = effectiveScheme === 'dark';

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <LiquidGlassView
        effect="regular"
        colorScheme={isDark ? 'dark' : 'light'}
        style={[
          styles.button,
          // On iOS < 26 the library renders a plain View. Apply a translucent
          // fallback bg so the button still reads as a glass-like pill.
          !isLiquidGlassSupported && {
            backgroundColor: isDark
              ? 'rgba(58,58,60,0.7)'
              : 'rgba(255,255,255,0.78)',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark
              ? 'rgba(255,255,255,0.22)'
              : 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        <Text style={styles.label}>{label}</Text>
      </LiquidGlassView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: Spacing.md,
    height: 36,
    minWidth: 76,
    borderRadius: Layout.radius.xl, // 20pt
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  label: {
    ...Typography.subheadline,
    fontWeight: '600',
    // PlatformColor('labelColor') flips automatically based on the glass
    // surface underneath (iOS 26+ native behavior). On iOS <26 it falls back
    // to the system default label color, which works on the rgba fallback bg.
    color: PlatformColor('labelColor'),
  },
});
