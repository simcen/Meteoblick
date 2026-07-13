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
- Status: scoped (`docs/SCOPE_MULTI_SENSOR.md`), awaiting Phase 1 start
- MVP scope: array of `{ uuid, name, showInApp, showInWidget, order }` sensors.
  Widget layout per family (small=1, medium=2, large=up to 6) selected top-N by
  `order` from `showInWidget` sensors. Widget timeline fetches its own sensors
  via flexible `getTemperatures(uuids[])` endpoint.
- Out of MVP scope (deferred):
  - **Sensor types beyond temperature** (humidity, brightness, etc.) — explicit
    decision per D1
  - Sensor history / charts
  - Per-widget-family sensor selection
  - Threshold notifications

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
| 2026-07-13 | (main HEAD) | TestFlight upload via iTMSTransporter + API key auth |
| 2026-07-13 | `b589a87` | Grouped bg on Home / SmartHome / Drawer |
| 2026-07-13 | `4007d09` | iOS 26 Liquid Glass tab bar |
| 2026-07-13 | `cc83527` | Right-handed chrome + Liquid Glass close button |
| 2026-07-13 | `fbde7f9` | Maestro e2e flows for all screens |
| 2026-07-13 | `4ae0352` | Dark mode support with iOS-style settings |
| 2026-07-12 | `be56a2a` | Drawer flicker fix + dark mode resilience |
