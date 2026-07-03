# Development Guidelines

## Verwendung neuer Libraries und Komponenten

### WICHTIG: Immer offizielle Dokumentation konsultieren!

Bevor eine neue Library, Framework oder Komponente in diesem Projekt verwendet wird, **MUSS** die offizielle Dokumentation konsultiert werden.

### Prozess für neue Komponenten

1. **Offizielle Dokumentation finden**
   - Primärquelle: Offizielle Docs der Library (z.B. docs.expo.dev)
   - Sekundärquelle: GitHub Repository README
   - Tertiärquelle: Gut gepflegte Community-Tutorials

2. **Beispiel-Code analysieren**
   - Offizielles Beispiel-Projekt finden (z.B. `npx create-expo-app --example with-widgets`)
   - Code-Patterns aus der Dokumentation übernehmen
   - **NICHT** von alten Projekten/Tutorials kopieren ohne Docs zu prüfen!

3. **API-Konventionen verstehen**
   - Wie sind Komponenten strukturiert?
   - Welche Direktiven/Annotations werden benötigt?
   - Welche Imports sind korrekt?
   - Welche Build-Time vs. Runtime Konzepte gibt es?

4. **Dokumentation im Code**
   - Link zur offiziellen Dokumentation im Code-Kommentar
   - Erklärung warum bestimmte Patterns verwendet werden
   - Warnungen vor häufigen Fehlern

### Beispiel: expo-widgets

**❌ FALSCH - Trial & Error ohne Docs:**
```typescript
'use widget';  // <- Top-level, falsch!
export default function MyWidget(props) {
  return <Column>...</Column>  // <- Falsche Components
}
```

**✅ RICHTIG - Nach offizieller Docs:**
```typescript
import { VStack } from '@expo/ui/swift-ui';  // <- Richtige Import-Quelle
import { createWidget } from 'expo-widgets';

const MyWidget = (props, env) => {
  'widget';  // <- Direktive INNERHALB der Funktion!
  return <VStack>...</VStack>
};

const Widget = createWidget('MyWidget', MyWidget);
export default Widget;  // <- Exportiert Widget-Objekt, nicht Komponente

// Quelle: https://docs.expo.dev/versions/latest/sdk/widgets/
```

### Warum ist das wichtig?

**Fall: expo-widgets Widget-Reload**

- ❌ **Ohne Docs:** 6+ Stunden Debugging, Trial & Error
  - `'widget'` Direktive falsch platziert → Widget nicht kompiliert
  - Falscher Export → `createWidget()` Fehler
  - Falsche Imports → Compiler konnte nicht zu SwiftUI konvertieren
  - Ergebnis: Leere `ios/ExpoWidgetsTarget/index.swift`

- ✅ **Mit Docs:** 15 Minuten Implementation
  - Offizielles Beispiel gefunden
  - Korrekte Patterns übernommen
  - Widget funktioniert sofort

### Dokumentations-Quellen (Priorität)

1. **Offizielle Vendor-Dokumentation**
   - expo.dev/docs
   - reactnative.dev
   - npmjs.com (Package README)

2. **Offizielle GitHub Repositories**
   - README.md
   - `/examples` Verzeichnis
   - CHANGELOG.md für Breaking Changes

3. **Community-Ressourcen**
   - Medium Artikel von Maintainern
   - Stack Overflow (neueste Antworten)
   - GitHub Issues (bekannte Probleme)

### Red Flags - Nicht vertrauen:

- ❌ Tutorials älter als 1 Jahr (Libraries ändern sich!)
- ❌ Stack Overflow Antworten ohne Link zu Docs
- ❌ Blog Posts ohne Versions-Angabe
- ❌ Code-Beispiele ohne Erklärung warum

### Checkliste vor Implementation

- [ ] Offizielle Dokumentation gelesen?
- [ ] Offizielles Beispiel-Projekt gefunden?
- [ ] Versions-Kompatibilität geprüft? (SDK 57 in unserem Fall)
- [ ] API Breaking Changes im CHANGELOG geprüft?
- [ ] Code-Kommentare mit Docs-Link versehen?

### Checkliste vor Commit

**WICHTIG: NIEMALS vor Build & Test committen!**

- [ ] Code geschrieben
- [ ] **Build erfolgreich** (`pnpm ios` oder `pnpm android`)
- [ ] **Manuell getestet** - Feature funktioniert wie erwartet
- [ ] Keine Fehler in Console/Logs
- [ ] **ERST DANN** committen!

```bash
# ❌ FALSCH - Commit vor Test:
git add -A
git commit -m "fix: something"
pnpm ios  # Oh nein, es funktioniert nicht!

# ✅ RICHTIG - Erst testen, dann committen:
# 1. Code schreiben
# 2. Bauen & Testen
pnpm ios
# 3. Verifizieren dass es funktioniert
# 4. DANN committen
git add -A
git commit -m "fix: something"
```

**Grund:** Broken commits verschwenden Zeit beim Debugging und machen Git-Bisect unmöglich.

### Beispiele aus diesem Projekt

#### ✅ Gut dokumentiert:
- `widgets/MeteoblickWidget.tsx` - Link zu expo-widgets Docs, Erklärung der `'widget'` Direktive
- `docs/WIDGET_ARCHITECTURE.md` - Recherche-basierte Architektur-Entscheidung

#### ❌ Zu verbessern:
- Custom Native Modules ohne Docs-Check (6 Stunden verschwendet)
- Trial & Error mit expo-widgets ohne offizielle Beispiele zu prüfen

---

## Weitere Guidelines

### Git Workflow
Siehe: [docs/GIT_WORKFLOW.md](./GIT_WORKFLOW.md)

### Development Scripts
Siehe: [docs/DEVELOPMENT.md](./DEVELOPMENT.md)

### Widget Architecture
Siehe: [docs/WIDGET_ARCHITECTURE.md](./WIDGET_ARCHITECTURE.md)
