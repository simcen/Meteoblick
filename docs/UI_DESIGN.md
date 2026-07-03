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

## App Icon (iOS 27 Liquid Glass)

### Design

**Master Asset:** `assets/icon.png` (1254x1254px)

**Design-Elemente:**
- 🏔️ Schweizer Alpen (weiß/blau Gradient)
- ☁️ Stilisierte Wolke (weiß, soft shadow)
- ☀️ Sonne mit Strahlen (weiß)
- 🎨 Gradient-Background: Sky Blue (#58BEF6) → Deep Blue (#3366CC)

**iOS 27 Liquid Glass Optimierungen:**
- Subtile 3D-Tiefe für Glossy-Effekt
- Centered Composition (iOS rundet Ecken ab)
- Hochauflösendes Master (1254x1254px)
- Solid Background (keine Transparenz)

### Generator

Erstellt mit: **DALL-E via ChatGPT Plus**

**Prompt:**
```
iOS app icon design for a Swiss weather forecast app called "Meteoblick". 
Features: Swiss Alps mountain peak silhouette in the foreground, small 
stylized cloud with sun rays above, clean modern design. Color palette: 
gradient from sky blue (#58BEF6) to deep blue (#3366CC), white cloud and 
sun accents. Style: minimalist, flat design with subtle 3D depth, glossy 
highlights optimized for iOS 27 liquid glass effect. Square format, 
centered composition, no text, professional and recognizable even at small sizes.
```

### Expo Configuration

```json
{
  "expo": {
    "icon": "./assets/icon.png"
  }
}
```

Expo generiert automatisch alle benötigten iOS Größen:
- 1024x1024 (App Store)
- 180x180 (iPhone @3x)
- 120x120 (iPhone @2x)
- 167x167 (iPad Pro)
- 152x152 (iPad @2x)
- 76x76 (iPad @1x)

### Testing

✅ Icon sichtbar in Xcode Asset Catalog
✅ Liquid Glass Effekt im iOS Simulator
✅ Erkennbar auch in kleinen Größen (Spotlight, Settings)
✅ Kein Beschnitt an abgerundeten Ecken

## Referenzen

- [Apple HIG - Tab Bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Apple HIG - App Icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [SF Symbols Browser](https://developer.apple.com/sf-symbols/)
- [@bottom-tabs/react-navigation Docs](https://react-navigation.github.io/react-navigation/docs/bottom-tab-navigator)
