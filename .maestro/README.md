# Maestro E2E Tests

End-to-end UI tests for Meteoblick, covering all 6 screens (Home, Smart Home,
Settings, Orte, Loxone Config, Debug) plus the new dark-mode toggle flow.

## Setup

Maestro is installed via the official installer:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$PATH:$HOME/.maestro/bin"
```

Add the `export` line to your shell rc file (`~/.zshrc` or `~/.bash_profile`)
to make `maestro` available in every new terminal.

## Prerequisite: app must be installed on a running simulator

Maestro drives a real iOS simulator. Before running any flow:

```bash
pnpm ios            # builds + installs Meteoblick on iPhone 17 Pro
```

The simulator window should be visible while flows run.

## Run a single flow

```bash
maestro test .maestro/flows/03_settings_screen.yaml
```

## Run all flows in order

```bash
maestro test .maestro/flows/
```

The CLI walks the directory alphabetically (numeric prefixes control order).

## Flow catalogue

| # | File | What it covers |
|---|------|----------------|
| 01 | `01_home_screen.yaml` | App launches → Wetter tab renders |
| 02 | `02_smart_home_screen.yaml` | Switch to Smart Home tab |
| 03 | `03_settings_screen.yaml` | Open drawer → Settings → Allgemein / Orte / Smart Home menu visible |
| 04 | `04_settings_allgemein_dark_mode.yaml` | Tap each of the 3 SegmentedControl options + cold-launch persistence |
| 05 | `05_orte_screen.yaml` | Settings → Orte modal renders with search input |
| 06 | `06_loxone_config_screen.yaml` | Settings → Smart Home → Loxone Config modal renders |
| 07 | `07_debug_screen.yaml` | Drawer → Debug modal renders |

## Selector strategy

UI selectors use German text labels (matches the in-app copy) and
`accessibilityLabel` props where defined:

- `accessibilityLabel: "Menü öffnen"` — AppHeader hamburger
- `text: "Schliessen"` — modal close button
- `accessibilityLabel: "Standort ändern"` — HomeScreen CTA
- `accessibilityLabel: "Konfiguration bearbeiten"` — SmartHomeScreen CTA

If German copy changes, update both `src/...` and the corresponding `.yaml`.

## Out of scope

- Native iOS widget (SwiftUI / WidgetKit) — Maestro is RN-driven; widget
  needs separate XCUITest setup in `ios/ExpoWidgetsTarget/`
- Backend API tests — already covered by `e2e/weather.api.spec.ts`
- Visual regression (specific pixel colors) — Maestro can't diff theme bg
  colors directly; we assert re-render via header text post-toggle
