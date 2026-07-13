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
- Status: open — needs schema + UI design
- Use case: today one Loxone temperature sensor feeds the widget. User wants to add e.g. pool temperature, plus per-sensor control over visibility.
- Storage schema today (`SharedStorage.setLoxoneConfig`):
  ```ts
  { cloudAddress, username, password, temperatureSensorUUID?, temperatureSensorName?, enabled }
  ```
  Would need to become an array:
  ```ts
  type Sensor = { uuid: string; name: string; showInApp: boolean; showInWidget: boolean };
  type LoxoneConfig = { cloudAddress, username, password, sensors: Sensor[]; enabled: boolean };
  ```
- Widget design constraints (iOS 17/26):
  - `systemSmall` ≈ 158×158 pt — fits 1 reading + label cleanly
  - `systemMedium` ≈ 338×158 pt — fits 2 readings side-by-side, or 1 + meta
  - `systemLarge` ≈ 338×354 pt — fits 4-6 readings
- Open question: cap at N sensors per widget family? Suggest 1 for small, 2 for medium, 6 for large. Configurable in app.
- Migration: existing single-sensor configs need to migrate forward without losing data.

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
