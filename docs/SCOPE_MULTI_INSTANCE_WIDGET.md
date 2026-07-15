/**
 * Scope — Multi-instance Lock Screen widget via iOS 17+ AppIntent
 * (supersedes the per-user `lockScreenCircular` config).
 *
 * PROBLEM (PM/PO framing)
 *   The previous approach (one widget, one per-user config in the app)
 *   forces the user to choose between "Wetter" OR "Pool" OR "Heizung"
 *   — only one value at a time. With multi-instance widgets (iOS 17+),
 *   the user can add 2× or 3× of the same widget, each configured
 *   independently. That's how Apple Music, Weather, etc. work.
 *
 * TARGET USERS
 *   You (single primary user). iOS 17+ for multi-instance. iOS 16
 *   falls back to the per-user config in the app (one widget, one
 *   metric). Same backend payload, two consumption paths.
 *
 * ARCHITECTURE
 *   ┌─────────────────────────┐
 *   │ iOS Lock Screen          │
 *   │  ┌────┐  ┌────┐          │
 *   │  │ 22°│  │ 24°│          │  ← 2 instances, each configured
 *   │  └────┘  └────┘          │     differently (Weather vs Pool)
 *   │  Wetter   Pool           │
 *   └─────────────────────────┘
 *
 *   One widget code path, two or more iOS Lock-Screen slots. Each
 *   instance carries its own `metric` parameter (AppIntent).
 *
 *   ┌──────────────────────────────────┐
 *   │ Meteoblick — Wetter    ›         │  ← iOS widget gallery config
 *   │ Meteoblick — Pool       ›         │     sheet (iOS 17+)
 *   │ Meteoblick — Aussen     ›         │
 *   │ Meteoblick — Heizung    ›         │
 *   └──────────────────────────────────┘
 *
 *   The widget reads `Configuration.metric` and renders the matching
 *   value. The app provides `WidgetConfig` as a fallback (iOS 16 + the
 *   case where AppIntent is unavailable).
 *
 * PROPOSED STATE FLOW
 *   1. User adds Meteoblick widget to Lock Screen
 *   2. iOS shows configuration sheet (iOS 17+ only):
 *      - Wetter (default)
 *      - Pool, Aussen, Heizung, ... (one option per showInWidget sensor)
 *   3. User picks "Pool", widget shows Pool temperature
 *   4. User adds second Meteoblick widget, picks "Wetter"
 *   5. Lock Screen now shows both
 *
 *   iOS 16: configuration sheet not shown. Widget reads `WidgetConfig`
 *   from App Group (the per-user `lockScreenCircular` setting we
 *   already built). One widget, one metric.
 *
 * DECISIONS
 *   D1. AppIntent type: enum with cases `.weather` and
 *       `.sensor(uuid: String)`. Single enum, no nested types.
 *   D2. iOS 16 fallback: keep the current in-app `lockScreenCircular`
 *       config. When AppIntent is unavailable, widget reads
 *       `WidgetConfig.lockScreenCircular`. Both paths share the same
 *       rendering code (`choice = config.metric ?? .weather`).
 *   D3. Default metric: `.weather`.
 *   D4. iOS widget gallery description per metric: dynamic
 *       ("Meteoblick · Wetter", "Meteoblick · Pool", etc.) via the
 *       AppIntent's `displayRepresentation`.
 *   D5. Remove the in-app widget-config picker from LoxoneConfigScreen
 *       (since iOS does the config). Add a hint in the Home-Screen
 *       showing how to add the widget to Lock Screen.
 *   D6. Single widget code path handles both: AppIntent (iOS 17+) and
 *       WidgetConfig fallback (iOS 16). No branching in the body.
 *
 * PHASING
 *   1. Add `WidgetConfigIntent` in Swift with `metric: Metric` parameter
 *   2. Refactor `circularBody` to read from `Configuration.metric`
 *      (or WidgetConfig fallback for iOS 16)
 *   3. Wire `AppIntentConfiguration(intent: WidgetConfigIntent.self)`
 *      into the widget definition
 *   4. Remove the in-app `lockScreenCircular` picker from
 *      LoxoneConfigScreen
 *   5. Add a hint to Home-Screen / LoxoneConfigScreen with iOS
 *      instructions
 *
 * OPEN QUESTIONS
 *   - iOS 17 minimum: project currently targets iOS 26 (we have
 *     deploymentTarget: "26.0"). The AppIntent widget config works
 *     since iOS 17, so we have headroom.
 *   - Configuration UI locale: keep in English (Apple standard for
 *     widget config sheets). Sensors can have German display names
 *     via `displayRepresentation`.
 *
 * OUT OF SCOPE
 *   - Inline widget-edit (left-over from the per-user config model)
 *   - Sync between iOS 17+ AppIntent config and iOS 16 fallback
 *     (no shared state — iOS stores the AppIntent params, app stores
 *     the WidgetConfig; each path works independently)
 *   - Multi-metric widget (still one value per instance, even if
 *     Lock Screen has 3 Meteoblick widgets)
 */
