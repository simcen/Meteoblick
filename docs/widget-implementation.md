# Widget-Implementation: Swift-Skelett

> Diese Datei beschreibt, was im iOS Widget Extension (`MeteoblickWidget.swift`) implementiert werden muss, damit das Widget unabhängig von der App-Refresh-Budget aktualisiert. **Stand: Backend + App + Swift-Datei sind bereit.**

## Wie der Swift-Code ins Repo kommt

Der Swift-Code wird in `plugins/widget-custom/MeteoblickWidget.template.swift` gepflegt. Das Patch-Script `plugins/widget-custom/patch.js` kopiert die Template nach `ios/ExpoWidgetsTarget/MeteoblickWidget.swift` — das ist nötig, weil `expo-widgets` bei jedem `expo prebuild` eine minimal-Template schreibt und unseren Code überschreibt.

**Workflow:**
```bash
# 1. Custom-Swift-Code in plugins/widget-custom/MeteoblickWidget.template.swift ändern
# 2. expo prebuild laufen lassen (regeneriert ios/)
# 3. Post-Hook patch.js läuft automatisch und schreibt die Template zurück
# 4. App bauen
pnpm ios   # tut prebuild + postprebuild automatisch
```

Das `postprebuild` npm-Script ist in `package.json` registriert.

## Architektur (heute)

```
App (JS)        →  Backend (Hono)  →  Loxone Cloud   (Credentials in App)
App (JS)        →  Backend (Hono)  →  MeteoSwiss     (Wetter, kein Loxone)
Widget (Swift)  →  noch nicht implementiert — soll:
                    1. Credentials aus App Group lesen
                    2. Backend-Timeline-Endpoint aufrufen (mit Headers)
                    3. Multi-Entry-Timeline rendern
```

## Backend-Contract (bereits implementiert)

```
GET /api/widget/timeline?poiId={poiId}
Headers:
  X-Loxone-SNR:        504F94A1874F       (optional)
  X-Loxone-Sensor-Uuid: 1b4bd480-...      (optional, wenn Loxone)
  X-Loxone-Credentials: Basic base64(user:password)   (optional, wenn Loxone)

Response 200 (application/json):
{
  "poiId": "320200",
  "locationName": "Frauenkappelen",
  "latitude": 46.95,
  "longitude": 7.36,
  "current": {
    "temperature": 29,
    "symbolCode": 3,
    "precipitation": 0,
    "timestamp": "2026-07-07T09:00:00.000Z"
  },
  "forecast": {
    "temperature": 30.1,
    "timestamp": "2026-07-07T10:00:00.000Z"
  },
  "smartHome": {                       // null wenn Loxone nicht konfiguriert
    "temperature": 21.1,
    "timestamp": "2026-07-07T09:52:50.688Z"
  },
  "buildNumber": "260707-1113",
  "fetchedAt": "2026-07-07T09:52:50.688Z"
}
```

## App-Group-Container (bereits implementiert)

Die App schreibt bei jedem Config-Update in den App Group Container. Das Widget liest daraus:

| Key | Inhalt | Geschrieben von |
|---|---|---|
| `meteoblick_widget_last_refresh` | ISO timestamp letzte Update | `updateWidget()` |
| `meteoblick_weather_snapshot` | Wetter-Snapshot (JSON) | (geplant) |
| `loxone_config_widget` | `{ cloudAddress, username, password, temperatureSensorUUID }` | `setLoxoneConfig()` |
| `loxone_sensor_data` | `{ temperature, timestamp }` (Cache) | `setLoxoneSensorData()` |

Lese-Keys sind Konstanten in `src/constants.ts`:
- `WIDGET_LOXONE_CONFIG_KEY = 'loxone_config_widget'`
- `WIDGET_LOXONE_SENSOR_DATA_KEY = 'loxone_sensor_data'`
- `WIDGET_WEATHER_SNAPSHOT_KEY = 'meteoblick_widget_weather_snapshot'`

## Was im Widget implementiert werden muss

### 1. Eigener `TimelineProvider` (statt Expo's `WidgetsTimelineProvider`)

```swift
import WidgetKit
import SwiftUI

struct MeteoblickEntry: TimelineEntry {
    let date: Date
    let locationName: String
    let temperature: Double
    let temperatureLoxone: Double?
    let symbolCode: Int
    let precipitation: Double
}

struct MeteoblickProvider: TimelineProvider {
    typealias Entry = MeteoblickEntry

    // Called for placeholder. Return a sensible default.
    func placeholder(in context: Context) -> MeteoblickEntry {
        MeteoblickEntry(
            date: Date(),
            locationName: "—",
            temperature: 0,
            temperatureLoxone: nil,
            symbolCode: 0,
            precipitation: 0
        )
    }

    // Called for the widget gallery (timeline with one sample entry).
    func getSnapshot(in context: Context, completion: @escaping (MeteoblickEntry) -> Void) {
        let entry = placeholder(in: context)
        completion(entry)
    }

    // Called when iOS wants fresh data. THIS is where we fetch.
    func getTimeline(in context: Context, completion: @escaping (Timeline<MeteoblickEntry>) -> Void) {
        Task {
            let entries = await fetchTimelineEntries()
            // Refresh every 15 minutes (iOS may override)
            let timeline = Timeline(entries: entries, policy: .after(Date().addingTimeInterval(15 * 60)))
            completion(timeline)
        }
    }
}
```

### 2. Helper: Backend-Call mit App-Group-Credentials

```swift
struct WidgetBackend {
    static let appGroup = "group.ch.meteoblick"
    static let widgetLoxoneKey = "loxone_config_widget"
    static let snapshotKey = "meteoblick_weather_snapshot"
    static let lastRefreshKey = "meteoblick_widget_last_refresh"

    // Returns the timeline JSON as a Codable struct.
    static func fetchTimeline(baseURL: URL, poiId: String) async throws -> TimelineResponse {
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/widget/timeline?poiId=\(poiId)"))

        // Read Loxone config from App Group (UserDefaults suite)
        if let defaults = UserDefaults(suiteName: appGroup),
           let data = defaults.data(forKey: widgetLoxoneKey),
           let config = try? JSONDecoder().decode(LoxoneConfig.self, from: data) {
            request.setValue(config.cloudAddress, forHTTPHeaderField: "X-Loxone-SNR")
            if let uuid = config.temperatureSensorUUID {
                request.setValue(uuid, forHTTPHeaderField: "X-Loxone-Sensor-Uuid")
            }
            // Credentials are base64(user:pass) — matches the backend's X-Loxone-Credentials parser
            let creds = "\(config.username):\(config.password)"
                .data(using: .utf8)?.base64EncodedString() ?? ""
            request.setValue("Basic \(creds)", forHTTPHeaderField: "X-Loxone-Credentials")
        }

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().dateDecodingStrategy = .iso8601
            .decode(TimelineResponse.self, from: data)
    }
}

struct LoxoneConfig: Codable {
    let cloudAddress: String
    let username: String
    let password: String
    let temperatureSensorUUID: String?
}

struct TimelineResponse: Codable {
    let poiId: String
    let locationName: String
    let current: Current
    let forecast: Forecast
    let smartHome: SmartHome?
    let fetchedAt: Date

    struct Current: Codable { let temperature: Double; let symbolCode: Int; let precipitation: Double; let timestamp: Date }
    struct Forecast: Codable { let temperature: Double; let timestamp: Date }
    struct SmartHome: Codable { let temperature: Double; let timestamp: Date }
}
```

### 3. `getTimeline()`-Implementation

```swift
func fetchTimelineEntries() async -> [MeteoblickEntry] {
    let poiId = await readActivePoiId()  // From "meteoblick_poi_id" in App Group
    guard let poiId else { return [placeholderNow()] }

    let baseURL = URL(string: "https://meteoblick-api.apps.balz.me")!
    // In dev: use the Mac IP or ngrok tunnel
    // let baseURL = URL(string: "http://172.16.100.10:3000")!

    do {
        let response = try await WidgetBackend.fetchTimeline(baseURL: baseURL, poiId: poiId)

        // Build a single entry for now (multi-entry timeline = future enhancement)
        return [MeteoblickEntry(
            date: response.fetchedAt,
            locationName: response.locationName,
            temperature: response.current.temperature,
            temperatureLoxone: response.smartHome?.temperature,
            symbolCode: response.current.symbolCode,
            precipitation: response.current.precipitation
        )]
    } catch {
        // Fallback to last cached snapshot from App Group
        return [cachedEntry()] ?? [placeholderNow()]
    }
}
```

### 4. Widget `body` umbauen

```swift
struct MeteoblickWidget: Widget {
    let name = "MeteoblickWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: name, provider: MeteoblickProvider()) { entry in
            MeteoblickView(entry: entry)
        }
        .configurationDisplayName("Meteoblick")
        .description("Wetter für deinen Standort")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}
```

### 5. View umbauen

```swift
struct MeteoblickView: View {
    let entry: MeteoblickEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: symbolForCode(entry.symbolCode))
                    .font(.title2)
                Text(entry.locationName)
                    .font(.headline)
                Spacer()
            }
            HStack(alignment: .firstTextBaseline) {
                Text("\(Int(entry.temperature.rounded()))°")
                    .font(.system(size: 48, weight: .light))
                Spacer()
                if let lx = entry.temperatureLoxone {
                    Text("Innen \(String(format: "%.1f", lx))°")
                        .font(.caption)
                }
            }
            Text("\(String(format: "%.1f", entry.precipitation)) mm")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
```

## Was beim Build zu beachten ist

- **App Group muss im Xcode-Projekt aktiviert sein** für `Meteoblick` UND `ExpoWidgetsTarget` Target → "Signing & Capabilities" → "+ Capability" → "App Groups" → `group.ch.meteoblick`
- **Kein Code-Signing-Problem** wenn du es im Dev-Build testest — die App Group ID muss nur gleich sein, App muss nicht im App Store signiert sein
- **Widget Extension muss `MeteoblickWidget` referenzieren** in `Info.plist` via `NSExtension` (macht `expo-widgets`-Plugin automatisch)

## Aufwand

| Schritt | Zeilen Swift | Aufwand |
|---|---|---|
| Eigener `TimelineProvider` | ~30 | klein |
| Backend-Helper | ~40 | klein |
| `getTimeline()` mit Fallback | ~30 | klein |
| View-Update | ~30 | klein |
| **Total** | **~130 Zeilen Swift** | **1-2 Stunden Arbeit** |

## Multi-Entry-Timeline (zukünftig)

Für stündliche Updates im Widget kann das Backend später eine `forecast[]` Liste liefern (24 Einträge). Das Widget macht dann `entries: forecast.map { ... }`. Aktuell liefert das Backend nur aktuell + nächste Stunde — das reicht für eine Single-Entry-Timeline, ist aber nicht ideal für Live-Optik.

Wenn du das angehen willst, kann ich das Backend erweitern sobald das Widget-Skelett läuft. Sage einfach Bescheid.

## Test-Plan nach Implementation

1. `expo prebuild` regeneriert iOS-Files
2. In Xcode: App Group für beide Targets aktivieren (siehe oben)
3. Build → App starten → SmartHomeScreen → Credentials eingeben + Sensor wählen
4. Verify: im App Group Container ist `loxone_config_widget` mit Credentials
5. Widget im Home Screen hinzufügen → sollte Wetter + Loxone-Temp zeigen
6. iOS Settings → Background App Refresh für Meteoblick deaktivieren → Widget sollte trotzdem aktualisieren
7. Bonus: Airplane-Mode → Widget zeigt letzten Cache
