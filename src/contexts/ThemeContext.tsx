/**
 * ThemeContext — resolves the active color palette from user preference +
 * OS color scheme.
 *
 * - Preference is `'system' | 'light' | 'dark'`, persisted via AsyncStorage.
 * - `effectiveScheme` is the resolved light/dark value:
 *   - preference === 'system' → follows the OS color scheme
 *   - otherwise → matches preference
 * - `colors` is the resolved Palette (`lightColors` or `darkColors`).
 * - On mount, preference is hydrated from AsyncStorage. Until then, the
 *   app boots with the default `'system'` — a ≤1-frame flash is acceptable.
 * - We read `Appearance.getColorScheme()` directly into state at init AND
 *   subscribe via `Appearance.addChangeListener`. This is more reliable
 *   than `useColorScheme()` alone in some setups (notably when the iOS
 *   native traitCollection is locked by an old build's Info.plist and only
 *   flips after we re-read Appearance). The subscription explicitly calls
 *   `setSystemScheme` on every change so the provider re-renders even if
 *   React doesn't pick up the hook update.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { lightColors, darkColors, Palette } from '../constants/designSystem';
import { SharedStorage, ThemePreference } from '../storage/SharedStorage';

interface ThemeContextValue {
  preference: ThemePreference;
  effectiveScheme: 'light' | 'dark';
  colors: Palette;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Normalize Appearance's `'light' | 'dark' | null | undefined` to our
// `'light' | 'dark'`. null/undefined typically means "system hasn't reported
// yet" — treat as light.
function normalize(scheme: ColorSchemeName | null | undefined): 'light' | 'dark' {
  return scheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Read the OS scheme synchronously via state initializer so the very first
  // render has the right effectiveScheme (no flash of light when the device
  // was already in dark mode).
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() =>
    normalize(Appearance.getColorScheme()),
  );
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Subscribe to OS color scheme changes. Some RN versions / native bridges
  // don't fire `useColorScheme()` updates reliably, so we read Appearance
  // directly and force a re-render via state.
  useEffect(() => {
    const sub = Appearance.addChangeListener((appearance) => {
      // `appearance.colorScheme` may be null/undefined on first read.
      setSystemScheme(normalize(appearance?.colorScheme ?? null));
    });
    return () => sub.remove();
  }, []);

  // Hydrate persisted preference on mount.
  useEffect(() => {
    let cancelled = false;
    SharedStorage.getThemePreference().then((stored) => {
      if (!cancelled) setPreferenceState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    // Fire-and-forget: persistence errors are logged inside setThemePreference.
    void SharedStorage.setThemePreference(p);
  }, []);

  const effectiveScheme: 'light' | 'dark' =
    preference === 'system' ? systemScheme : preference;

  const colors = useMemo(
    () => (effectiveScheme === 'dark' ? darkColors : lightColors),
    [effectiveScheme],
  );

  const value = useMemo(
    () => ({ preference, effectiveScheme, colors, setPreference }),
    [preference, effectiveScheme, colors, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
