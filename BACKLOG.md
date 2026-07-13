# Feature Backlog

Lightweight tracking for ideas that aren't ready for implementation. Status
values: `open` / `exploring` / `in-progress` / `done` / `reverted`.

## Open

### Home Screen Widget
- Status: open — needs scoping
- Notes:
  - Today only one widget extension exists (`MeteoblickWidget`), shown via ExpoWidgets / SwiftUI.
  - Open question: what does "ergänzen" mean here — a second widget variant (e.g. compact vs detailed), or a different size family, or interactive widget (iOS 17+ IntentConfiguration)?
  - iOS widget families currently supported: `systemSmall`, `systemMedium`, `systemLarge`. Could add `systemExtraLarge` (iPad) or accessory widgets (`accessoryCircular`, `accessoryRectangular`, `accessoryInline` for Lock Screen).
- Decision needed before implementation.

### Multi-Sensor Smart Home Support
- Status: **shipped** (Phases 1-4 + polish). Storage + migration + granular ops
  + multi-sensor UI (drag handle, flags, rename, delete, picker). SmartHomeScreen
  shows multi-sensor list. Widget renders 1/2/6 sensors per family via a
  single consolidated `/api/widget/timeline` call (Loxone fetched server-side).
- Polish backlog (post-MVP):
  - **Swipe-to-delete** instead of ✕ icon — more iOS-native for row removal
  - **SmartHomeScreen**: last sensor row in list shouldn't have a horizontal divider (matches menuGroup's rowLast treatment)
  - **Combine the two toggles into a SegmentedControl** — currently
    LoxoneConfigScreen has "Loxone aktivieren" (master enable) and
    "Verbindung" (in-app/widget flags) as separate UI. A SegmentedControl
    would unify them. (Replaces the current combined card.)
  - **Swipe-to-delete action label** — currently shows the text "Löschen"
    on a red background. Replace with a trash icon (🗑 / 🎀) to match
    iOS-native Mail/Messages delete affordance.
  - Sensor types beyond temperature (humidity, brightness, ...) — D1 deferred

### Drawer → Stack (experimental)
- Status: open — exploratory, may revert
- Hypothesis: replace `Drawer.Navigator` with a top-of-screen Stack header (iOS-style back button + title). Removes the hamburger entirely, freeing up the AppHeader for the screen title + back chevron.
- Trade-off:
  - (+) Cleaner iOS-native feel (every modal/screen has its own back navigation)
  - (+) No drawer state to manage
  - (–) Loses the "global" drawer affordance for accessing Settings / Debug from anywhere
  - (–) Bigger refactor of `_layout.tsx` + tab/screen wiring
- Approach: keep Drawer in code behind a flag, ship as alternative build, decide after a few days of use.

## Exploring

_None currently._

## Open Questions (carried from CLAUDE.md)

These pre-date the backlog; revisit when picking up the related work.

- **V1 widget content** — CLAUDE.md asked which 3-5 parameters to show in the widget. Today we show: location name, current temp, forecast temp, precipitation. Wind, pictogram, min/max not yet on the widget.
- **POI search UX** — interactive search in app, or one-time via settings? Today: one-time (Settings → Orte).
- **V2 Smart Home backend** — Home Assistant or Loxone? Today: Loxone only. CLAUDE.md's open question.

## Deferred from Multi-Sensor scope

- **Other Loxone sensor types** (humidity, brightness, ...) — deferred per scope
  decision D1. Needs generic `getValue(uuid, type)`, type-aware storage,
  sensor-specific units + symbols in UI.
- **Sensor history / time-series** — needs either local time-series storage or
  backend integration. Probably needs backend first.
- **Per-widget-family sensor selection** — current MVP uses one global order
  capped by family size. Users might want different sensors in small vs large.

## Done (recent shipped work)

For archaeology. Each row links the commit hash so future readers can dig in.

| Date | Commit | Item |
|---|---|---|
| 2026-07-13 | `67664d5` | Widget: single consolidated /api/widget/timeline call (multi-sensor) |
| 2026-07-13 | `8cc823e` | Backend tests: multi-sensor widget timeline helpers |
| 2026-07-13 | (earlier) | TestFlight upload via iTMSTransporter + API key auth |
| 2026-07-13 | `b589a87` | Grouped bg on Home / SmartHome / Drawer |
| 2026-07-13 | `4007d09` | iOS 26 Liquid Glass tab bar |
| 2026-07-13 | `cc83527` | Right-handed chrome + Liquid Glass close button |
| 2026-07-13 | `fbde7f9` | Maestro e2e flows for all screens |
| 2026-07-13 | `4ae0352` | Dark mode support with iOS-style settings |
| 2026-07-12 | `be56a2a` | Drawer flicker fix + dark mode resilience |
