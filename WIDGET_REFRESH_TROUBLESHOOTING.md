# Widget Refresh Troubleshooting

## Problem: Widget aktualisiert sich nicht automatisch auf echtem iPhone

### Root Cause

iOS WidgetKit entscheidet **selbst** wann Widgets refreshed werden. Expo Widgets nutzt `updateSnapshot()` aus JS, aber iOS ignoriert das wenn:

1. **Background Fetch Status = "Restricted"**
   - Normal bei neuen TestFlight Installs
   - iOS muss App "lernen" (24-48 Stunden regelmäßiger Nutzung)
   - Lösung: App täglich nutzen, iOS lernt Pattern

2. **Widget hat keine Timeline Provider**
   - Expo Widgets unterstützt (noch) keine nativen Timeline Providers in JS
   - `updateSnapshot()` funktioniert nur wenn App im Foreground
   - iOS refresht Widgets selbst basierend auf eigenem Budget

### Current Architecture

```
App (Foreground) → updateSnapshot() → Widget updates ✅
Background Fetch → updateSnapshot() → Widget MIGHT update ⚠️
iOS System      → No Timeline Provider → Widget decides itself ❌
```

### Workarounds

#### 1. App regelmäßig öffnen
- Foreground Fetch läuft alle 5 Min → Widget updated
- Hilft iOS "lernen" dass App wichtig ist
- Nach 2-3 Tagen sollte Background Fetch funktionieren

#### 2. Manueller Refresh Button
- Debug Screen: "Background Fetch testen"
- Holt Daten + updated Widget sofort
- Umgeht iOS Restrictions

#### 3. Low Power Mode deaktivieren
- iOS stoppt Background Fetch im Low Power Mode
- Settings → Battery → Low Power Mode OFF

#### 4. Background App Refresh aktivieren
- Settings → General → Background App Refresh → ON
- Settings → Meteoblick → Background App Refresh → ON

### Verification Steps

1. **Check Background Fetch Status:**
   ```
   Debug Screen → Background Fetch Status
   ```
   - "Available" ✅ - sollte nach 24-48h funktionieren
   - "Restricted" ⚠️ - normal bei neuer Install, warten
   - "Denied" ❌ - User hat Background Fetch global disabled

2. **Check Widget Last Refresh:**
   ```
   Widget zeigt unten: 🔄 HH:MM
   ```
   - Timestamp sollte sich alle 15 Min (Background) oder 5 Min (Foreground) ändern

3. **Manual Test:**
   ```
   Debug Screen → "Background Fetch testen"
   ```
   - Widget sollte sofort updaten
   - Beweist: Code funktioniert, nur iOS Timing ist das Problem

### Long-term Solution: Native WidgetKit Extension

Expo Widgets JS API kann iOS nicht zwingen Widgets zu refreshen.

**Proper fix** (außerhalb Expo):
```swift
// WidgetTimelineProvider.swift
struct WeatherEntry: TimelineEntry {
    let date: Date
    let temperature: Double
}

struct WeatherProvider: TimelineProvider {
    func getTimeline(for configuration: ConfigurationIntent, 
                    in context: Context, 
                    completion: @escaping (Timeline<Entry>) -> ()) {
        // Fetch data from SharedStorage
        let entry = WeatherEntry(date: Date(), temperature: 22.0)
        
        // Tell iOS to refresh in 15 minutes
        let timeline = Timeline(entries: [entry], 
                               policy: .after(Date().addingTimeInterval(15 * 60)))
        completion(timeline)
    }
}
```

**Benefits:**
- iOS calls `getTimeline()` automatically every 15 min
- Works without Background Fetch
- Widget refreshes even if app never opens

**Downside:**
- Requires ejecting from Expo Managed Workflow
- Or custom Expo Config Plugin

### Current Status

✅ Background Fetch configured correctly
✅ Widget updates when app is foreground
✅ Manual refresh works
⚠️ Auto-refresh on physical device depends on iOS learning pattern

**Timeline:**
- Day 1-2: Background Fetch = "Restricted", no auto-refresh
- Day 3-7: iOS learns pattern, Background Fetch becomes "Available"
- Day 7+: Widget should auto-refresh every 15 min via Background Fetch

### Alternative: Use App Shortcuts

iOS 18 hat App Intents die Widgets refreshen können:

```swift
// WeatherRefreshIntent.swift
struct RefreshWeatherIntent: AppIntent {
    static var title: LocalizedStringResource = "Refresh Weather"
    
    func perform() async throws -> some IntentResult {
        // Trigger Background Fetch manually
        await fetchWeatherData()
        WidgetCenter.shared.reloadTimelines(ofKind: "MeteoblickWidget")
        return .result()
    }
}
```

User kann dann Siri Shortcut erstellen: "Hey Siri, refresh weather" → Widget updated.

Aber auch das braucht native Swift Code.

## Summary

**Problem:** Expo Widgets JS API limitations + iOS Background Fetch "learning period"

**Short-term:** Warten 24-48h, App täglich nutzen

**Long-term:** Native WidgetKit Extension mit Timeline Provider (requires eject)
