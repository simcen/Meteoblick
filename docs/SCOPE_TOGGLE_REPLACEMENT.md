/**
 * Scope — per-sensor SegmentedControl replacing App/Widget Switches
 * (Phase 1 of "double toggles" backlog item).
 *
 * CURRENT UX (post-Multi-Sensor-Polish):
 *   Each sensor row in the LoxoneConfigScreen sensor list has:
 *     - "App"   Switch (iOS-style)
 *     - "Widget" Switch
 *   Two horizontal Switches in a row, both right-aligned.
 *
 * PAIN POINTS:
 *   - 2 visual controls per sensor; horizontal space is tight
 *   - iOS-native pattern: a single SegmentedControl per row
 *   - More glanceable (4 states visible at once)
 *   - One less gesture to change
 *
 * PROPOSED UX:
 *   Each sensor row has ONE SegmentedControl with 3 segments:
 *     "App"  |  "Widget"  |  "Beide"
 *
 *   Mapping:
 *     App       → showInApp=true,  showInWidget=false
 *     Widget    → showInApp=false, showInWidget=true
 *     Beide     → showInApp=true,  showInWidget=true
 *
 * LAYOUT PER ROW (before/after):
 *
 *   BEFORE:
 *     [☰]  Pool (Garten)     [App ⚪] [Widget ⚪]
 *
 *   AFTER:
 *     [☰]  Pool (Garten)     [App | Widget | Beide]
 *
 * DECISIONS TO MAKE:
 *   D1. Segment labels: "App / Widget / Beide" vs
 *       "App / Widget / Both" (German vs English)?
 *       → Default: German for consistency with rest of the app
 *   D2. Default segment when adding a new sensor: "App" or "Beide"?
 *       → Default: "Beide" (matches current default where both flags
 *         were true on add)
 *   D3. Allow partial-state combinations explicitly (e.g. a
 *       "Custom" option that opens a sub-picker), or stick to
 *       fixed 3-state SegmentedControl?
 *       → Default: fixed 3-state; partial states are intermediate
 *         anyway
 *   D4. Width: full-width vs auto. iOS-native patterns are usually
 *       full-width. On narrow screens, a row with handle + name +
 *       4-segment control is very tight.
 *       → Default: full-width on its own line (multi-line per row)
 *
 * RISKS:
 *   - Row height grows (~50% larger). 4 sensors on screen → still OK;
 *     10+ sensors → more scrolling.
 *   - The drag handle (☰) is on the same row; making the
 *     SegmentedControl a new line keeps the drag area intact.
 *   - The current "App" and "Widget" labels next to the switches
 *     are small captions. Removing them is fine; the SegmentedControl
 *     segments speak for themselves.
 *
 * PHASING:
 *   1. Create a new <SensorVisibilityControl> inline component
 *   2. Replace the two <Switch> blocks with one <SensorVisibilityControl>
 *   3. The component calls updateSensor(uuid, { showInApp, showInWidget })
 *   4. Tests: state-mapping logic + smoke test
 *
 * OUT OF SCOPE:
 *   - Refactor of master "Loxone aktivieren" toggle
 *   - Per-widget-family sensor selection
 *   - Animations / haptic feedback on segment change
 */
