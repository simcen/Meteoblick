/**
 * Scope — iOS 16+ Lock Screen widget (Phase 2 of "Home Screen Widget" /
 * "Lock Screen Widget" backlog items).
 *
 * CURRENT STATE:
 *   MeteoblickWidget extension supports only:
 *     .systemSmall
 *     .systemMedium
 *     .systemLarge
 *   iOS 16+ Lock Screen families (always-on display on iPhone 14 Pro+,
 *   Lock Screen widgets on all iOS 16+) are not supported.
 *
 * PAIN POINTS:
 *   - User opens phone → wants to check outdoor temp without unlocking
 *   - Today: must unlock phone → open Meteoblick app → wait for fetch
 *   - Lock Screen widget solves this: glanceable temp at a glance
 *
 * PROPOSED UX:
 *   Add iOS 16+ accessory family widgets to the existing extension:
 *     .accessoryCircular — small circular widget (Lock Screen + AOD)
 *     .accessoryRectangular — wider rectangle (Lock Screen)
 *     .accessoryInline — single line of text below the time on Lock Screen
 *
 *   Content (proposed):
 *     accessoryCircular:    22.5°
 *     accessoryRectangular:  Meteoblick · 22.5° / 18°
 *     accessoryInline:      Meteoblick 22.5°
 *
 *   NO buttons, NO scrolling, NO interactivity in accessory widgets
 *   (Apple's policy). Display only.
 *
 * LAYOUT (in iOS):
 *
 *   ┌─────────────────────┐
 *   │      Lock Screen      │  ← iPhone Lock Screen
 *   │  ┌────┐                │
 *   │  │ 22°│  Friday 22 May  │
 *   │  └────┘                │
 *   │  Meteoblick 18°         │  ← inline above the date
 *   └─────────────────────┘
 *
 * DECISIONS TO MAKE:
 *   D1. Which Lock Screen families to support?
 *       a) rectangular + inline (most common, more info)
 *       b) rectangular + circular (more glanceable but less info)
 *       c) all three (maximum coverage, more code)
 *       → Default: rectangular + inline (most useful for weather info;
 *         circular is borderline redundant with the small home widget)
 *   D2. Content source: same shared MeteoblickWidget snapshot, OR
 *       a separate dedicated Lock Screen snapshot?
 *       → Default: same snapshot. Less data duplication. The widget
 *         extension already reads the App Group; the same
 *         WidgetSnapshot covers all families.
 *   D3. Always-On Display support? (iPhone 14 Pro+)
 *       a) Yes — AOD widget is always-on, dim background
 *       b) No — disable widgets in AOD
 *       → Default: yes. iOS handles the dim automatically; we just
 *         provide the widget, Apple handles the rest.
 *   D4. Refresh cadence: same as current (15-min timeline)?
 *       → Default: yes. iOS controls widget refresh rate; we just
 *         respond to reloadTimeline().
 *   D5. Use the same MeteoblickWidget extension, or create a new
 *       target?
 *       → Default: same extension. One target, multiple families
 *         (small/medium/large/circular/rectangular/inline). One
 *         WidgetSnapshot, multiple views.
 *
 * RISKS:
 *   - iOS shows only ONE widget per slot. Users can choose which
 *     family to use. We should provide all useful ones.
 *   - Lock Screen widget changes require Xcode rebuild + reload.
 *     The .pbxproj auto-discovery should pick up new families.
 *   - Swift code needs to handle the new `widgetFamily` cases in
 *     `body`. Adds 3 more branches to the existing switch.
 *   - widgetManager.ts sends the same snapshot regardless of
 *     family; no JS changes needed for the Lock Screen widget.
 *
 * PHASING:
 *   1. Update WidgetConfigurable.supportedFamilies in widget Swift
 *      to add .accessoryRectangular, .accessoryInline (and maybe
 *      .accessoryCircular)
 *   2. Add body branches in MeteoblickView for the new families
 *   3. Tests: smoke test (already covers mount, no changes needed)
 *   4. Optional: backend schema unchanged (single payload serves
 *      all families)
 *
 * OUT OF SCOPE:
 *   - Widget interactivity (iOS policy: Lock Screen widgets can't
 *     have buttons or taps)
 *   - Standalone Lock Screen extension target
 *   - WatchOS / WearOS / Mac widgets
 *   - Home Screen widget variants (separate scope, already in
 *     BACKLOG as "Home Screen Widget")
 */
