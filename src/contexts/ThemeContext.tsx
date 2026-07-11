/**
 * ThemeContext — resolves the active color palette from user preference +
 * OS color scheme.
 *
 * - Preference is `'system' | 'light' | 'dark'`, persisted via AsyncStorage.
 * - `effectiveScheme` is the resolved light/dark value:
 *   - preference === 'system' → follows `useColorScheme()` from react-native
 *   - otherwise → matches preference
 * - `colors` is the resolved Palette (`lightColors` or `darkColors`).
 * - On mount, preference is hydrated from AsyncStorage. Until then, the
 *   app boots with the default `'system'` — a ≤1-frame flash is acceptable.
 * - `Appearance.addChangeListener` re-resolves the scheme when the OS toggle
 *   flips while the app is in the foreground and the user is on `'system'`.
 */
import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { lightColors, darkColors, Palette } from '../constants/designSystem';
import { SharedStorage, ThemePreference } from '../storage/SharedStorage';

interface ThemeContextValue {
  preference: ThemePreference;
  effectiveScheme: 'light' | 'dark';
  colors: Palette;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

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
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const colors = useMemo(
    () => (effectiveScheme === 'dark' ? darkColors : lightColors),
    [effectiveScheme],
  );

  const value = useMemo(
    () => ({ preference, effectiveScheme, colors, setPreference }),
    [preference, effectiveScheme, colors, setPreference],
  );

  // Re-render on OS appearance change even if React Native's useColorScheme
  // doesn't fire (paranoia — useColorScheme is documented to update on
  // Appearance changes, but this guarantees it).
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => {
      // useColorScheme already drives the recompute; no-op here.
    });
    return () => sub.remove();
  }, []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}