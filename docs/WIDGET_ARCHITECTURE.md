# Widget Architecture & Data Strategy

**Decision Date:** 2026-07-03  
**Status:** ✅ Final - Do not change without documentation update

## Problem Statement

How should the Meteoblick widget fetch and display weather data?

**Two approaches:**
1. **Shared Storage (App Groups)**: App fetches data → saves to UserDefaults → Widget reads from UserDefaults
2. **Direct Network**: Widget makes HTTP requests directly to backend API

## Research Summary

Based on iOS WidgetKit best practices research (2026):

### Industry Consensus: Shared Storage Pattern ✅

**Sources:**
- [Understanding Widget Limitations & Data Management](https://medium.com/@telawittig/understanding-the-limitations-of-widgets-runtime-in-ios-app-development-and-strategies-for-managing-a3bb018b9f5a)
- [Developing a WidgetKit Strategy - Apple](https://developer.apple.com/documentation/WidgetKit/Developing-a-WidgetKit-strategy)
- [Lessons From Building iOS Widgets - Shopify](https://shopify.engineering/lessons-building-ios-widgets)
- [Sharing Object Data Between iOS App and Widget](https://michael-kiley.medium.com/sharing-object-data-between-an-ios-app-and-its-widget-a0a1af499c31)

**Key Findings:**

1. **Apple's Recommendation**: Network calls should be handled by background fetches in the main app, then shared via App Groups
2. **Why Avoid Direct Network in Widgets**:
   - OS can terminate widget process if network takes too long
   - Race conditions between app and widget
   - "Sync Ghost" scenario: widget shows different data than app
   - Memory cap ~30MB for widgets (strict enforcement)
3. **Best Practice**: Use `UserDefaults(suiteName: "group.ch.meteoblick")` for shared storage
4. **Timeline Refresh Rate**: 40-70 refreshes per day max (every 15-60 minutes)

## Decision: Shared Storage via App Groups

**Architecture:**

```
┌─────────────────┐
│   React Native  │
│      App        │
│                 │
│  1. Fetch from  │
│     Backend API │
│                 │
│  2. Save to     │
│     SharedStorage│──────┐
│     (UserDefaults)      │
│                 │       │ App Group Container
│  3. Trigger     │       │ (group.ch.meteoblick)
│     Widget Reload│      │
└─────────────────┘       │
                          │
                          │
┌─────────────────┐       │
│  Widget         │       │
│  (Swift)        │       │
│                 │       │
│  1. Read from   │◄──────┘
│     SharedStorage
│     (instant!)  │
│                 │
│  2. Display     │
└─────────────────┘
```

### Data Flow

#### Background Updates (every 30 minutes)
1. iOS triggers Background Fetch task
2. App fetches weather from backend (`http://localhost:3000/api/weather/{pointId}`)
3. App saves to SharedStorage (`SharedStorage.setWeatherData()`)
4. App calls `WidgetCenter.shared.reloadAllTimelines()`
5. Widget reads from SharedStorage instantly

#### Immediate Updates (POI change)
1. User selects new POI in app
2. App saves POI to SharedStorage
3. App fetches weather from backend
4. App saves weather to SharedStorage
5. App calls `WidgetReload.reloadAllTimelines()` (native bridge)
6. Widget reloads and reads from SharedStorage instantly

### Why This Works

✅ **No network delay in widget** - Data is always local  
✅ **No race conditions** - Single source of truth (SharedStorage)  
✅ **Instant updates** - Widget reads from memory  
✅ **App/Widget consistency** - Both read same data  
✅ **Handles offline** - Last known data always available  
✅ **Battery efficient** - Widget never makes network calls  

## Implementation Details

### App Side (TypeScript)

**File:** `src/storage/SharedStorage.ts`

```typescript
export class SharedStorage {
  static async setWeatherData(data: WeatherData): Promise<void> {
    const json = JSON.stringify({
      temperature: data.temperature,
      symbolCode: data.symbolCode,
      precipitation: data.precipitation,
      timestamp: data.timestamp,
      location: data.location,
      locationName: data.locationName,
    });
    
    await SharedGroupPreferences.setItem(
      'meteoblick_weather_data',
      json,
      'group.ch.meteoblick'
    );
  }
}
```

### Widget Side (Swift)

**File:** `ios/ExpoWidgetsTarget/index.swift`

```swift
private func loadWeatherData() -> WeatherEntry {
    guard let defaults = UserDefaults(suiteName: "group.ch.meteoblick") else {
        return placeholderEntry
    }
    
    // Read from SharedStorage (instant, no network)
    if let jsonString = defaults.string(forKey: "meteoblick_weather_data"),
       let jsonData = jsonString.data(using: .utf8),
       let weatherDict = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
        
        return WeatherEntry(
            date: Date(),
            temperature: weatherDict["temperature"] as? Double ?? 0.0,
            symbolCode: weatherDict["symbolCode"] as? Int ?? 1,
            // ... etc
        )
    }
    
    return placeholderEntry
}
```

### Native Bridge for Instant Updates

**File:** `modules/widget-reload/ios/WidgetReloadModule.swift`

```swift
public class WidgetReloadModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetReloadModule")

    Function("reloadAllTimelines") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
```

## Backend Role

Backend serves as:
- **Data cache** for MeteoSwiss API (1h refresh cycle)
- **API endpoint** for app to fetch weather
- **No direct widget access** - widget never calls backend

## Testing the Architecture

### Verify Instant Updates After POI Change

1. Open app, select POI A → Widget shows POI A weather instantly
2. Select POI B → Widget updates instantly (< 0.5s)
3. No network delay visible

### Verify Background Updates

1. App in background for 30+ minutes
2. Widget shows updated weather data
3. Open app → shows same data as widget (consistency)

## Do Not Change This

This architecture is:
- ✅ Apple recommended pattern
- ✅ Industry best practice
- ✅ Battery efficient
- ✅ Reliable and instant

**If changing:** Update this document first with reasoning and research.

## References

- [Apple: Developing a WidgetKit Strategy](https://developer.apple.com/documentation/WidgetKit/Developing-a-WidgetKit-strategy)
- [Shopify: Lessons From Building iOS Widgets](https://shopify.engineering/lessons-building-ios-widgets)
- [Understanding Widget Limitations](https://medium.com/@telawittig/understanding-the-limitations-of-widgets-runtime-in-ios-app-development-and-strategies-for-managing-a3bb018b9f5a)
- [How to Update or Refresh a Widget - Swift Senpai](https://swiftsenpai.com/development/refreshing-widget/)
- [WidgetKit in iOS - Tech Holding](https://techholding.co/blog/WidgetKit-in-OS)
