# UI Design Guidelines

## Tab Bar Icons (iOS)

### Verwendete SF Symbols

| Tab | SF Symbol | Bedeutung |
|-----|-----------|-----------|
| Wetter | `cloud.sun.fill` | Wetter-App Icon (Wolke + Sonne) |
| Smart Home | `house.fill` | Haus für Smart Home |
| Debug | `wrench.and.screwdriver.fill` | Entwickler-Tools |

### Implementation

```tsx
// app/_layout.tsx
const TabBarIcon = (sfSymbolName: string) => ({
  sfSymbol: sfSymbolName,
});

<Tabs.Screen
  name="Wetter"
  options={{
    tabBarIcon: TabBarIcon('cloud.sun.fill'),
    tabBarAccessibilityLabel: 'Wetter-Tab',
  }}
/>
```

### Apple HIG Compliance

✅ **SF Symbols** - Native iOS System-Icons  
✅ **Filled Variants** - Bessere Sichtbarkeit in Tab Bar  
✅ **Accessibility Labels** - VoiceOver Support  
✅ **Automatische States** - Selected/Unselected rendering  
✅ **Dark Mode** - Automatische Farbanpassung  

### Warum SF Symbols?

1. **Native Look** - Konsistent mit iOS System-Apps
2. **Automatische Anpassung** - Size Classes, Dynamic Type, Dark Mode
3. **Keine Assets nötig** - Kein Icon-Export, keine Retina-Varianten
4. **Accessibility** - VoiceOver, High Contrast, etc. automatisch
5. **Performance** - Vektorbasiert, keine Bitmap-Skalierung

### Alternativen erwogen

❌ **Custom PNG Icons** - Mehr Arbeit, schlechtere Skalierung  
❌ **Icon Fonts** - Schlechtere Accessibility  
❌ **React Native Vector Icons** - Nicht native iOS Look  

## Referenzen

- [Apple HIG - Tab Bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [SF Symbols Browser](https://developer.apple.com/sf-symbols/)
- [@bottom-tabs/react-navigation Docs](https://react-navigation.github.io/react-navigation/docs/bottom-tab-navigator)
