# Git Workflow

## Branch-Strategie: Git-Flow

### Branch-Typen

```
main (production-ready)
  └── develop (integration branch)
       ├── feature/* (new features)
       ├── release/* (release preparation)
       └── hotfix/* (production fixes)
```

### Branch-Naming

- **Feature**: `feature/<ticket-id>-<short-description>` oder `feature/<short-description>`
  - Beispiel: `feature/widget-reload`, `feature/METEO-123-carplay-support`
- **Release**: `release/<version>`
  - Beispiel: `release/1.0.0`
- **Hotfix**: `hotfix/<version>-<description>`
  - Beispiel: `hotfix/1.0.1-widget-crash`

### Workflow

1. **Feature entwickeln:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/widget-reload
   # ... Entwicklung ...
   git push -u origin feature/widget-reload
   ```

2. **Feature merge:**
   ```bash
   git checkout develop
   git merge --no-ff feature/widget-reload
   git push origin develop
   git branch -d feature/widget-reload
   ```

3. **Release vorbereiten:**
   ```bash
   git checkout develop
   git checkout -b release/1.0.0
   # ... Versionen anpassen, letzte Tests ...
   git checkout main
   git merge --no-ff release/1.0.0
   git tag -a v1.0.0 -m "Release 1.0.0"
   git checkout develop
   git merge --no-ff release/1.0.0
   git branch -d release/1.0.0
   ```

4. **Hotfix:**
   ```bash
   git checkout main
   git checkout -b hotfix/1.0.1-widget-crash
   # ... Fix ...
   git checkout main
   git merge --no-ff hotfix/1.0.1-widget-crash
   git tag -a v1.0.1 -m "Hotfix 1.0.1"
   git checkout develop
   git merge --no-ff hotfix/1.0.1-widget-crash
   git branch -d hotfix/1.0.1-widget-crash
   ```

## Conventional Commits

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: Neue Funktionalität
- **fix**: Bugfix
- **chore**: Wartung (Dependencies, Build, etc.)
- **docs**: Dokumentation
- **refactor**: Code-Umstrukturierung ohne Funktionsänderung
- **test**: Tests hinzufügen/ändern
- **ci**: CI/CD Änderungen
- **perf**: Performance-Verbesserung
- **style**: Code-Formatierung (kein funktionaler Unterschied)

### Scopes (optional)

- **app**: React Native App
- **backend**: API Backend
- **widget**: iOS Widget
- **docs**: Dokumentation
- **ci**: CI/CD
- **deps**: Dependencies

### Beispiele

```bash
# Feature ohne Breaking Change
git commit -m "feat(widget): add expo-widgets support for reload

- Replace SwiftUI widget with expo-widgets
- Add widget.reload() method
- Support CarPlay automatically via systemSmall"

# Fix
git commit -m "fix(app): resolve POI search crash on empty query

Handle edge case where search query is empty string"

# Breaking Change
git commit -m "feat(backend): migrate to postgres from sqlite

BREAKING CHANGE: Requires PostgreSQL 14+ instead of SQLite"

# Chore
git commit -m "chore(deps): upgrade expo sdk 56 to 57

- expo@57.0.2
- expo-widgets@57.0.2
- react-native@0.86"
```

### Kurz halten

- Eine Zeile Subject reicht meistens — Body nur bei nicht-trivialen Commits.
- "Conventional commit reicht" — keine Romane, keine Bullet-Listen für jeden
  kleinen Schritt. Subjekt beschreibt was, Body nur wenn warum unklar.
- Subject max. 72 Zeichen.

### Author / Co-Author

- Author ist **immer** der Standard-Git-User (`Simon Balz <simon@balz.me>`) —
  niemals via `-c user.name=... -c user.email=...` überschreiben.
- Co-Autoren via `Co-Authored-By:`-Trailer möglich, wenn ein LLM substantiell
  mitgeholfen hat (z.B. Code-Reviews, Refactorings).

### Breaking Changes

Wenn eine Änderung Breaking ist (API-Änderung, neue Requirements):

```
feat(backend): change weather API response format

Weather data now uses camelCase instead of snake_case.
Clients must update their parsing logic.

BREAKING CHANGE: API response format changed from snake_case to camelCase
```

## Commit-Nachrichten

### Subject (erste Zeile)

- Imperativ ("add" nicht "added" oder "adds")
- Kleinbuchstaben (außer Eigennamen)
- Kein Punkt am Ende
- Max. 72 Zeichen
- Beschreibt **was** geändert wurde

### Body (optional)

- Erklärt **warum** die Änderung gemacht wurde
- Leerzeile nach Subject
- Kann Markdown verwenden (Listen, Code-Blocks)
- Pro Zeile max. 72 Zeichen

### Footer (optional)

- `BREAKING CHANGE:` für Breaking Changes
- `Closes #123` für Issue-Referenzen
- `Co-Authored-By:` für Co-Autoren

## Build-Nummern

Bei jedem relevanten Build Build-Nummer aktualisieren (`YYMMDD-HHMM`):

**Dateien:**
- `src/screens/HomeScreen.tsx`
- `src/screens/DebugScreen.tsx`
- `ios/ExpoWidgetsTarget/index.swift` (wenn Widget existiert)

**Commit:**
```bash
git commit -m "chore(app): bump build to 260703-1400"
```

## Git-Hooks (zukünftig)

Geplant:
- **pre-commit**: Linting, Formatierung
- **commit-msg**: Conventional Commits Validierung
- **pre-push**: Tests ausführen

## Best Practices

1. **NIEMALS vor Build & Test committen** - ❌ KEIN broken Code in Git!
   ```bash
   # ❌ FALSCH:
   git add -A && git commit -m "fix: widget"
   pnpm ios  # Dann erst testen
   
   # ✅ RICHTIG:
   pnpm ios  # Erst bauen & testen
   # Wenn alles funktioniert:
   git add -A && git commit -m "fix: widget"
   ```
   
2. **Kleine, fokussierte Commits** - Ein Commit = Eine logische Änderung

3. **Commit-Message sorgfältig schreiben** - Denk an dein Zukunfts-Ich

4. **Regelmäßig committen** - Nicht am Ende des Tages alles auf einmal
   - ABER: Nur funktionierende Zustände committen!
   - Lieber 3 funktionierende Commits als 1 broken Commit

5. **Feature-Branches** - Niemals direkt auf `main` oder `develop` committen

6. **Rebase vor Merge** - Feature-Branch auf neuesten `develop` rebasen

7. **Squash bei Bedarf** - Cleanup-Commits vor Merge squashen

## Aktuelle Branches

- **main** - Production (derzeit: Initial commit)
- **develop** - Development (derzeit: Backend + App Features)

Nächster Schritt: Feature-Branch für Expo SDK 57 Upgrade
