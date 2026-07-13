# Scope: Multi-Sensor Smart Home Support

> Review doc. Implementation starts after sign-off.

## 1. Problem

Today the Loxone integration stores a **single** temperature sensor and
exposes it via `WeatherContext.loxoneTemp` to the app + widget. To support
additional sensors (Pool, Aussen, Keller, ...) we need:

- An array of sensor configs in storage (with per-sensor visibility flags)
- Updated API/context to expose multiple readings
- A widget redesign that fits more than one value
- Migration from the old single-sensor shape

## 2. User persona

Single user (you). Loxone Miniserver at home, N temperature sensors around
the property. Use case at a glance: "is the pool warm enough to jump in"
while sitting on the couch, without opening the app.

## 3. Functional scope (MVP)

### In

- Storage holds an ordered **array of sensors** (`uuid`, `name`,
  `showInApp`, `showInWidget`, `order`).
- Migration from existing single-sensor config → array on first read
  (auto, no user prompt).
- **LoxoneConfigScreen** shows configured sensors as rows with:
  - name (user-editable inline)
  - two switches: `In App`, `In Widget`
  - delete button (with confirmation)
  - re-order handle (drag) for display priority
- "Add sensor" button in config screen → opens sensor picker:
  - calls `LoxoneAPI.getTemperatureSensors()`, filters out already-configured
  - user picks one → returns to config with new sensor added (name = Loxone
    name as default, both flags on)
- **SmartHomeScreen** shows current value for every sensor where
  `showInApp === true`, sorted by `order`.
- **Widget** displays up to N sensors per family (see §5).
- Empty state: "Noch keine Sensoren konfiguriert" with "Sensor hinzufügen" CTA
  when sensors array is empty.

### Out (defer to backlog)

- Sensor types beyond temperature (humidity, brightness, ...)
- Real-time sensor push (still refresh-on-foreground / pull-to-refresh)
- Sensor history / charts / time-series
- Threshold-based notifications
- Per-widget-family sensor selection (single global order, capped by family)
- Sharing widget configs
- Drag-to-reorder on widget
- Rename sensor after creation (we have inline edit, but renaming is fine in MVP)

## 4. Data model

### Storage schema (`SharedStorage.setLoxoneConfig`)

**Old:**
```ts
{
  cloudAddress, username, password,
  temperatureSensorUUID?, temperatureSensorName?,
  enabled: boolean,
}
```

**New:**
```ts
type Sensor = {
  uuid: string;
  name: string;
  showInApp: boolean;
  showInWidget: boolean;
  order: number;          // 0-based, lower = earlier
};

type LoxoneConfig = {
  cloudAddress: string;
  username: string;
  password: string;
  sensors: Sensor[];
  enabled: boolean;
};
```

### Migration

Read path: if stored object has `temperatureSensorUUID` but no `sensors`
array, build one entry from the legacy fields and persist the new shape.
One-shot, idempotent.

Write path: granular ops:
- `addSensor(sensor)` — append with order = max(order)+1
- `removeSensor(uuid)`
- `updateSensor(uuid, partial)` — name / flags / order
- `reorderSensors(orderedUuids)` — bulk re-order

### Loxone fetch

Add to `LoxoneAPI`: `getTemperature(sensorUuid)` already exists.
Add: `getTemperatures(sensorUuids: string[]) => Promise<Array<{uuid, temp, timestamp}>>`
for batched fetch (single Loxone call returns multiple sensor states). Used by:
- **App fetch path**: pass `sensors.map(s => s.uuid)` (all configured sensors)
- **Widget timeline path**: pass only `sensors.filter(s => s.showInWidget).map(s => s.uuid)`

This is the "flexible endpoint" requirement from D8 — same API, different
subsets, depending on caller.

### Widget fetch path (new, D8)

Widget refreshes via iOS timeline reload. The provider needs:
- List of `showInWidget` sensor UUIDs (from App Group snapshot)
- Loxone credentials (cloud SNR, username, password — already mirrored to App Group)
- Direct HTTP call to Loxone API (no RN bridge)

Implementation:
- New `ios/ExpoWidgetsTarget/LoxoneWidgetClient.swift` — minimal URLSession-based
  client with the same logic as `src/api/loxone.ts`'s cloud-vs-local fallback.
- `ios/ExpoWidgetsTarget/MeteoblickWidget.swift` TimelineProvider calls this
  client with the widget-active sensor UUIDs on every reload.
- Snapshot in App Group remains as fallback when Loxone call fails or times out.

Trade-off: widget reload latency now includes the Loxone API call (typ.
<1s on local network, longer via cloud). iOS timeline budget should be OK.

## 5. Widget design constraints

iOS widget family sizes (iOS 26 reference):

| Family | Logical size | Sensor slots (proposed) |
|---|---|---|
| `systemSmall` | 158×158 pt | **1** (top of order, showInWidget) |
| `systemMedium` | 338×158 pt | **2** (horizontal row) |
| `systemLarge` | 338×354 pt | **up to 6** (3×2 grid) |

If `showInWidget` sensors < family cap, render what's there (with empty
slots looking like the existing single-sensor fallback).

**Selection rule:** top-N by `order` from sensors where
`showInWidget === true`. Capping is per-family — no overflow.

**Visual:** same gradient + rounded card + temperature + sensor name
label as today, just stacked/grid-laid-out. Names truncated at 12 chars
with ellipsis.

## 6. UI flows

### LoxoneConfigScreen — sensor section

```
┌─ Verbindung ─────────────────────┐
│ Cloud-Adresse     [504F94A1874F]  │
│ Username          [...]          │
│ Password          [...]          │
│ [Verbindung testen]              │
└──────────────────────────────────┘

┌─ Temperatursensoren ─────────────┐
│ ☰  Aussen       [App][Widget]  ✕ │
│ ☰  Pool         [App][Widget]  ✕ │
│ ☰  Keller       [App][Widget]  ✕ │
│ [+ Sensor hinzufügen]            │
└──────────────────────────────────┘
```

- ☰ drag handle on the left for reordering
- Two switches per row (always visible, both default ON for new sensors)
- ✕ delete with confirmation Alert
- "Sensor hinzufügen" → opens picker modal

### Sensor picker

```
┌─ Sensor wählen ──────────────────┐
│ Suche: [Filter...]               │
│ ─────────────────────────────── │
│ Wohnzimmer  · 1-Wire             │
│ Aussen      · 1-Wire             │
│ Pool        · 1-Wire             │
│ Heizung     · 1-Wire             │
│ [Abbrechen]                       │
└──────────────────────────────────┘
```

Tap a row → sensor is added with name = Loxone name, both flags ON.
Picker closes, returns to LoxoneConfigScreen.

### SmartHomeScreen

Today's "Aktueller Wert" + "Verbindung" cards become:

```
┌─ Sensoren ────────────────────────┐
│ 🌡️ Aussen      22.5°C            │
│    Wohnzimmer                     │
│ 🌡️ Pool        26.8°C            │
│    Garten                         │
│ 🌡️ Keller      18.2°C            │
│    Heizungsraum                   │
└──────────────────────────────────┘
```

Per-sensor row with current value + last-updated timestamp on tap
(expanding inline). Empty state if sensors array is empty.

### AppHeader

No change. Hamburger / drawer stays.

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Migration loses existing config | High | Auto-migrate on first read, never write old shape back |
| Widget SwiftUI refactor breaks small widget | Medium | small = 1 sensor (same as today), drop in unchanged widget view |
| LoxoneAPI batch fetch fails partially (one sensor returns 401 etc.) | Medium | Per-sensor error state in UI; cache last good value |
| Reordering UX with drag is fiddly on iOS | Medium | Use long-press-drag from the handle (RN pattern); fallback to "Move up/down" buttons if drag proves buggy |
| Storage write storms if user toggles many switches quickly | Low | Debounce toggles (250 ms) before write |
| Per-widget-family sensor list adds config surface | Low | Out of scope for MVP — one global order, capped by family |

## 8. Open decisions (need your call before I start)

| # | Decision | Status |
|---|---|---|
| D1 | Sensor types: **temperature only**. Other types (humidity, brightness, ...) tracked in BACKLOG. | decided |
| D2 | **Drag** to reorder (long-press handle, then drag). | decided |
| D3 | **Inline long-press** to rename — tap-and-hold the name field, Alert with TextInput. | decided |
| D4 | Medium widget: **horizontal** layout (two sensors side-by-side). | decided |
| D5 | Delete: **explicit Alert** ("Sensor wirklich löschen?"). | decided |
| D6 | New sensor: **pre-fill** with Loxone name, **editable** inline in the list. | decided |
| D7 | Fetch failure: keep current behavior — widget falls back to last App-Group snapshot value; app shows `—` placeholder. No new "italic + stale" indicator. | decided |
| D8 | Sensor fetch: **also in widget timeline** (background). At minimum the `showInWidget` sensors; endpoint must accept a `string[]` of UUIDs so the widget can fetch only what it needs. App still fetches all sensors (for SmartHomeScreen), BG fetch also refreshes the snapshot as fallback. | decided |

## 9. Phasing & effort

| Phase | Effort | Description |
|---|---|---|
| 1. Storage + migration | **S** (~1-2 h) | Schema, ops, tests |
| 2. LoxoneConfigScreen UX | **M** (~3-4 h) | Sensor rows + add-picker + drag-reorder |
| 3. SmartHomeScreen | **S** (~1 h) | Multi-sensor display |
| 4a. Widget SwiftUI refactor (SwiftUI layouts) | **M** (~3-4 h) | Per-family layouts |
| 4b. Widget fetch path (Swift Loxone client) | **M** (~2-3 h) | New `LoxoneWidgetClient.swift`, fetch from widget timeline, snapshot fallback |
| 5. Polish + docs | **S** (~1 h) | Empty states, errors, MAESTRO e2e flow |

Total: **~1.5 working days** (was ~1 day; +half day for Swift widget fetch).
Phase 4b is new and adds the most risk (native Swift code path).

## 10. Out of scope (one-liners)

- Home Assistant support (per CLAUDE.md, deferred)
- Sensor types beyond temperature (D1)
- Per-widget-family sensor selection
- Charts / history / time-series
- Push notifications on thresholds
- Sharing widget configs across devices
