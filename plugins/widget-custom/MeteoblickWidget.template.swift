import WidgetKit
import SwiftUI

// MARK: - Widget Configuration (App Group mirror)
//
// Mirrors credentials + showInWidget sensor UUIDs + POI + apiBaseUrl
// from the host app's SharedStorage. The widget reads this on every
// timeline reload to know which POI to fetch + which Loxone sensors to
// ask the backend for.

struct WidgetConfig: Codable {
    let cloudAddress: String
    let username: String
    let password: String
    let showInWidgetSensorUuids: [String]?
    let poiId: String?
    let apiBaseUrl: String?
    // Phase 5+: 'weather' (default) or a sensor UUID. Controls what
    // the circular Lock Screen widget shows.
    let lockScreenCircular: String?
}

enum WidgetConfigStore {
    static let appGroup = "group.ch.meteoblick"
    static let key = "loxone_config_widget"  // matches WIDGET_LOXONE_CONFIG_KEY

    static func read() -> WidgetConfig? {
        let defaults = UserDefaults(suiteName: appGroup) ?? .standard
        guard let json = defaults.string(forKey: key),
              let data = json.data(using: .utf8),
              let config = try? JSONDecoder().decode(WidgetConfig.self, from: data) else {
            return nil
        }
        return config
    }
}

// MARK: - Widget Timeline Client
//
// Single consolidated HTTP request to the backend's
// /api/widget/timeline endpoint. The backend fetches MeteoSwiss weather
// and all showInWidget Loxone sensors on our behalf, returning
// everything the widget needs in one round-trip.
//
// Why one request: the widget extension has strict CPU/memory/time
// budgets. Doing two parallel requests would split the work and still
// cost two round-trips. The backend is the right place to consolidate.
//
// Credentials are passed per-request via headers — the backend is
// stateless for Loxone auth (deliberate, see CLAUDE.md).

struct WidgetTimelineResponse: Codable {
    let locationName: String?
    let current: TimelineCurrent?
    let forecast: TimelineForecast?
    let smartHome: TimelineSmartHome?       // legacy single-sensor (backward compat)
    let smartHomeSensors: [TimelineSmartHomeSensor]?  // multi-sensor
    let buildNumber: String?
}

struct TimelineCurrent: Codable {
    let temperature: Double?
    let symbolCode: Int?
    let precipitation: Double?
    let timestamp: String?
}

struct TimelineForecast: Codable {
    let temperature: Double?
    let timestamp: String?
}

struct TimelineSmartHome: Codable {
    let temperature: Double?
    let timestamp: String?
}

struct TimelineSmartHomeSensor: Codable {
    let uuid: String
    let name: String
    let temperature: Double
    let timestamp: String
}

actor WidgetTimelineClient {
    private let baseURL: String
    private let loxoneSnr: String?
    private let loxoneCredentials: String?  // "Basic <base64>"
    private let loxoneSensorUuids: [String]?

    private static let requestTimeout: TimeInterval = 6

    init(baseURL: String, loxoneSnr: String?, loxoneCredentials: String?, loxoneSensorUuids: [String]?) {
        self.baseURL = baseURL
        self.loxoneSnr = loxoneSnr
        self.loxoneCredentials = loxoneCredentials
        self.loxoneSensorUuids = loxoneSensorUuids
    }

    /// Single request. Returns nil on any failure (timeout, non-200,
    /// malformed body). Caller falls back to cached App Group snapshot.
    func fetchTimeline(poiId: String) async -> WidgetTimelineResponse? {
        var components = URLComponents(string: "\(baseURL)/api/widget/timeline")
        components?.queryItems = [URLQueryItem(name: "poiId", value: poiId)]
        guard let url = components?.url else { return nil }

        var request = URLRequest(url: url)
        request.timeoutInterval = Self.requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Pass Loxone credentials + sensor UUIDs as headers. Backend uses
        // them to fetch the multi-sensor payload server-side and returns
        // it consolidated in smartHomeSensors[].
        if let snr = loxoneSnr, !snr.isEmpty {
            request.setValue(snr, forHTTPHeaderField: "X-Loxone-SNR")
        }
        if let creds = loxoneCredentials, !creds.isEmpty {
            request.setValue(creds, forHTTPHeaderField: "X-Loxone-Credentials")
        }
        if let uuids = loxoneSensorUuids, !uuids.isEmpty {
            request.setValue(uuids.joined(separator: ","), forHTTPHeaderField: "X-Loxone-Sensor-UUIDs")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            return try? JSONDecoder().decode(WidgetTimelineResponse.self, from: data)
        } catch {
            return nil
        }
    }
}

// MARK: - Snapshot Model
//
// All display strings are pre-computed by the host app (JS) and stored in
// the App Group. Swift just reads and renders — no symbol mapping, no
// string formatting, no business logic. The JS-side lives in
// src/providers/WeatherContext.tsx (buildWidgetSnapshot).
//
// Phase 4b: smartHomeSensors is overridden by the TimelineProvider with
// fresh values fetched directly from Loxone on every reload.

struct WidgetSnapshot: Codable {
    let locationName: String
    let weatherSymbol: String
    let weatherSymbolSmall: String
    let temperatureActual: String
    let temperatureUnit: String
    let temperatureLoxone: String?
    let temperatureLoxoneLabel: String
    let precipitation: String
    let precipitationUnit: String
    let precipitationLabel: String
    let timestampActual: String
    let refreshedAt: String
    let buildNumber: String
    // Phase 4a: array of Loxone sensors to render per family.
    // Widget picks top-N by source order (caller pre-filters).
    let smartHomeSensors: [SmartHomeSensor]?
}

struct SmartHomeSensor: Codable {
    let uuid: String
    let name: String
    let temperature: String  // pre-formatted with .toFixed(1)
    let timestamp: String
}

// MARK: - Entry

struct MeteoblickEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

// MARK: - Snapshot Reader

enum SnapshotStore {
    static let appGroup = "group.ch.meteoblick"
    static let key = "meteoblick_widget_weather_snapshot"

    /// Read the snapshot written by the host app, optionally overriding refreshedAt.
    /// Pass a HH:mm string from getTimeline() so the widget shows when it last rendered,
    /// not just when the app last fetched.
    static func read(overrideRefreshedAt: String? = nil) -> WidgetSnapshot {
        let defaults = UserDefaults(suiteName: appGroup) ?? .standard
        if let json = defaults.string(forKey: key),
           var dict = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any] {
            if let override = overrideRefreshedAt {
                dict["refreshedAt"] = override
            }
            if let data = try? JSONSerialization.data(withJSONObject: dict),
               let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) {
                return snapshot
            }
        }
        return WidgetSnapshot(
            locationName: "Keine Daten",
            weatherSymbol: "🌡️",
            weatherSymbolSmall: "☁️",
            temperatureActual: "--",
            temperatureUnit: "°C",
            temperatureLoxone: nil,
            temperatureLoxoneLabel: "🏠",
            precipitation: "0.0",
            precipitationUnit: "mm",
            precipitationLabel: "💧",
            timestampActual: "",
            refreshedAt: overrideRefreshedAt ?? "",
            buildNumber: "dev",
            smartHomeSensors: nil
        )
    }
}

// MARK: - Provider

struct MeteoblickProvider: TimelineProvider {
    typealias Entry = MeteoblickEntry

    func placeholder(in context: Context) -> MeteoblickEntry {
        MeteoblickEntry(date: Date(), snapshot: SnapshotStore.read())
    }

    func getSnapshot(in context: Context, completion: @escaping (MeteoblickEntry) -> Void) {
        // Phase 4b: read the cached snapshot synchronously so the widget
        // never shows a blank state. Then asynchronously try to refresh
        // Loxone readings in the background. The synchronous completion
        // satisfies iOS's deadline; the async refresh updates the next
        // timeline entry.
        let now = Date()
        let snapshot = SnapshotStore.read()
        completion(MeteoblickEntry(date: now, snapshot: snapshot))

        // Background refresh — write a new timeline entry when done.
        Task {
            let refreshed = await self.fetchFreshData(into: snapshot)
            if refreshed {
                WidgetCenter.shared.reloadTimelines(ofKind: "MeteoblickWidget")
            }
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MeteoblickEntry>) -> Void) {
        let now = Date()
        let defaults = UserDefaults(suiteName: SnapshotStore.appGroup)
        defaults?.set(ISO8601DateFormatter().string(from: now), forKey: "meteoblick_widget_timeline_called")

        // Phase 4b: build a single entry. Loxone readings inside the
        // snapshot are from the last JS-side push OR the most recent
        // background refresh. getSnapshot above handles the on-demand
        // background fetch.
        let fmt = DateFormatter()
        fmt.dateFormat = "HH:mm"
        let entry = MeteoblickEntry(date: now, snapshot: SnapshotStore.read(overrideRefreshedAt: fmt.string(from: now)))
        let next = now.addingTimeInterval(15 * 60)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    /// Fetch fresh data on every timeline reload: weather from the backend
    /// timeline endpoint + multi-sensor Loxone readings directly. Writes a
    /// merged snapshot back to App Group and triggers a reload. The getSnapshot
    /// call itself returns the cached snapshot synchronously so iOS's deadline
    /// is met without network IO.
    ///
    /// Returns true if the snapshot was actually updated (triggers a reload).
    private func fetchFreshData(into snapshot: WidgetSnapshot) async -> Bool {
        guard let config = WidgetConfigStore.read() else { return false }

        // Single consolidated request. Backend fetches MeteoSwiss +
        // multi-sensor Loxone on our behalf; we don't talk to Loxone
        // Cloud directly from the widget.
        guard let poiId = config.poiId, !poiId.isEmpty,
              let base = config.apiBaseUrl, !base.isEmpty else { return false }
        let client = WidgetTimelineClient(
            baseURL: base,
            loxoneSnr: config.cloudAddress,
            loxoneCredentials: config.password.isEmpty ? nil : "Basic \(config.password)",
            loxoneSensorUuids: config.showInWidgetSensorUuids
        )
        guard let timeline = await client.fetchTimeline(poiId: poiId) else { return false }

        var changed = false

        // Merge weather from timeline response (if any).
        var newLocation = snapshot.locationName
        var newWeatherSymbol = snapshot.weatherSymbol
        var newTempActual = snapshot.temperatureActual
        var newPrecip = snapshot.precipitation
        var newTimestampActual = snapshot.timestampActual
        var newTempLoxone = snapshot.temperatureLoxone
        let newLoxoneTimestamp = snapshot.temperatureLoxoneLabel
        if let loc = timeline.locationName, !loc.isEmpty { newLocation = loc; changed = true }
        if let cur = timeline.current {
            if let temp = cur.temperature { newTempActual = String(format: "%.1f", temp); changed = true }
            if let code = cur.symbolCode, let sym = Self.symbolFor(code: code) {
                newWeatherSymbol = sym; changed = true
            }
            if let p = cur.precipitation { newPrecip = String(format: "%.1f", p); changed = true }
            if let ts = cur.timestamp { newTimestampActual = ts; changed = true }
        }
        if let sh = timeline.smartHome, let temp = sh.temperature {
            newTempLoxone = String(format: "%.1f", temp)
            changed = true
        }

        // Multi-sensor Loxone readings (Phase 4b+). Use backend-provided
        // values directly; widget uses these for 1/2/6 layouts per family.
        var newSensors = snapshot.smartHomeSensors
        if let sensors = timeline.smartHomeSensors, !sensors.isEmpty {
            let existingByUuid = Dictionary(uniqueKeysWithValues: (snapshot.smartHomeSensors ?? []).map { ($0.uuid, $0) })
            newSensors = sensors.map { s in
                SmartHomeSensor(
                    uuid: s.uuid,
                    name: existingByUuid[s.uuid]?.name ?? s.name,
                    temperature: String(format: "%.1f", s.temperature),
                    timestamp: s.timestamp
                )
            }
            changed = true
        }

        guard changed else { return false }

        let updated = WidgetSnapshot(
            locationName: newLocation,
            weatherSymbol: newWeatherSymbol,
            weatherSymbolSmall: snapshot.weatherSymbolSmall,
            temperatureActual: newTempActual,
            temperatureUnit: snapshot.temperatureUnit,
            temperatureLoxone: newTempLoxone,
            temperatureLoxoneLabel: newLoxoneTimestamp,
            precipitation: newPrecip,
            precipitationUnit: snapshot.precipitationUnit,
            precipitationLabel: snapshot.precipitationLabel,
            timestampActual: newTimestampActual,
            refreshedAt: snapshot.refreshedAt,
            buildNumber: snapshot.buildNumber,
            smartHomeSensors: newSensors
        )
        if let data = try? JSONEncoder().encode(updated),
           let json = String(data: data, encoding: .utf8) {
            UserDefaults(suiteName: SnapshotStore.appGroup)?.set(json, forKey: SnapshotStore.key)
        }
        return true
    }

    /// MeteoSwiss symbolCode → emoji. Mirrors src/screens/HomeScreen.tsx.
    private static func symbolFor(code: Int) -> String? {
        switch code {
        case 1: return "☀️"
        case 2: return "🌤️"
        case 3, 4: return "⛅"
        case 5, 6: return "☁️"
        case 7, 8, 9: return "🌧️"
        case 10, 11, 12: return "⛈️"
        case 13, 14, 15: return "🌨️"
        default: return "🌡️"
        }
    }
}

// MARK: - View

struct MeteoblickView: View {
    let entry: MeteoblickEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        let s = entry.snapshot
        let isSmall = family == .systemSmall
        let isLarge = family == .systemLarge || family == .systemExtraLarge
        let isCircular = family == .accessoryCircular
        let isRectangular = family == .accessoryRectangular

        if isSmall {
            smallBody(s: s)
        } else if isLarge {
            largeBody(s: s)
        } else if isCircular {
            circularBody(s: s)
        } else if isRectangular {
            rectangularBody(s: s)
        } else {
            mediumBody(s: s)
        }
    }

    @ViewBuilder
    private func smallBody(s: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            // Location name — centered, wraps to 2 lines if needed
            Text(s.locationName)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.white)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, alignment: .center)

            // Weather emoji + temperature — centered, directly below location
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(s.weatherSymbol)
                    .font(.system(size: 20))
                Text(s.temperatureActual)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.white)
                Text(s.temperatureUnit)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white)
            }
            .frame(maxWidth: .infinity, alignment: .center)

            // Phase 5+: up to 2 Loxone sensors (158pt is tight).
            // 16pt padding + body-size font for HIG readability.
            ForEach(Array(s.smartHomeSensors?.prefix(2) ?? []), id: \.uuid) { sensor in
                SensorRowCompact(sensor: sensor, fontSize: 17, nameFontSize: 11)
            }
        }
        .padding(0)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private func mediumBody(s: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            // Location name — left-aligned
            Text(s.locationName)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white)
                .lineLimit(1)

            // Weather emoji + temperature — left-aligned, directly below
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(s.weatherSymbol)
                    .font(.system(size: 24))
                Text(s.temperatureActual)
                    .font(.system(size: 34, weight: .bold))
                    .foregroundColor(.white)
                Text(s.temperatureUnit)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundColor(.white)
            }

            Spacer(minLength: 0)

            // Phase 5+: 2x2 grid for up to 4 Loxone sensors in the
            // lower half of the medium widget. Top-left + top-right
            // (row 1), bottom-left + bottom-right (row 2). Each cell
            // shows the sensor name + temperature. Compact font
            // (15pt temp / 9pt name) fits the 338x158 layout.
            let sensors = Array(s.smartHomeSensors?.prefix(4) ?? [])
            if sensors.count >= 2 {
                let columns = [
                    GridItem(.flexible(), spacing: 4),
                    GridItem(.flexible(), spacing: 4),
                ]
                LazyVGrid(columns: columns, spacing: 4) {
                    ForEach(sensors, id: \.uuid) { sensor in
                        SensorRowCompact(sensor: sensor, fontSize: 18, nameFontSize: 9)
                    }
                }
            } else if sensors.count == 1 {
                SensorRowCompact(sensor: sensors[0], fontSize: 18, nameFontSize: 12)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    /// Phase 5+: large widget — 3×2 grid of up to 6 Loxone sensors
    @ViewBuilder
    private func largeBody(s: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(s.locationName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Spacer()
                Text(s.weatherSymbol)
                    .font(.system(size: 24))
            }

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(s.weatherSymbol)
                    .font(.system(size: 20))
                Text(s.temperatureActual)
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(.white)
                Text(s.temperatureUnit)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)
                if Double(s.precipitation) ?? 0 > 0 {
                    Spacer()
                    Text("\(s.precipitationLabel) \(s.precipitation) \(s.precipitationUnit)")
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.9))
                }
            }

            // Sensor grid: 3 columns × 2 rows = up to 6 sensors.
            let sensors = Array(s.smartHomeSensors?.prefix(6) ?? [])
            let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(sensors, id: \.uuid) { sensor in
                    SensorCard(sensor: sensor)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    /// Phase 5+: Lock Screen circular widget — weather OR one Smart Home
    /// sensor. Per-user config (lockScreenCircular in WidgetConfig).
    @ViewBuilder
    private func circularBody(s: WidgetSnapshot) -> some View {
        let cfg = WidgetConfigStore.read()
        let choice = cfg?.lockScreenCircular ?? "weather"
        if choice == "weather" {
            // Weather: emoji + temperature stacked.
            VStack(spacing: 0) {
                Text(s.weatherSymbol)
                    .font(.system(size: 18))
                Text(s.temperatureActual)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }
            .padding(2)
        } else {
            // Single sensor: name + temperature.
            let sensor = s.smartHomeSensors?.first(where: { $0.uuid == choice })
            VStack(spacing: 0) {
                Text(sensor?.name ?? "🏠")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.white.opacity(0.85))
                    .lineLimit(1)
                Text((sensor?.temperature ?? "--") + "°")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }
            .padding(2)
        }
    }

    /// Phase 5+: Lock Screen rectangular widget — weather + top-N sensors
    /// (max 2 for readability on Lock Screen).
    @ViewBuilder
    private func rectangularBody(s: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            // Weather line
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(s.weatherSymbol)
                    .font(.system(size: 14))
                Text(s.temperatureActual + s.temperatureUnit)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
            }

            // Up to 2 sensors
            ForEach(Array(s.smartHomeSensors?.prefix(2) ?? []), id: \.uuid) { sensor in
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(sensor.name)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.white.opacity(0.85))
                        .lineLimit(1)
                    Spacer()
                    Text(sensor.temperature + "°")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Sensor views (Phase 4a)

/// Compact sensor row — small (single line: name + temp) or medium
/// (used as inline pill in the medium widget).
struct SensorRowCompact: View {
    let sensor: SmartHomeSensor
    let fontSize: CGFloat
    let nameFontSize: CGFloat

    var body: some View {
        HStack(spacing: 4) {
            VStack(alignment: .leading, spacing: 0) {
                Text(sensor.name)
                    .font(.system(size: nameFontSize, weight: .medium))
                    .foregroundColor(.white.opacity(0.85))
                    .lineLimit(1)
                Text(sensor.temperature + "°")
                    .font(.system(size: fontSize, weight: .semibold))
                    .foregroundColor(.white)
            }
            Spacer(minLength: 0)
        }
    }

}

/// Card-style sensor for the 3×2 large-widget grid.
struct SensorCard: View {
    let sensor: SmartHomeSensor

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(sensor.name)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.white.opacity(0.85))
                .lineLimit(1)
            Text(sensor.temperature + "°")
                .font(.system(size: 22, weight: .semibold))
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.white.opacity(0.12))
        )
    }
}

// MARK: - Widget

struct MeteoblickWidget: Widget {
    let name = "MeteoblickWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: name, provider: MeteoblickProvider()) { entry in
            MeteoblickView(entry: entry)
                .containerBackground(for: .widget) {
                    LinearGradient(
                        colors: [
                            Color(red: 0.345, green: 0.745, blue: 0.965), // #58BEF6
                            Color(red: 0.200, green: 0.400, blue: 0.800), // #3366CC
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                }
        }
        .configurationDisplayName("Meteoblick")
        .description("Wetter für deinen Standort")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
        ])
    }
}
