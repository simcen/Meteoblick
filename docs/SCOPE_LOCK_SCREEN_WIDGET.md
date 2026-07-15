/**
 * Scope — iOS 16+ Lock Screen widget (PM/PO spec).
 *
 * This is the canonical scope doc for adding Lock Screen + Always-On
 * Display widget support to the existing MeteoblickWidget extension.
 * Read this top-to-bottom; the decisions (D1–D6) below have defaults
 * already chosen. Push back at any of them before implementation.
 *
 * PROBLEM (PM/PO framing)
 *   The user (you) opens the iPhone dozens of times a day. The first
 *   question on the Lock Screen is "what's the temperature?". Today
 *   the answer requires: pick up phone, glance at Lock Screen (no info),
 *   unlock, open Meteoblick app, wait for fetch, scroll. ~6 seconds
 *   of friction.
 *
 *   A Lock Screen widget removes the entire chain. Glanceable weather
 *   in <1 second, no unlock. iOS 16+ accessory widgets are purpose-built
 *   for this (iPhone 14 Pro+ AOD also shows them dimmed).
 *
 * TARGET USERS
 *   - The user (you) — single primary user of the app. Family might
 *     inherit the widget if they glance at your phone, but you are
 *     the audience.
 *   - Anyone with iOS 16+ and an iPhone 14 Pro+ for AOD.
 *
 * CURRENT STATE
 *   MeteoblickWidget extension supports only:
 *     .systemSmall    (158×158pt)
 *     .systemMedium   (338×158pt)
 *     .systemLarge    (338×354pt)
 *   iOS 16+ accessory families (Lock Screen + AOD) are NOT supported.
 *   backend `/api/widget/timeline` already returns all needed data
 *   (location, weather, multi-sensor) — no backend changes needed.
 *
 * PROPOSED FAMILIES (D1, D2 — locked)
 *   We add 2 Lock Screen families; 3rd (inline) is deferred.
 *
   ┌─────────────────────────┐
 *   │ accessoryCircular       │  ~76pt square
 *   │      ┌─────┐             │  User-configurable: MeteoSwiss
 *   │      │ 22° │             │  OR one Smart Home sensor
 *   │      └─────┘             │  (default: MeteoSwiss)
 *   └─────────────────────────┘  on iPhone 14 Pro+.
 *
 *   ┌─────────────────────────────────────────┐
 *   │ accessoryRectangular (max 4 lines)         │  ~160pt × ~76pt+
 *   │ 22.5° ☀  Aussen                          │
 *   │ 18.0° 🏠  Pool                           │  Up to 2 primary sensor
 *   │ 16.5° 🏠  Heizung                        │  values + weather.
 *   └─────────────────────────────────────────┘
 *
 * CONTENT (D3 — locked)
 *   accessoryCircular  : ONE line, CONFIGURABLE per-user:
 *                          a) MeteoSwiss:  🌤 22°
 *                          b) Smart Home:   🏠 22.5°  Pool
 *                        Configurable in app settings (Lock Screen
 *                        section). Default: MeteoSwiss. Users who care
 *                        more about home temp than weather can switch.
 *
 *   accessoryRectangular: weather + top-N sensors
 *                          by showInWidget order (max 2 lines for
 *                          readability on Lock Screen)
 *
 *   NO buttons, NO scrolling, NO interactivity — Apple's accessory
 *   widget policy. Display-only.
 *
 * DATA SOURCE (D4 — locked)
 *   Same `MeteoblickWidgetSnapshot` already written by the host app
 *   to the App Group. No new snapshot type, no new fetch path. The
 *   widget just branches on `widgetFamily` like it already does for
 *   systemSmall/systemMedium/systemLarge.
 *
 * ALWAYS-ON DISPLAY (D5 — locked)
 *   Yes, we support AOD. iOS automatically dims the widget when the
 *   screen is locked / in AOD. We provide the same widget content;
 *   iOS handles the visual treatment. No code change needed.
 *
 * NEW EXTENSION? (D6 — locked)
 *   No, we add the new families to the EXISTING `MeteoblickWidget`
 *   extension. One target, multiple families, one `WidgetSnapshot`.
 *   Matches the existing pattern.
 *
 * REFRESH CADENCE
 *   Same as today: 15-min timeline. iOS controls the actual cadence.
 *   The host app's BG-fetch + the widget's own timeline refresh keep
 *   the data current; Lock Screen widget just reads the latest snapshot.
 *
 * OPEN QUESTIONS (none — all D1–D6 locked)
 *
 * RISKS
 *   - Multi-sensor cramping: 4 sensor lines in a 76pt-tall rectangular
 *     widget is too tight. Limit to 2 sensors + weather in rectangular.
 *   - WatchOS / macOS widgets: out of scope (separate backlog if needed).
 *   - Inline widget (single line above date): deferred — minimal value
 *     for a single info line. Re-evaluate if users want a "glance"
 *     mode later.
 *
 * PHASING
 *   1. Add `lockScreenCircular` field to `WidgetConfig` (SharedStorage
 *      mirror): "weather" | "<sensor-uuid>". Default: "weather".
 *   2. Update WidgetConfigurable.supportedFamilies in widget Swift
 *      to add .accessoryCircular, .accessoryRectangular.
 *   3. Add body branches in MeteoblickView for the new families.
 *      Use the SAME `WidgetSnapshot`; only the layout differs.
 *   4. widgetManager.ts: NO changes (snapshot is family-agnostic).
 *   5. Add UI in app: Lock Screen section in LoxoneConfigScreen or
 *      a new "Widget" section for picking the circular metric.
 *   6. Tests: existing smoke test still mounts the screen.
 *
 * OUT OF SCOPE
 *   - Lock Screen widget interactivity (Apple policy)
 *   - WatchOS / macOS / Android widgets
 *   - Standalone Lock Screen extension target
 *   - Inline widget family (deferred)
 *
 * DECISIONS (FINAL)
 *   D1. Lock Screen families: RECTANGULAR + CIRCULAR.
 *   D2. Inline deferred.
 *   D3. Rectangular content: weather + up to 2 sensors by showInWidget
 *       order. Circular: weather + temp only.
 *   D4. Data source: same `MeteoblickWidgetSnapshot`.
 *   D5. AOD: yes, supported.
 *   D6. Same extension target.
 */
