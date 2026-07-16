/**
 * Scope — Multi-instance widget for iOS 17+ via AppIntent, with
 * Apple Watch / complications as a future extension of the same
 * principle (supersedes the per-user `lockScreenCircular` config).
 *
 * SCOPE CLARIFICATION (PM/PO framing)
 *   "Multi-instance widget" means: the SAME widget code can be added
 *   multiple times to the iOS Lock Screen / Home Screen, each instance
 *   configured independently (different metric). This is iOS's standard
 *   pattern for any widget with user choice (Weather, Music, etc.).
 *
 *   Apply to ALL widget families we support:
 *     - iOS Lock Screen: accessoryCircular, accessoryRectangular
 *     - iOS Home Screen: systemSmall, systemMedium, systemLarge
 *     - Apple Watch (future): same pattern, different extension target
 *
 *   This is one AppIntent shared across all Meteoblick widget code paths.
 *
 * PROBLEM
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
 *   ┌────────────────────────────────┐
 *   │ iOS Home Screen                │
 *   │  ┌──────┐  ┌──────┐            │
 *   │  │  22° │  │ 24° │  ← Multiple Meteoblick instances,
 *   │  └──────┘  └──────┘    each with a chosen metric
 *   │  Wetter    Pool               │
 *   └────────────────────────────────┘
 *
 *   One widget code path, multiple iOS slots. Each instance carries
 *   its own `metric` parameter (AppIntent).
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
 *   iOS 17+ Apple Watch / complications (future, out of scope this PR):
 *   same AppIntent type is shared. The extension target differs
 *   (WatchOS app), but the Swift code path is the same one widget
 *   class — the only delta is the bundle identifier and deployment
 *   target. Document the pattern in `docs/EXPO_WIDGETS_ARCHITECTURE.md`
 *   so the Watch extension can be added without re-architecting.
 *
 * PROPOSED STATE FLOW
 *   1. User adds Meteoblick widget to Lock Screen or Home Screen
 *   2. iOS shows configuration sheet (iOS 17+ only):
 *      - Wetter (default)
 *      - Pool, Aussen, Heizung, ... (one option per showInWidget sensor)
 *   3. User picks "Pool", widget shows Pool value
 *   4. User adds a second Meteoblick widget, picks "Wetter"
 *   5. Both instances coexist with their own choice
 *
 *   iOS 16: configuration sheet not shown. Widget reads `WidgetConfig`
 *   from App Group (the per-user `lockScreenCircular` setting we
 *   already built). One widget, one metric.
 *
 * DECISIONS
 *   D1. AppIntent type: enum with cases `.weather` and
 *       `.sensor(uuid: String)`. Single enum, reused across all
 *       widget families (Lock + Home + future Watch).
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
 *   D7. **Lock + Home + Watch share the same AppIntent type.** When
 *       the Watch extension is added later, it imports the same
 *       `WidgetConfigIntent` — no new Swift code for config.
 *
 * PHASING
 *   1. Add `WidgetConfigIntent` in Swift with `metric: Metric` parameter
 *   2. Refactor `body` + per-family body funcs to read from
 *      `Configuration.metric` (iOS 17+) with WidgetConfig fallback
 *      (iOS 16)
 *   3. Wire `AppIntentConfiguration(intent: WidgetConfigIntent.self)`
 *      into the widget definition
 *   4. Remove the in-app `lockScreenCircular` picker from
 *      LoxoneConfigScreen
 *   5. Add a hint to Home-Screen / LoxoneConfigScreen with iOS
 *      widget-add instructions
 *   6. Document the "Lock + Home + future Watch share one AppIntent"
 *      pattern in docs/EXPO_WIDGETS_ARCHITECTURE.md
 *
 * OPEN QUESTIONS
 *   - iOS 17 minimum: project currently targets iOS 26 (we have
 *     deploymentTarget: "26.0"). The AppIntent widget config works
 *     since iOS 17, so we have headroom.
 *   - Configuration UI locale: keep in English (Apple standard for
 *     widget config sheets). Sensors can have German display names
 *     via `displayRepresentation`.
 *   - When the Watch extension is added, does the iOS WidgetConfig
 *     App Group name match the Watch's group ID? Yes — the bundle
 *     groups are configured at install time; the Watch app reads
 *     from the same `group.ch.meteoblick` as long as the Watch app
 *     declares the entitlement.
 *
 * OUT OF SCOPE
 *   - Inline widget-edit (left-over from the per-user config model)
 *   - Sync between iOS 17+ AppIntent config and iOS 16 fallback
 *     (no shared state — iOS stores the AppIntent params, app stores
 *     the WidgetConfig; each path works independently)
 *   - Apple Watch / complications implementation (deferred, but
 *     the AppIntent pattern is the foundation for it)
 *   - Multi-metric widget (still one value per instance, even if
 *     Lock Screen has 3 Meteoblick widgets)
 */
