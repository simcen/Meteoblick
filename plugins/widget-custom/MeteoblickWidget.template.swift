import WidgetKit
import SwiftUI

// MARK: - Loxone Widget Client (Phase 4b)
//
// Minimal URLSession client that fetches a sensor's current value
// directly from Loxone Cloud. The host app (JS) stores credentials +
// showInWidget sensor UUIDs in the App Group via SharedStorage.
// This client is invoked by the widget TimelineProvider on each
// timeline reload so the widget stays current independently of the
// host app (per scope D8).
//
// Mirror of the JS-side LoxoneAPI in src/api/loxone.ts but minimal:
//   - Cloud only (no local DNS lookup — user is on cloud)
//   - Raw password (skip SHA-256 token dance; slightly less efficient
//     but simpler — Loxone accepts raw for /jdev/sps/io/{uuid})
//   - Per-request timeout (6s) so the widget timeline budget holds

struct LoxoneSensorReading {
    let uuid: String
    let temperature: Double
    let timestamp: Date
}

struct LoxoneWidgetConfig: Codable {
    let cloudAddress: String
    let username: String
    let password: String
    let showInWidgetSensorUuids: [String]?
    let poiId: String?
    let apiBaseUrl: String?
}

enum LoxoneConfigStore {
    static let appGroup = "group.ch.meteoblick"
    static let key = "loxone_config_widget"  // matches WIDGET_LOXONE_CONFIG_KEY

    static func read() -> LoxoneWidgetConfig? {
        let defaults = UserDefaults(suiteName: appGroup) ?? .standard
        guard let json = defaults.string(forKey: key),
              let data = json.data(using: .utf8),
              let config = try? JSONDecoder().decode(LoxoneWidgetConfig.self, from: data) else {
            return nil
        }
        return config
    }
}

// MARK: - Widget Timeline Client
//
// Calls /api/widget/timeline?poiId=... for consolidated weather data
// (MeteoSwiss + single-sensor Loxone). Mirrors the JS-side
// fetchAndWriteWidgetTimeline call so the widget can refresh on its
// own timeline independently of the host app.

struct WidgetTimelineResponse: Codable {
    let locationName: String?
    let current: TimelineCurrent?
    let forecast: TimelineForecast?
    let smartHome: TimelineSmartHome?
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

actor WidgetTimelineClient {
    private let baseURL: String

    init(baseURL: String) {
        self.baseURL = baseURL
    }

    private static let requestTimeout: TimeInterval = 6

    /// Fetch the consolidated weather payload. Returns nil on any failure
    /// (timeout, non-200, malformed body). Caller falls back to cached
    /// App Group snapshot.
    func fetchTimeline(poiId: String) async -> WidgetTimelineResponse? {
        let urlString = "\(baseURL)/api/widget/timeline?poiId=\(poiId)"
        guard let url = URL(string: urlString) else { return nil }
        var request = URLRequest(url: url)
        request.timeoutInterval = Self.requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            return try? JSONDecoder().decode(WidgetTimelineResponse.self, from: data)
        } catch {
            return nil
        }
    }
}

actor LoxoneWidgetClient {
    private let cloudAddress: String
    private let username: String
    private let password: String

    private static let requestTimeout: TimeInterval = 6

    init(cloudAddress: String, username: String, password: String) {
        self.cloudAddress = cloudAddress
        self.username = username
        self.password = password
    }

    /// Fetch one sensor. Returns nil on any failure (timeout, non-200,
    /// malformed body). Caller falls back to cached snapshot value.
    func fetchTemperature(uuid: String) async -> LoxoneSensorReading? {
        // Cloud URL: https://connect.loxonecloud.com/{SNR}/jdev/sps/io/{uuid}
        // Auth: HTTP Basic in URL userinfo (Cloud's HTTPS reverse proxy
        // does not forward Authorization headers — same constraint as JS).
        let urlString = "https://connect.loxonecloud.com/\(cloudAddress)/jdev/sps/io/\(uuid)"
        guard var components = URLComponents(string: urlString) else { return nil }
        components.user = username
        components.password = password
        guard let url = components.url else { return nil }

        var request = URLRequest(url: url)
        request.timeoutInterval = Self.requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            // Body: {"LL": {"value": "23.5"}}
            guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let inner = dict["LL"] as? [String: Any],
                  let valueStr = inner["value"] as? String,
                  let value = Double(valueStr) else { return nil }
            return LoxoneSensorReading(uuid: uuid, temperature: value, timestamp: Date())
        } catch {
            return nil
        }
    }

    /// Fetch all sensors in parallel. Failed sensors are dropped; caller
    /// can fall back to per-sensor cached values from the snapshot.
    func fetchTemperatures(uuids: [String]) async -> [LoxoneSensorReading] {
        await withTaskGroup(of: LoxoneSensorReading?.self) { group in
            for uuid in uuids {
                group.addTask { [weak self] in
                    await self?.fetchTemperature(uuid: uuid)
                }
            }
            var results: [LoxoneSensorReading] = []
            for await reading in group {
                if let r = reading { results.append(r) }
            }
            return results
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
        guard let loxoneConfig = LoxoneConfigStore.read() else { return false }

        // Parallel: weather (backend) + Loxone sensors (direct).
        async let timelineResult: WidgetTimelineResponse? = {
            guard let poiId = loxoneConfig.poiId, !poiId.isEmpty,
                  let base = loxoneConfig.apiBaseUrl, !base.isEmpty else { return nil }
            let client = WidgetTimelineClient(baseURL: base)
            return await client.fetchTimeline(poiId: poiId)
        }()
        async let loxoneReadings: [LoxoneSensorReading] = {
            guard let uuids = loxoneConfig.showInWidgetSensorUuids, !uuids.isEmpty else { return [] }
            let client = LoxoneWidgetClient(
                cloudAddress: loxoneConfig.cloudAddress,
                username: loxoneConfig.username,
                password: loxoneConfig.password
            )
            return await client.fetchTemperatures(uuids: uuids)
        }()
        let timeline = await timelineResult
        let readings = await loxoneReadings

        var changed = false

        // Merge weather from timeline response (if any).
        var newLocation = snapshot.locationName
        var newWeatherSymbol = snapshot.weatherSymbol
        var newTempActual = snapshot.temperatureActual
        var newPrecip = snapshot.precipitation
        var newTimestampActual = snapshot.timestampActual
        var newTempLoxone = snapshot.temperatureLoxone
        let newLoxoneTimestamp = snapshot.temperatureLoxoneLabel
        if let t = timeline {
            if let loc = t.locationName, !loc.isEmpty { newLocation = loc; changed = true }
            if let cur = t.current {
                if let temp = cur.temperature { newTempActual = String(format: "%.1f", temp); changed = true }
                if let code = cur.symbolCode, let sym = Self.symbolFor(code: code) {
                    newWeatherSymbol = sym; changed = true
                }
                if let p = cur.precipitation { newPrecip = String(format: "%.1f", p); changed = true }
                if let ts = cur.timestamp { newTimestampActual = ts; changed = true }
            }
            if let sh = t.smartHome, let temp = sh.temperature {
                newTempLoxone = String(format: "%.1f", temp)
                changed = true
            }
        }

        // Merge multi-sensor Loxone readings.
        var newSensors = snapshot.smartHomeSensors
        if !readings.isEmpty {
            let existingByUuid = Dictionary(uniqueKeysWithValues: (snapshot.smartHomeSensors ?? []).map { ($0.uuid, $0) })
            let isoNow = ISO8601DateFormatter().string(from: Date())
            let sensorUuids = loxoneConfig.showInWidgetSensorUuids ?? []
            newSensors = sensorUuids.map { uuid in
                if let fresh = readings.first(where: { $0.uuid == uuid }) {
                    let name = existingByUuid[uuid]?.name ?? uuid
                    let temp = String(format: "%.1f", fresh.temperature)
                    return SmartHomeSensor(uuid: uuid, name: name, temperature: temp, timestamp: isoNow)
                }
                if let prev = existingByUuid[uuid] { return prev }
                return SmartHomeSensor(uuid: uuid, name: uuid, temperature: "--", timestamp: isoNow)
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

        if isSmall {
            smallBody(s: s)
        } else if isLarge {
            largeBody(s: s)
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

            // Phase 4a: up to 2 Loxone sensors stacked vertically
            ForEach(Array(s.smartHomeSensors?.prefix(2) ?? []), id: \.uuid) { sensor in
                SensorRowCompact(sensor: sensor, fontSize: 14, nameFontSize: 9)
            }
        }
        .padding(6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private func mediumBody(s: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            // Location name — left-aligned
            Text(s.locationName)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white)
                .lineLimit(1)

            // Weather emoji + temperature — left-aligned, directly below
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(s.weatherSymbol)
                    .font(.system(size: 22))
                Text(s.temperatureActual)
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(.white)
                Text(s.temperatureUnit)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)
            }

            Spacer(minLength: 0)

            // Phase 4a: up to 2 Loxone sensors side-by-side
            let sensors = Array(s.smartHomeSensors?.prefix(2) ?? [])
            if !sensors.isEmpty {
                HStack(spacing: 8) {
                    ForEach(sensors, id: \.uuid) { sensor in
                        SensorRowCompact(sensor: sensor, fontSize: 16, nameFontSize: 10)
                            .frame(maxWidth: .infinity)
                    }
                }
            }

            // Precipitation (shown if > 0)
            if Double(s.precipitation) ?? 0 > 0 {
                HStack(spacing: 4) {
                    Text(s.precipitationLabel)
                        .font(.system(size: 10))
                    Text("\(s.precipitation) \(s.precipitationUnit)")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.white)
                }
            }

            // Footer: timestamps + build
            HStack(spacing: 6) {
                if !s.timestampActual.isEmpty {
                    Text("📊 \(s.timestampActual)")
                        .font(.system(size: 8))
                        .foregroundColor(.white.opacity(0.7))
                }
                if !s.refreshedAt.isEmpty {
                    Text("🔄 \(s.refreshedAt)")
                        .font(.system(size: 8))
                        .foregroundColor(.white.opacity(0.7))
                }
                Spacer()
                Text("Build \(s.buildNumber)")
                    .font(.system(size: 8))
                    .foregroundColor(.white.opacity(0.7))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    /// Phase 4a: large widget — 3×2 grid of up to 6 Loxone sensors
    @ViewBuilder
    private func largeBody(s: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(s.locationName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Spacer()
                Text(s.weatherSymbol)
                    .font(.system(size: 22))
            }

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(s.weatherSymbol)
                    .font(.system(size: 18))
                Text(s.temperatureActual)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.white)
                Text(s.temperatureUnit)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                if Double(s.precipitation) ?? 0 > 0 {
                    Spacer()
                    Text("\(s.precipitationLabel) \(s.precipitation) \(s.precipitationUnit)")
                        .font(.system(size: 11))
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
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.white.opacity(0.85))
                .lineLimit(1)
            Text(sensor.temperature + "°")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(6)
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
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
