# Expo Widgets Architecture

## Übersicht

Meteoblick verwendet `expo-widgets` (SDK 57) für iOS Home Screen Widgets. Diese Dokumentation beschreibt die Architektur, kritische Konzepte und häufige Fallstricke.

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│ React Native App (Metro Bundle)                             │
│                                                              │
│  app/_layout.tsx                                             │
│  └─ import '../widgets/MeteoblickWidget'  ← Wichtig!        │
│                                                              │
│  src/screens/HomeScreen.tsx                                  │
│  └─ updateWidget(props) aufrufen                            │
│     └─ src/widgets/widgetManager.ts                         │
│        └─ meteoblickWidget.updateSnapshot(props)            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Metro bundelt Widget-Code
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ expo-widgets Compiler (zur Build-Zeit)                      │
│                                                              │
│  widgets/MeteoblickWidget.tsx                                │
│  └─ Expo UI Components (@expo/ui/swift-ui)                  │
│  └─ 'widget' Direktive                                      │
│  └─ createWidget('MeteoblickWidget', Component)             │
│                                                              │
│  ❌ NICHT kompiliert zu ios/ExpoWidgetsTarget/index.swift   │
│  ✅ Läuft zur RUNTIME über ExpoWidgets.bundle               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Widget registriert
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ iOS Widget Extension (ExpoWidgetsTarget)                    │
│                                                              │
│  ios/ExpoWidgetsTarget/index.swift                           │
│  └─ @main WidgetBundle { MeteoblickWidget() }              │
│                                                              │
│  Widget lädt Code zur Runtime von ExpoWidgets.bundle        │
│  └─ Rendert Expo UI via SwiftUI Interop                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Kritische Konzepte

### 1. Widget-Kompilierung erfolgt zur RUNTIME, nicht Build-Time

**Wichtig:** Im Gegensatz zu nativen SwiftUI Widgets wird der Widget-Code **NICHT** zu nativem Swift kompiliert!

- `ios/ExpoWidgetsTarget/index.swift` enthält nur Widget-Registrierung (10 Zeilen)
- Der eigentliche Widget-Code läuft zur **Runtime** über `ExpoWidgets.bundle`
- Metro bundelt den Widget-Code und macht ihn für die Extension verfügbar

### 2. Widget MUSS in Root-App importiert werden

```tsx
// app/_layout.tsx
import '../widgets/MeteoblickWidget';  // ← CRITICAL!
```

**Warum?** Damit Metro den Widget-Code in den Bundle aufnimmt. Ohne Import wird das Widget nicht gebundelt und bleibt leer.

### 3. Styling via Modifiers, NICHT direkte Props

❌ **FALSCH:**
```tsx
<VStack padding={12} backgroundColor="#3366CC">
  <Text fontSize={32} color="white">Hello</Text>
</VStack>
```

✅ **RICHTIG:**
```tsx
import { VStack, Text } from '@expo/ui/swift-ui';
import { padding, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

<VStack modifiers={[padding({ all: 12 })]}>
  <Text modifiers={[font({ size: 32 }), foregroundStyle('#FFFFFF')]}>
    Hello
  </Text>
</VStack>
```

### 4. Alle Funktionen INNERHALB der Widget-Komponente

❌ **FALSCH:**
```tsx
function getWeatherIcon(code: number) {
  return code === 1 ? '☀️' : '☁️';
}

const MyWidget = (props, env) => {
  'widget';
  const icon = getWeatherIcon(props.code);  // ← ReferenceError zur Runtime!
  return <Text>{icon}</Text>;
};
```

✅ **RICHTIG:**
```tsx
const MyWidget = (props, env) => {
  'widget';
  
  // Helper-Funktion INNERHALB der Komponente!
  const getWeatherIcon = (code: number) => {
    return code === 1 ? '☀️' : '☁️';
  };
  
  const icon = getWeatherIcon(props.code);
  return <Text>{icon}</Text>;
};
```

**Grund:** expo-widgets kann nur auf Code innerhalb der Komponente zugreifen. Externe Funktionen werden nicht gebundelt!

### 5. Update API: Nur updateSnapshot(), KEIN reload()

```tsx
import meteoblickWidget from '../../widgets/MeteoblickWidget';

// ✅ RICHTIG:
meteoblickWidget.updateSnapshot({ temperature: 22, ... });

// ❌ FALSCH (nicht nötig):
meteoblickWidget.updateSnapshot({ ... });
meteoblickWidget.reload();  // ← Unnötig, passiert automatisch!
```

**Widget updated sich automatisch** nach `updateSnapshot()`.

### 6. app.json Konfiguration

```json
{
  "expo": {
    "plugins": [
      [
        "expo-widgets",
        {
          "widgets": [
            {
              "name": "MeteoblickWidget",              // ← createWidget('Name')
              "displayName": "Meteoblick",             // ← Widget Gallery Name
              "description": "Wetterprognose",
              "supportedFamilies": ["systemSmall"],    // ← NICHT "families"!
              "contentMarginsDisabled": true           // ← Für randlosen Look
            }
          ]
        }
      ]
    ]
  }
}
```

**Wichtig:** 
- `supportedFamilies` (NICHT `families`)
- Kein `"ios": { ... }` Wrapper nötig
- Kein `"targetPath"` nötig (Standard: `widgets/`)

### 7. expo prebuild nach app.json Änderungen

```bash
# ❌ FALSCH (prebuild nicht automatisch):
# app.json ändern
pnpm ios

# ✅ RICHTIG:
# app.json ändern
npx expo prebuild --clean --platform ios
pnpm ios
```

**`expo run:ios` macht KEIN automatisches prebuild!** Nach Änderungen an `app.json` (Widget-Config) muss manuell `expo prebuild --clean` ausgeführt werden.

## Dateistruktur

```
/widgets/
  MeteoblickWidget.tsx          # Widget-Komponente

/app/
  _layout.tsx                   # Import Widget hier!

/src/widgets/
  widgetManager.ts              # Widget Update Helper

/ios/
  ExpoWidgetsTarget/
    index.swift                 # Widget-Registrierung (auto-generiert)
    Info.plist                  # Widget Extension Config
```

## Häufige Fehler & Lösungen

### Problem: "can't find variable X"

**Ursache:** Funktion außerhalb der Widget-Komponente definiert.

**Lösung:** Alle Helper-Funktionen **innerhalb** der Widget-Komponente definieren.

```tsx
const MyWidget = (props, env) => {
  'widget';
  
  // ✅ Hier definieren, NICHT außerhalb!
  const helperFunction = () => { ... };
  
  return <VStack>...</VStack>;
};
```

### Problem: Widget bleibt leer

**Ursachen:**
1. Widget nicht in `app/_layout.tsx` importiert
2. `expo prebuild` nicht ausgeführt nach app.json Änderung
3. `'widget'` Direktive fehlt oder falsch platziert

**Lösung:**
```bash
# 1. Widget importieren
# app/_layout.tsx: import '../widgets/MeteoblickWidget';

# 2. Prebuild
npx expo prebuild --clean --platform ios

# 3. Build
pnpm ios
```

### Problem: Build-Nummer zwischen App und Widget unterschiedlich

**Ursache:** Widget cached alte Version.

**Lösung:**
1. Widget vom Home Screen entfernen
2. App neu bauen
3. Widget neu hinzufügen

### Problem: Widget updated nicht nach POI-Wechsel

**Ursache:** `updateSnapshot()` nicht aufgerufen oder falsche Props.

**Lösung:**
```tsx
// HomeScreen.tsx
const handleSave = async () => {
  const weather = await fetchWeatherData(selectedPOI.id);
  if (weather) {
    await updateWidget({
      locationName: weather.locationName,
      temperature: weather.temperature,
      symbolCode: weather.symbolCode,
      precipitation: weather.precipitation,
      buildNumber: BUILD_NUMBER,
    });
  }
};
```

## Testing Workflow

```bash
# 1. Code ändern
# 2. Build & Test (KEIN Commit vorher!)
pnpm ios

# 3. App läuft? Widget hinzufügen und testen:
#    - Widget zeigt Daten?
#    - Build-Nummer korrekt?
#    - POI wechseln funktioniert?
#    - Keine Errors in Console?

# 4. Alles OK? JETZT committen:
git add -A
git commit -m "feat(widget): implement expo-widgets with instant reload"
```

## Performance

- **Widget Update:** ~50-200ms (instant)
- **Metro Bundle Size:** +~500KB für expo-widgets
- **Runtime Overhead:** Minimal (SwiftUI Interop optimiert)

## Einschränkungen

1. **iOS only** - expo-widgets unterstützt nur iOS
2. **Kein natives Swift** - Widget läuft über JavaScript Bundle
3. **Begrenztes Layout** - Nur Expo UI Components, keine beliebigen SwiftUI Views
4. **Debugging schwierig** - Widget-Errors nur in Widget-Preview sichtbar

## Referenzen

- [Expo Widgets Dokumentation](https://docs.expo.dev/versions/latest/sdk/widgets/)
- [Offizielles Beispiel](https://github.com/expo/examples/tree/master/with-widgets)
- [@expo/ui SwiftUI Components](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/)
- [Modifiers Reference](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/#modifiers)

## Lessons Learned

1. **Trial & Error vermeiden** - Immer offizielle Docs zuerst konsultieren
2. **Prebuild nicht vergessen** - Nach app.json Änderungen manuell ausführen
3. **Scope beachten** - Alle Funktionen innerhalb der Widget-Komponente
4. **Import nicht vergessen** - Widget in Root-App importieren
5. **Erst testen, dann committen** - Niemals broken Code committen!
