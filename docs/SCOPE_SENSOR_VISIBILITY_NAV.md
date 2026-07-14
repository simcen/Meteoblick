/**
 * Scope — sensor visibility as iOS-Settings detail row (supersedes
 * SCOPE_TOGGLE_REPLACEMENT.md).
 *
 * CONTEXT
 *   The previous scope proposed an inline per-sensor SegmentedControl
 *   ("App | Widget | Beide"). User testing showed the row is too
 *   cramped: drag-handle + name + SegmentedControl all on the same
 *   row eats ~50% more height than the previous twin-Switches, looks
 *   awkward on the user's real device.
 *
 *   iOS-native answer: don't put the SegmentedControl in the list
 *   row. Use the standard "disclosure row" pattern instead — show
 *   the current value as text, let the user tap to edit in a
 *   sub-screen.
 *
 * iOS-SETTINGS PATTERN (researched)
 *   Per Apple's HIG (developer.apple.com/design/human-interface-guidelines),
 *   the standard list row for "show current value + open detail" is:
 *     - Label (left, body)
 *     - Value (right, secondary, current state e.g. "App+Widget")
 *     - Chevron › (right, tertiary, separator before)
 *   Tapping the row pushes a detail screen that owns the actual
 *   control (UISegmentedControl, UIPickerView, etc.).
 *
 *   Concrete iOS examples:
 *     Settings → Display & Brightness → Auto-Lock → "30 Seconds ›"
 *     Settings → Mail → Accounts → Account name → detail
 *     Settings → Sounds & Haptics → Ringtone → "Default (Marimba) ›"
 *
 *   The sub-screen title is the row's label (sensor name).
 *
 * PROPOSED UX
 *
 *   SENSOR ROW (collapsed):
 *
 *     ┌─────────────────────────────────────────────┐
 *     │ ☰  Pool (Garten)                  App+Widget › │
 *     │ ↑ drag                ↑ name        ↑ value ↑chevron
 *     └─────────────────────────────────────────────┘
 *
 *   Sensor drag handle (☰) stays for reorder. Tapping the row body
 *   pushes a sub-screen. Tapping the value text or chevron also
 *   pushes the same sub-screen.
 *
 *   SUB-SCREEN:
 *
 *     ┌──────────────────────────────────────┐
 *     │ ← Sichtbarkeit                  Fertig │
 *     ├──────────────────────────────────────┤
 *     │                                      │
 *     │  ┌───────┬───────┬────────┐           │
 *     │  │  App  │Widget │ Beide  │           │
 *     │  └───────┴───────┴────────┘           │
 *     │                                      │
 *     │  [App anzeigen]                      │
 *     │  [Widget anzeigen]                   │
 *     │  [Beide anzeigen]                    │
 *     │                                      │
 *     └──────────────────────────────────────┘
 *
 *   Header title: "Sichtbarkeit" (or sensor name, see D1 below).
 *   The current state segment is highlighted. The descriptive
 *   text under each segment is shown only when the user hovers/
 *   focuses the row (helperText pattern). Keeps the screen focused.
 *
 *   Saved automatically on segment change (no save button — single
 *   tap to commit, just like iOS native segmented controls).
 *
 * DECISIONS TO MAKE
 *   D1. Sub-screen header: "Sichtbarkeit" (generic, describes the
 *       setting type) or sensor name (specific, e.g. "Pool (Garten)").
 *       → Default: sensor name (consistent with iOS Settings detail
 *         pages like "Auto-Lock" being a generic setting name, OR
 *         "Sounds & Haptics" being a section name — both are common
 *         patterns). Sensor name wins for clarity: user knows
 *         WHICH sensor they're configuring.
 *   D2. Sub-screen per sensor OR shared "Sichtbarkeit" overview?
 *       a) Per-sensor detail screen: tap "Pool" → "Pool" detail
 *          → SegmentedControl. One push per sensor. Simple.
 *       b) Shared overview: "Sichtbarkeit" lists all sensors with
 *          inline SegmentedControls, no push needed. Compact.
 *       c) Per-sensor detail screen for the row's primary value
 *          (App/Widget/Beide) + a single "Mehr" or settings entry
 *          for advanced (sensor name, rename, etc.)
 *       → Default: per-sensor (a). User has ~3-10 sensors typical;
 *         one push per sensor is iOS-native and not heavy. Plus the
 *         "rename" + "delete" actions can live in the SAME detail
 *         screen (consolidate per-sensor controls).
 *   D3. Inline value text: short ("Beide") or long
 *       ("App + Widget")?
 *       → Default: "Beide" / "App" / "Widget" (matches segmented
 *         control labels exactly — no extra mental mapping)
 *   D4. Drag-reorder on the main row: still works with the new
 *       pattern, or do we move reorder to the detail screen?
 *       → Default: keep drag on the main row. iOS Mail/Files do
 *         the same: long-press anywhere on the row to drag.
 *
 * REVERTED (per-sensor inline SegmentedControl)
 *   The previous scope doc (SCOPE_TOGGLE_REPLACEMENT.md) proposed
 *   an inline SegmentedControl. User testing showed the row is too
 *   cramped. This scope supersedes that one. The new design is the
 *   "Settings detail row" pattern — more iOS-native, more space.
 *
 * PHASING
 *   1. Create a new `SensorVisibilityScreen.tsx` (in-app modal like
 *      LoxoneConnectionScreen)
 *   2. Register it in the root stack (`app/_layout.tsx`)
 *   3. Sensor row in LoxoneConfigScreen becomes:
      - Drag handle (☰) for long-press reorder
      - Sensor name (left)
      - Visibility value (right, e.g. "Beide")
      - Chevron (right)
      - Whole row tap → navigation to SensorVisibilityScreen
   4. SensorVisibilityScreen content:
      - Header: sensor name
      - SegmentedControl with 3 segments (App / Widget / Beide)
      - Live-update sensor config on tap
      - (Optional) Delete button at the bottom for parity with
        swipe-to-delete on the parent screen — gives users a
        second affordance.
 *   5. Tests: smoke test still mounts both screens; no regressions
 *      in coverage.
 *
 * OUT OF SCOPE
 *   - Drag-to-reorder on detail screen (drag stays on the main row)
 *   - Inline value preview (we always show the value, no preview
     vs final distinction needed)
 *   - Animated transitions when pushing the detail screen
 */
