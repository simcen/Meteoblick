/**
 * Design System für Meteoblick
 *
 * Apple Human Interface Guidelines konform
 * - iOS System Colors (semantic)
 * - SF Pro Typography
 * - Standard Spacing & Layout
 * - Vorbereitet für Dark Mode
 */

import { Platform, StyleSheet } from 'react-native';

// ============================================================================
// COLORS - iOS System Colors (Semantic)
// ============================================================================

export const Colors = {
  // Background Colors
  background: {
    primary: '#FFFFFF',           // systemBackground
    secondary: '#F2F2F7',         // secondarySystemBackground
    tertiary: '#FFFFFF',          // tertiarySystemBackground
    grouped: '#F2F2F7',           // systemGroupedBackground
  },

  // Label Colors (Text)
  label: {
    primary: '#000000',           // label
    secondary: '#3C3C43',         // secondaryLabel (60% opacity)
    tertiary: '#3C3C4399',        // tertiaryLabel (30% opacity)
    quaternary: '#3C3C434D',      // quaternaryLabel (18% opacity)
  },

  // Fill Colors (Buttons, Controls)
  fill: {
    primary: '#78788033',         // systemFill (20% opacity)
    secondary: '#78788029',       // secondarySystemFill (16% opacity)
    tertiary: '#7676801F',        // tertiarySystemFill (12% opacity)
    quaternary: '#74748014',      // quaternarySystemFill (8% opacity)
  },

  // Separator Colors
  separator: {
    opaque: '#C6C6C8',            // separator
    nonOpaque: '#3C3C4349',       // opaqueSeparator
  },

  // Tint Color (Brand)
  tint: '#3366CC',                // Brand Blue

  // Header Gradient (matches widget)
  gradientStart: '#58BEF6',
  gradientEnd: '#3366CC',

  // Accent Colors
  accent: {
    blue: '#007AFF',              // systemBlue
    green: '#34C759',             // systemGreen
    red: '#FF3B30',               // systemRed
    orange: '#FF9500',            // systemOrange
    yellow: '#FFCC00',            // systemYellow
  },
} as const;

// ============================================================================
// TYPOGRAPHY - SF Pro
// ============================================================================

export const Typography = {
  // Large Titles
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700' as const,
    letterSpacing: 0.37,
  },

  // Title Levels
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: 0.36,
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: 0.35,
  },
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600' as const,
    letterSpacing: 0.38,
  },

  // Headline
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.41,
  },

  // Body
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400' as const,
    letterSpacing: -0.41,
  },

  // Callout
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400' as const,
    letterSpacing: -0.32,
  },

  // Subheadline
  subheadline: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: -0.24,
  },

  // Footnote
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    letterSpacing: -0.08,
  },

  // Caption
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '400' as const,
    letterSpacing: 0.06,
  },
} as const;

// ============================================================================
// SPACING - Apple HIG Standard
// ============================================================================

export const Spacing = {
  xs: 4,      // Extra small spacing
  sm: 8,      // Small spacing
  md: 16,     // Medium spacing (standard)
  lg: 20,     // Large spacing
  xl: 24,     // Extra large spacing
  xxl: 32,    // Double extra large spacing

  // Screen padding (horizontal)
  screenHorizontal: 16,

  // Screen padding (vertical)
  screenVertical: 16,

  // Section spacing
  section: 24,

  // Component spacing
  component: 12,
} as const;

// ============================================================================
// LAYOUT - Sizes & Dimensions
// ============================================================================

export const Layout = {
  // Border Radius
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    round: 999,
  },

  // Border Width
  border: {
    thin: StyleSheet.hairlineWidth,
    normal: 1,
    thick: 2,
  },

  // Component Heights
  height: {
    button: 50,
    input: 44,
    listItem: 44,
    headerLarge: 96,
    headerRegular: 44,
    appHeader: 56,
  },

  // Safe Area (for consistent insets)
  safeArea: {
    top: Platform.OS === 'ios' ? 0 : 20,
    bottom: Platform.OS === 'ios' ? 0 : 0,
  },
} as const;

// ============================================================================
// SHADOWS - iOS Standard
// ============================================================================

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

// ============================================================================
// COMPONENT STYLES - Reusable
// ============================================================================

export const ComponentStyles = {
  // Card Style
  card: {
    backgroundColor: Colors.background.primary,
    borderRadius: Layout.radius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },

  // Input Style
  input: {
    height: Layout.height.input,
    backgroundColor: Colors.background.secondary,
    borderRadius: Layout.radius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.body.fontSize,
    color: Colors.label.primary,
    borderWidth: Layout.border.thin,
    borderColor: Colors.separator.opaque,
  },

  // Button Primary
  buttonPrimary: {
    height: Layout.height.button,
    backgroundColor: Colors.tint,
    borderRadius: Layout.radius.md,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    ...Shadows.sm,
  },

  // Button Secondary
  buttonSecondary: {
    height: Layout.height.button,
    backgroundColor: Colors.fill.secondary,
    borderRadius: Layout.radius.md,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },

  // List Item
  listItem: {
    minHeight: Layout.height.listItem,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: Layout.border.thin,
    borderBottomColor: Colors.separator.opaque,
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create text style with color
 */
export const createTextStyle = (
  typography: keyof typeof Typography,
  color: string = Colors.label.primary
) => ({
  ...Typography[typography],
  color,
});

/**
 * Create spacing style (margin or padding)
 */
export const createSpacing = (
  type: 'margin' | 'padding',
  values: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    horizontal?: number;
    vertical?: number;
    all?: number;
  }
) => {
  const prefix = type === 'margin' ? 'margin' : 'padding';

  if (values.all !== undefined) {
    return { [prefix]: values.all };
  }

  return {
    ...(values.top !== undefined && { [`${prefix}Top`]: values.top }),
    ...(values.right !== undefined && { [`${prefix}Right`]: values.right }),
    ...(values.bottom !== undefined && { [`${prefix}Bottom`]: values.bottom }),
    ...(values.left !== undefined && { [`${prefix}Left`]: values.left }),
    ...(values.horizontal !== undefined && {
      [`${prefix}Left`]: values.horizontal,
      [`${prefix}Right`]: values.horizontal,
    }),
    ...(values.vertical !== undefined && {
      [`${prefix}Top`]: values.vertical,
      [`${prefix}Bottom`]: values.vertical,
    }),
  };
};
