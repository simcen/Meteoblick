/**
 * Scope — Apple Watch complication for a single Smart Home sensor.
 *
 * RESEARCH NOTES (PM/PO framing)
 *
 *   Similar apps (research):
 *     - HomeKit / Home app: Watch complications show device states
 *       (one value per complication). User picks the device in the iOS
 *       Home app, not on the Watch.
 *     - Weather apps (Carrot, native Weather): single value per
 *       complication, configured via AppIntent in iOS 17+/watchOS 10+.
 *     - Home Assistant / Hubitat: typically one entity per
 *       complication; configuration lives in the iOS companion app.
 *
 *   Apple HIG (watchOS 12+):
 *     - Timeline budget tightened — complications can only reload a
 *       limited number of times per day, scaled by view frequency.
 *     - One value, glanceable, high contrast, no interactivity in the
 *       value itself.
 *     - AppIntent-based config (iOS 17+/watchOS 10+) is the
 *       recommended way to let users pick per-instance options.
 *
 *   watchOS complication families (WidgetKit):
 *     - accessoryCircular     ~76pt square
 *     - accessoryRectangular  ~160pt wide × ~76pt tall
 *     - accessoryInline       single line of text (Lock Screen only,
 *                              not on watch faces — so skip)
 *     - accessoryCorner       corner of watch face
 *
 * PROBLEM (PM/PO framing)
 *   User has multiple Loxone sensors (outdoor, pool, etc.) and wants
 *   to glance at one on the Watch face. The widget on iOS Lock Screen
 *   already supports this (per the multi-instance spec). Apple Watch
 *   needs the same capability but on a different physical surface.
 *
 * TARGET USERS
 *   You (single primary user). Apple Watch Series 4+ on watchOS 10+
 *   for AppIntent. Older watches fall back to the in-app picker (the
 *   same fallback as the iOS Lock Screen widget uses for iOS 16).
 *
 * ARCHITECTURE
 *   Reuse the `WidgetConfigIntent` from the Lock Screen widget. One
 *   Swift intent shared by iOS + watchOS. Different WidgetFamily in
 *   each target.
 *
 *   ┌──────────────────────────┐
 *   │ Apple Watch face         │
 *   │  ┌────┐  ┌──────┐         │
 *   │  │ 22°│  │Pool  │         │  ← 2 complications, each picks
 *   │  └────┘  └──────┘         │     its own metric (AppIntent)
 *   │  Wetter   Pool             │
 *   └──────────────────────────┘
 *
 *   ┌────────────────────────────────┐
 *   │ iOS Lock Screen                │
 *   │  ┌────┐  ┌────┐                │  ← Same intent, different
 *   │  │ 22°│  │ 24°│                │     target. Code reuse.
 *   │  └────┘  └────┘                │
 *   └────────────────────────────────┘
 *
 *   Both share `WidgetConfigIntent.metric: MetricEntity` — the same
 *   picker UI iOS shows in the widget gallery is the same UI watchOS
 *   shows in the watch face editor.
 *
 * DECISIONS
 *   D1. Configuration model: AppIntent (iOS 17+/watchOS 10+). Each
 *       complication instance picks its own metric in iOS / watchOS
 *       config UI. Falls back to the app-level `WidgetConfig` for
 *       iOS 16 / watchOS 9.
 *   D2. Complication families: support `accessoryCircular` and
 *       `accessoryRectangular`. Skip `accessoryInline` (Lock Screen
 *       only) and `accessoryCorner` (rare, Apple Watch face corner).
 *   D3. Watch target: separate Xcode target. Share Swift source via
 *       a shared file (`MeteoblickWidget.swift` reused, conditional
 *       `#if canImport(WidgetKit)` for the widget classes, etc.).
 *   D4. Background refresh: respect watchOS 12 budget. Update only on
 *       app foreground (host app writes to App Group) — no
 *       `WKApplicationRefreshBackgroundTask` needed. The complication
 *       reads the App Group snapshot like the Lock Screen widget.
 *   D5. Same `WidgetConfigIntent` as iOS. One Swift intent, reused.
 *   D6. Add `WidgetConfig.lockScreenCircular` is irrelevant here
 *       — watchOS always reads the AppIntent config. App Group
 *       fallback is only for old watches (watchOS 9).
 *
 * PHASING
 *   1. Add watchOS target to Xcode (MeteoblickWatch) with
 *      WidgetKit + AppIntents entitlements
 *   2. Reuse MeteoblickWidget.swift (extract the shared logic, gate
 *      the WidgetConfiguration behind a canImport() check)
 *   3. Add `WidgetConfigIntent` already exists — just make sure the
 *      watchOS target uses the same App Group entitlement
 *   4. Add `accessoryCircular` and `accessoryRectangular` body
 *      branches in the watchOS view layer
 *   5. App Group + iOS host app: no change — already writes the
 *      snapshot
 *   6. WatchOS build verification (xcodebuild -scheme MeteoblickWatch)
 *
 * OPEN QUESTIONS
 *   - Watch App bundle ID: `ch.m.meteoblick.watchapp` (sibling) vs
 *     embedded in the main app? Sibling is the standard pattern.
 *   - Entitlement sharing: Watch app needs the App Group entitlement
 *     so the WidgetExtension can read the same App Group as the iOS
 *     app. Add it to MeteoblickWatch.entitlements.
 *   - First-launch on watch: do we need a Watch app shell, or is the
 *     WidgetExtension alone enough? WidgetExtensions on watchOS
 *     work without a host app, but the user can't browse the App
 *     Store without a separate Watch app listing.
 *   - Hosting the Watch app: App Store Connect requires a separate
 *     listing with a bundle ID. Plus the iOS app must list it as a
 *     dependency.
 *
 * OUT OF SCOPE
 *   - Multiple complications showing multiple sensors at once
 *     (we keep one value per complication, as per Apple HIG).
 *   - Interactive complications (tap → action). Complications are
 *     display-only on watchOS.
 *   - Smart Stack rotation / live activities on Watch.
 *   - watchOS 9 fallback testing (we know it works via WidgetConfig
 *     read; no widget extension UI for picking).
 *
 * REFS
 *   - [Apple: Timeline budget for Apple Watch](https://developer.apple.com/documentation/widgetkit/timeline-budget)
 *   - [Apple: Configuring AppIntents for WatchOS complications](https://developer.apple.com/documentation/appintents/configuring-watch-complications)
 *   - [WWDC 2025: What's new in WidgetKit for Apple Watch](https://developer.apple.com/wwdc/2025/sessions/widgetkit-watch)
 */
