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

    /// Read the snapshot written by the host app. Returns a sensible
    /// default if the app hasn't run yet (or if it's been a while).
    static func read() -> WidgetSnapshot {
        let defaults = UserDefaults(suiteName: appGroup) ?? .standard
        if let data = defaults.data(forKey: key),
           let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) {
            return snapshot
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
            refreshedAt: "",
            buildNumber: "dev"
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
        let entry = MeteoblickEntry(date: Date(), snapshot: SnapshotStore.read())
        // Refresh every 15 min; iOS may override.
        let next = Date().addingTimeInterval(15 * 60)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - View

struct MeteoblickView: View {
    let entry: MeteoblickEntry
    let family: WidgetFamily

    init(entry: MeteoblickEntry, family: WidgetFamily) {
        self.entry = entry
        self.family = family
    }

    var body: some View {
        let s = entry.snapshot
        let isSmall = family == .systemSmall
        let isMedium = family == .systemMedium
        let _ = isMedium  // large layouts use medium spacing

        VStack(alignment: .leading, spacing: isSmall ? 2 : 4) {
            // Header: location + weather symbol
            HStack(spacing: 4) {
                Text(s.locationName)
                    .font(.system(size: isSmall ? 11 : 13, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Spacer()
                Text(s.weatherSymbol)
                    .font(.system(size: isSmall ? 16 : 22))
            }

            Spacer(minLength: 0)

            // MeteoSwiss IST temperature
            HStack(spacing: 2) {
                Text(s.weatherSymbolSmall)
                    .font(.system(size: 10))
                Text(s.temperatureActual)
                    .font(.system(size: isSmall ? 24 : 32, weight: .bold))
                    .foregroundColor(.white)
                Text(s.temperatureUnit)
                    .font(.system(size: isSmall ? 12 : 16, weight: .medium))
                    .foregroundColor(.white)
            }

            // Loxone Smart-Home (medium+ only, if available)
            if let lxTemp = s.temperatureLoxone, !isSmall {
                HStack(spacing: 2) {
                    Text(s.temperatureLoxoneLabel)
                        .font(.system(size: 10))
                    Text(lxTemp + "°")
                        .font(.system(size: isSmall ? 12 : 14, weight: .semibold))
                        .foregroundColor(.white)
                }
            }

            // Precipitation (medium+ only, shown if > 0)
            if !isSmall, Double(s.precipitation) ?? 0 > 0 {
                HStack(spacing: 4) {
                    Text(s.precipitationLabel)
                        .font(.system(size: 10))
                    Text("\(s.precipitation) \(s.precipitationUnit)")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.white)
                }
            }

            Spacer(minLength: 0)

            // Footer: timestamps + build (medium+ only)
            if !isSmall {
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
        }
        .padding(isSmall ? 8 : 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Widget

struct MeteoblickWidget: Widget {
    let name = "MeteoblickWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: name, provider: MeteoblickProvider()) { entry in
            MeteoblickView(entry: entry, family: .systemSmall)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Meteoblick")
        .description("Wetter für deinen Standort")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
