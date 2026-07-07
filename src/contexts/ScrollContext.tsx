/**
 * ScrollContext — single SharedValue<number> shared between the focused screen
 * and the AppHeader. Each screen's useAnimatedScrollHandler writes the current
 * scroll offset into `sharedScrollY` (worklet, UI thread); AppHeader reads it
 * via useAnimatedStyle to drive the gradient/title fade.
 *
 * On screen blur, useFocusEffect cleanup resets the value to 0 so the header
 * is fully opaque again when switching tabs.
 */
import { createContext, useContext, ReactNode } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

interface ScrollContextValue {
  sharedScrollY: SharedValue<number>;
}

const ScrollContext = createContext<ScrollContextValue | null>(null);

export function ScrollProvider({ children }: { children: ReactNode }) {
  const sharedScrollY = useSharedValue(0);
  return (
    <ScrollContext.Provider value={{ sharedScrollY }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScrollContext(): ScrollContextValue {
  const ctx = useContext(ScrollContext);
  if (!ctx) {
    throw new Error('useScrollContext must be used within ScrollProvider');
  }
  return ctx;
}