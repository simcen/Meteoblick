/**
 * useColors — convenience hook returning the resolved color palette
 * for the current theme. Re-exports `useTheme().colors`.
 */
import type { Palette } from '../constants/designSystem';
import { useTheme } from '../contexts/ThemeContext';

export function useColors(): Palette {
  return useTheme().colors;
}