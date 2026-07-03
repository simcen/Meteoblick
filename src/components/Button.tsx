import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Typography, Layout, Shadows } from '../constants/designSystem';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'text';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/**
 * Modern iOS-style Button Component
 *
 * Apple HIG konform:
 * - 50pt Höhe (minimum touch target)
 * - System Colors
 * - Subtle Shadow
 * - Disabled State
 */
export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const buttonStyle = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'text' && styles.text,
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
    style,
  ];

  const textStyleCombined = [
    styles.baseText,
    variant === 'primary' && styles.primaryText,
    variant === 'secondary' && styles.secondaryText,
    variant === 'text' && styles.textText,
    (disabled || loading) && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.background.primary : Colors.tint}
        />
      ) : (
        <Text style={textStyleCombined}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: Layout.height.button,
    borderRadius: Layout.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  // Primary Variant (Tinted)
  primary: {
    backgroundColor: Colors.tint,
    ...Shadows.sm,
  },
  primaryText: {
    color: Colors.background.primary,
    ...Typography.headline,
  },

  // Secondary Variant (Gray Fill)
  secondary: {
    backgroundColor: Colors.fill.secondary,
  },
  secondaryText: {
    color: Colors.label.primary,
    ...Typography.headline,
  },

  // Text Variant (No Background)
  text: {
    backgroundColor: 'transparent',
  },
  textText: {
    color: Colors.tint,
    ...Typography.headline,
  },

  // Full Width
  fullWidth: {
    width: '100%',
  },

  // Disabled State
  disabled: {
    opacity: 0.4,
  },
  disabledText: {
    opacity: 1, // Keep text opaque, button itself is faded
  },

  // Base Text
  baseText: {
    ...Typography.headline,
  },
});
