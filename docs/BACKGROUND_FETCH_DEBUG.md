# Background Fetch im Simulator testen

## Problem
Background Fetch läuft **nicht automatisch** im Simulator. iOS entscheidet opportunistisch wann Background Tasks ausgeführt werden - im Simulator nie.

## Lösung: Manuelles Triggern

### Option 1: Xcode (einfachste Methode)

1. **App im Simulator starten** via Xcode
2. **App in den Hintergrund schicken** (⌘H im Simulator oder Home-Button)
3. **In Xcode**: `Debug` → `Simulate Background Fetch`

Das triggert sofort den Background Fetch Task und du siehst im Console Log:
```
[Background] Fetching weather data...
[Background] Weather data updated: 21.5
```

### Option 2: Terminal (für Profis)

```bash
# Simulator device UDID finden
xcrun simctl list devices | grep Booted

# Background Fetch triggern
xcrun simctl spawn booted e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"weather-background-fetch"]
```

**Hinweis:** Funktioniert nur wenn die App **im Hintergrund läuft** (nicht terminated).

### Option 3: iOS Settings

Im Simulator:
1. `Settings` → `Developer` → `Background Fetch`
2. Wähle `Frequent` (statt `Off` oder `Wi-Fi`)
3. App muss trotzdem manuell via Xcode getriggert werden

## Wie du weisst, dass es funktioniert

### In der App (Debug Info)
Die gelbe Debug-Box zeigt:

**📊 Widget Refresh**
- Letztes Refresh: `30.06.2026, 14:35:21`

Wenn Background Fetch läuft, ändert sich dieser Timestamp alle 30 Minuten.

### Im Widget
Das Widget zeigt die aktuellen Temperaturdaten. Wenn Background Fetch funktioniert, aktualisiert sich das Widget automatisch.

### In Xcode Console
Bei jedem Background Fetch siehst du:
```
🔄 [Background] Fetching weather data for POI: 1
✅ [Background] Weather data updated: 21.5°C
```

## Wichtig zu wissen

1. **Background Fetch Intervall**: Minimum 30 Minuten (iOS respektiert nicht kürzere Intervalle)

2. **Simulator Limitation**: Im Simulator läuft Background Fetch **NUR wenn manuell getriggert**. Auf echten Geräten läuft es automatisch (abhängig von iOS Scheduling).

3. **App muss im Hintergrund sein**: Wenn die App im Vordergrund ist oder terminated wurde, läuft Background Fetch nicht.

4. **Widget Timeline**: Das Widget hat eine eigene Timeline (refresh alle 5 Min), unabhängig von Background Fetch. Das Widget-Refresh zeigt nur wann WidgetKit das Widget neu gerendert hat.

## Debugging Workflow

1. **App starten** und POI speichern → Debug Info zeigt "App Fetch"
2. **Xcode → Simulate Background Fetch** → Console zeigt Background Fetch Log
3. **Widget checken** → Sollte aktualisierte Daten zeigen
4. **App öffnen** → Debug Info zeigt "Widget Refresh" mit neuem Timestamp

## Echtes Gerät (Production)

Auf echten iPhones:
- Background Fetch läuft **automatisch**
- iOS entscheidet wann (basierend auf Nutzerverhalten, Akku, etc.)
- Minimum 30 Min Intervall wird respektiert
- Kann in `Settings` → `General` → `Background App Refresh` deaktiviert werden

## Troubleshooting

### "Background Fetch nicht verfügbar"
- Prüfe `app.json` → `ios.infoPlist.UIBackgroundModes` enthält `["fetch"]`
- Rebuilde mit `npx expo prebuild --clean` und `pnpm run ios`

### "Background Task läuft nicht"
- App muss im Hintergrund sein (nicht terminated)
- Nur via Xcode manuell triggern im Simulator
- Console Log checken ob Task registriert wurde: `[Background] Task registered successfully`

### "Widget zeigt alte Daten"
- Widget hat eigene Timeline (5 Min)
- Force-Refresh: Long-Press auf Widget → "Edit Widget" → Cancel
- Prüfe ob Wetterdaten in UserDefaults gespeichert sind
