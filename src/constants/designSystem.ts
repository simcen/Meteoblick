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

export const lightColors = {
  // Background Colors
  background: {
    primary: '#FFFFFF',           // systemBackground
    secondary: '#F2F2F7',         // secondarySystemBackground
    tertiary: '#FFFFFF',          // tertiarySystemBackground
    grouped: '#F2F2F7',           // systemGroupedBackground
    groupedSecondary: '#FFFFFF', // secondarySystemGroupedBackground — used for cards on gray surfaces
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

// Palette is derived from lightColors (the source of truth) but with
// literal types widened to plain `string` and readonly modifiers stripped,
// so darkColors can be assigned values with different hex strings.
// Without this mapped type, TypeScript narrows `lightColors.background.primary`
// to the literal `"#FFFFFF"` (from `as const`) and rejects `"#000000"`.
type WidenLiteral<T> = T extends string
  ? string
  : T extends ReadonlyArray<infer U>
    ? Array<WidenLiteral<U>>
    : T extends object
      ? { -readonly [K in keyof T]: WidenLiteral<T[K]> }
      : T;
export type Palette = WidenLiteral<typeof lightColors>;

export const darkColors: Palette = {
  background: {
    primary: '#000000',           // systemBackground
    secondary: '#1C1C1E',         // secondarySystemBackground
    tertiary: '#2C2C2E',          // tertiarySystemBackground
    grouped: '#000000',           // systemGroupedBackground
    groupedSecondary: '#1C1C1E', // secondarySystemGroupedBackground — cards on dark gray
  },
  label: {
    primary: '#FFFFFF',           // label
    secondary: '#EBEBF599',       // secondaryLabel (60% opacity)
    tertiary: '#EBEBF54C',        // tertiaryLabel (30% opacity)
    quaternary: '#EBEBF528',      // quaternaryLabel (18% opacity)
  },
  fill: {
    primary: '#7878805C',         // systemFill (20% opacity)
    secondary: '#78788052',       // secondarySystemFill (16% opacity)
    tertiary: '#7676803D',        // tertiarySystemFill (12% opacity)
    quaternary: '#74748028',      // quaternarySystemFill (8% opacity)
  },
  separator: {
    opaque: '#38383A',            // separator
    nonOpaque: '#54545899',       // opaqueSeparator
  },
  tint: '#0A84FF',                // systemBlue (dark)
  gradientStart: '#58BEF6',      // Brand gradient — unchanged
  gradientEnd: '#3366CC',
  accent: {
    blue: '#0A84FF',              // systemBlue
    green: '#30D158',             // systemGreen
    red: '#FF453A',               // systemRed
    orange: '#FF9F0A',            // systemOrange
    yellow: '#FFD60A',            // systemYellow
  },
};

// (Palette type is defined above, near lightColors)

// Back-compat shim — kept so call sites that still reference `Colors.*`
// resolve to the light palette. Removed after all consumers migrate to
// `useColors()` in the dark-mode refactor.
export const Colors = lightColors;

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
  // Border Radius — Apple HIG / iOS 26 standards.
  //
  // Hierarchy (smaller elements use smaller radii for visual hierarchy):
  //   sm   =  8pt  small controls (inputs, badges, search field)
  //   md   = 12pt  medium cards (menuGroup, list rows, segmented active)
  //   lg   = 16pt  large pills & Liquid Glass buttons (modal close button,
  //                segmented control container, prominent CTA)
  //   xl   = 20pt  hero / onboarding surfaces
  //   round = 999pt capsule / circle
  //
  // Note: iOS 26 uses "continuous" squircles. RN cannot render those natively,
  // so we approximate with plain `borderRadius` of the same value.
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
