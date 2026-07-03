# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## 5. Project: Meteoblick

### Mission
Personal iOS-App mit CarPlay-Widget-Support, die Wetterprognosedaten von MeteoSwiss (OGD) für einen konfigurierbaren Schweizer Standort anzeigt. V2 ergänzt Ist-Daten aus dem Smart Home (Home Assistant / Loxone).

### Platform scope
- **iOS App** mit WidgetKit-Extension (CarPlay + Homescreen)
- **Kein Backend** — alle Daten direkt vom öffentlichen MeteoSwiss STAC-API
- **Kein App Store** — persönlicher Gebrauch via Ad-Hoc / Xcode-Deploy

### Intended stack (greenfield — confirm before scaffolding)
- **Language**: Swift (kein SwiftUI-only — WidgetKit zwingt zu SwiftUI für Widgets, UIKit für die App-Shell ist OK)
- **UI**: SwiftUI für Widget und Settings-Screen; UIKit nur wenn zwingend nötig
- **Netzwerk**: URLSession direkt (kein Alamofire — zu viel Overhead für einfache GET-Requests)
- **Datenmodell**: Codable-Structs, abgeleitet von MeteoSwiss OGD CSV/JSON
- **Konfiguration**: AppStorage (UserDefaults) für POI-ID und Anzeigeoptionen
- **Testing**: XCTest für Datenparsing und API-Client; kein UI-Testing in V1
- **Tooling**: Xcode, kein SPM-Wrapper nötig ausser für externe Dependencies (aktuell keine geplant)

### Datenquelle: MeteoSwiss OGD

**STAC API Basis-URL:** `https://data.geo.admin.ch/api/stac/v1`

**Collection:** `ch.meteoschweiz.ogd-local-forecasting`

**Update-Zyklus:** Täglich ~04:00 UTC, 6-stündliche Refreshes

**Prognose-Horizont:** 9 Tage (D+0 bis D+8), stündlich + Tages-Zusammenfassung

**POI-System:**
- ~5'600 Punkte in der Schweiz (Stationen, Ortschaften, PLZ)
- Identifikation via `point_id` (numerisch)
- POI-Suche via Metadaten-CSV: `ogd-local-forecasting_meta_parameters.csv`

**Wichtige Metadaten-URLs:**
```
# Parameter-Metadaten (Einheiten, Panel-Gruppierungen, stündlich vs. täglich)
https://data.geo.admin.ch/ch.meteoschweiz.ogd-local-forecasting/ogd-local-forecasting_meta_parameters.csv

# POI-Liste (point_id, Name, PLZ, Koordinaten)
https://data.geo.admin.ch/ch.meteoschweiz.ogd-local-forecasting/ogd-local-forecasting_meta_grid.csv
```

**Datei-Abruf pro POI:**
```
# Stündliche Prognosedaten
https://data.geo.admin.ch/ch.meteoschweiz.ogd-local-forecasting/{point_id}/ogd-local-forecasting_{point_id}_P1H.csv

# Tages-Zusammenfassung
https://data.geo.admin.ch/ch.meteoschweiz.ogd-local-forecasting/{point_id}/ogd-local-forecasting_{point_id}_P1D.csv
```

**Daten sind metadata-driven:** Einheiten, Labels und Panel-Gruppierungen werden aus der Parameter-Metadaten-CSV gelesen — keine hartkodierten Labels.

### Domain Vocabulary
- **POI** (Point of Interest) — ein MeteoSwiss-Prognosepunkt, identifiziert durch `point_id`
- **Standort** — vom Nutzer konfigurierter POI (gespeichert in UserDefaults)
- **Stündliche Prognose** — `P1H`-Datei, Rohdaten für Temperatur, Wind, Niederschlag etc.
- **Tagesprognose** — `P1D`-Datei, aggregierte Werte + Piktogramm-Code
- **Piktogramm** — MeteoSwiss-Symbolcode (Integer), mappt auf Wetterbezeichnung und Icon
- **Widget** — WidgetKit-Extension, erscheint auf Homescreen und CarPlay-Dashboard
- **Smart Home Sensor** (V2) — Ist-Messwerte aus Home Assistant oder Loxone via lokale API

### Versionierung

**V1 — Prognose-Widget:**
- POI konfigurierbar (Suche via PLZ oder Ortsname)
- Anzeige: aktuelle Temperatur, Wetterzustand, Niederschlag nächste 3h
- Widget-Grössen: small (CarPlay-optimiert), medium
- Daten-Refresh: Background App Refresh, max. alle 30 Min.

**V2 — Smart Home Integration:**
- Ergänzung der Prognose mit Ist-Messwerten (Temperatur Aussen, ggf. Niederschlagssensor)
- Datenquelle: Home Assistant REST API oder Loxone Miniserver lokal
- Nur im lokalen WLAN verfügbar — graceful fallback auf reine OGD-Daten

### Engineering Guidelines
- Swift strict concurrency (`async/await`, kein Callback-Hell)
- Codable für alle API-Responses — kein manuelles JSON-Parsing
- Fehlerbehandlung: eigener `WeatherError`-Typ, kein generisches `Error` durchreichen
- Widget-Timeline: konservative Refresh-Intervalle (CarPlay-Nutzung = kurz, keine Dauerverbindung)
- Kein Netzwerk-Request im Widget-Renderer — Timeline Provider erledigt das
- CarPlay-Widget muss ohne User-Interaktion funktionieren (read-only, kein deep-link nötig)
- Secrets/Keys: keine — MeteoSwiss OGD ist öffentlich, kein API-Key erforderlich

### Offene Fragen (vor Implementierung klären)
- Welche 3–5 Parameter sollen im Widget angezeigt werden? (Temperatur, Piktogramm, Regen, Wind, …)
- Soll die POI-Suche in der App interaktiv sein (Live-Suche) oder einmalig via Einstellungen?
- V2: Home Assistant oder Loxone zuerst? Lokale IP fix oder via mDNS?