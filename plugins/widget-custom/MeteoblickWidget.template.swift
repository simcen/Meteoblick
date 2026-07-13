import WidgetKit
import SwiftUI

// MARK: - Snapshot Model
//
// All display strings are pre-computed by the host app (JS) and stored in
// the App Group. Swift just reads and renders — no symbol mapping, no
// string formatting, no business logic. The JS-side lives in
// src/providers/WeatherContext.tsx (buildWidgetSnapshot).

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
        completion(MeteoblickEntry(date: Date(), snapshot: SnapshotStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MeteoblickEntry>) -> Void) {
        let now = Date()
        let defaults = UserDefaults(suiteName: SnapshotStore.appGroup)
        defaults?.set(ISO8601DateFormatter().string(from: now), forKey: "meteoblick_widget_timeline_called")
        let fmt = DateFormatter()
        fmt.dateFormat = "HH:mm"
        let entry = MeteoblickEntry(date: now, snapshot: SnapshotStore.read(overrideRefreshedAt: fmt.string(from: now)))
        // Refresh every 15 min; iOS may override.
        let next = now.addingTimeInterval(15 * 60)
        completion(Timeline(entries: [entry], policy: .after(next)))
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
