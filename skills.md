---
name: scripting-ios-development
description: Entwickelt, prüft und dokumentiert modulare TypeScript-/TSX-Projekte für die iOS-App Scripting (scripting.fun), einschließlich nativer Seiten, Widgets, App Intents, Live Activities, Shortcuts/Share Sheet und nativer iOS-APIs. Verwenden, sobald eine Aufgabe Scripting, .scripting, script.json, index.tsx oder einen Scripting-Host betrifft.
metadata:
  display_name: Scripting iOS Development
  primary_language: de
  official_docs: https://scriptingapp.github.io/llms.txt
---

# Scripting iOS Development Skill

**Status:** verbindliche Arbeitsanweisung für dieses Repository. Während einer Produktimplementierung nicht stillschweigend ändern oder umgehen. Höherrangige Plattformvorgaben und die jeweils aktuelle Nutzeranforderung bleiben vorrangig.

## 1. Zweck und Abgrenzung

Diese Skill gilt für die App **Scripting** von `scripting.fun` (TypeScript/TSX, React-ähnliche Syntax, native SwiftUI-Wrapper) — **nicht** für die andere App **Scriptable** (JavaScript). Eine Recherche oder Implementierung, die beide verwechselt, ist ungültig.

Aktivieren bei:

- `script.json`, `index.tsx`, `widget.tsx`, `app_intents.tsx`, `intent.tsx`, `live_activity.tsx`, `notification.tsx` oder `browser.tsx`;
- iOS-Seiten, Widgets, App Intents, Live Activities, Shortcuts/Share Sheet oder nativen APIs in Scripting;
- Import-/Exportpaketen mit der Endung `.scripting`;
- Entwicklung und Live-Synchronisation über `scripting-cli`.

Nicht als Ersatz für eine native Swift/Xcode-App, eine Apple-Shortcut-Datei, Scriptable oder allgemeine Node-/Python-Automation verwenden.

## 2. Verbindliche Quellenhierarchie

Vor **jeder** neuen oder geänderten Scripting-spezifischen API-Nutzung:

1. aktuelle, von einer verbundenen Scripting-App synchronisierte `.d.ts`-Deklarationen (falls vorhanden) für exakte lokale Signaturen;
2. offizieller LLM-Index: <https://scriptingapp.github.io/llms.txt> und die dort verlinkte vollständige API-/Guide-Seite;
3. offizieller Quick Start: <https://scriptingapp.github.io/guide/Quick%20Start>;
4. lokaler, MIT-deklarierter Development-Skill unter `references/official/scripting-app-development/`;
5. fertige Referenzskripte nur als sekundäre Muster, niemals als API-Beweis;
6. Apple HIG für UX-Entscheidungen: <https://developer.apple.com/design/human-interface-guidelines>.

Suchtreffer, Modellgedächtnis, SwiftUI-Signaturen und alte Beispiele reichen nicht. Für jedes verwendete Symbol sind Import/globaler Scope, Parameter, Rückgabewert, Async-Verhalten, iOS-/App-Version, Host-Einschränkungen, Berechtigungen und dokumentiertes Beispiel zu prüfen. Bei Widersprüchen nicht raten; Abweichung dokumentieren und die aktuelle App-Deklaration für Typkompatibilität verwenden.

## 3. Start-Gate

Vor Codeänderungen diese Reihenfolge einhalten:

1. `agent.md`, diese Datei und die aktuelle Nutzeranforderung lesen.
2. Host festlegen: endliches Skript, native Seite, Widget, App Intent, Live Activity, Notification, Intent oder Safari-Skript.
3. Datenzugriff, Berechtigungen, Netzwerkziele und externe Seiteneffekte auflisten.
4. Bestehendes Projekt (`script.json`, Einstiegspunkt und direkte Abhängigkeiten) vollständig lesen.
5. Eine kurze Done-Spezifikation mit Verhalten, Zuständen, Hosts und prüfbaren Akzeptanzkriterien anlegen.
6. Exakte offizielle API-Dokumentation lesen.
7. Erst dann implementieren.

Bei einer sicherheitsrelevanten oder irreversiblen Unklarheit nachfragen. Bei einer kleinen, reversiblen Darstellungsentscheidung eine HIG-konforme Annahme treffen und dokumentieren.

## 4. Projekt- und Architekturregeln

Ein Projekt benötigt mindestens:

```text
Project Name/
├── script.json
├── index.tsx
├── optional host entry points
└── src/
    ├── config/       # Defaults, Validierung, Migration
    ├── domain/       # Typen und reine Fachlogik
    ├── data/         # Native APIs, HTTP, Cache, Persistenz
    ├── ui/           # Tokens, Komponenten, Screens, Zustände
    └── i18n/         # Lokalisierte Texte
```

Für sehr kleine Projekte dürfen leere Ebenen entfallen. Sobald Logik wiederverwendet wird oder ein zweiter Host hinzukommt, muss sie in ein gemeinsames Modul.

Verbindlich:

- `script.json` enthält mindestens `name`, `icon`, `color` und `version`; Name und Projektordner stimmen normalerweise überein.
- Einstiegspunkte sind dünne Host-Adapter. Fachlogik, Datenzugriff und UI-Komponenten werden nicht zwischen Hosts dupliziert.
- Abhängigkeiten laufen nach innen: UI → Use Case/Domain → Data Adapter; Domain importiert keine UI.
- Öffentliche Modulgrenzen und persistierte Daten werden typisiert und validiert. `any` ist ohne dokumentierten Grund verboten.
- Erwartete Fehler werden behandelt und in einen verständlichen UI-Zustand übersetzt.
- Wiederholte Trigger dürfen keine doppelten Listener, Uploads, Schreibvorgänge oder Benachrichtigungen erzeugen.
- Konfigurierbare Werte stammen aus einem validierten Config-Modell, Widget-Parametern, Storage oder Nutzereingaben. Secrets stehen niemals im Quelltext, in Metadaten, Logs, Screenshots oder Beispieldateien.
- Stabile Produktregeln, API-Endpunkte und Design-Tokens dürfen zentral als benannte Konstanten definiert sein. „Nicht hardcoded“ bedeutet nicht „keine Konstanten“, sondern keine verstreuten Magic Values und keine nutzerspezifischen/secretsensitiven Werte im Code.
- Keine Bibliothek oder Capability ohne konkreten Bedarf hinzufügen.

## 5. Lifecycle

| Bedarf | Verhalten |
|---|---|
| Endliche Arbeit abgeschlossen | `Script.exit()` auf jedem Abschlussweg. |
| Einmalige Seite | `await Navigation.present(...)`, danach `Script.exit()`. |
| Zustand muss Re-Trigger überleben | Nur nach Dokuprüfung `Script.minimize()` und `Script.onResume(...)`; kein sofortiges `exit`. |
| `intent.tsx` | Auf jedem Pfad einen passenden Wert über `Script.exit(value)` zurückgeben. |
| Widget | Alle Daten vor `Widget.present(...)` vorbereiten; danach läuft kein Code weiter. |

Hooks nicht als persistente Widget-Lifecycle-Mechanik behandeln.

## 6. Verbindliches UI/UX-System

Vor UI-Arbeit `docs/ui-ux.md` lesen. Mindestregeln:

- Native Komponenten und bekannte iOS-Muster bevorzugen: `NavigationStack`, `List`, `Section`, systemeigene Controls, SF Symbols und semantische Systemfarben.
- Eine klare Informationshierarchie und höchstens ein bis zwei prominente Aktionen pro Ansicht.
- Tap-Ziele mindestens 44 × 44 pt; Text im Regelfall mit dynamischen Systemstilen und nie kleiner als 11 pt.
- Light/Dark Mode sowie erhöhten Kontrast berücksichtigen; Farbe nie als einziges Statussignal verwenden.
- Für asynchrone Daten explizite Zustände modellieren: `idle`, `loading`, `content`, `empty`, `error`; bei Mutation zusätzlich `saving/success`.
- Fehler nahe der Ursache, ohne Schuldzuweisung und mit konkretem nächsten Schritt anzeigen. Alerts nur für kritische oder unterbrechungswürdige Situationen.
- Deutsche und englische Texte über zentrale i18n-Ressourcen; Datum, Uhrzeit, Zahlen und Einheiten lokal formatieren. Layout mit langen Texten und Right-to-Left mitdenken.
- Destruktive Aktionen erhalten die semantische Rolle und bei unerwartetem, irreversiblem Datenverlust eine Bestätigung.
- Widgets bleiben glanceable, fokussiert und pro `Widget.family` gestaltet. Standardmäßig 16 pt Rand, bei begründet kompaktem Layout 11 pt. Tinted/clear/dark/light und reale Home-Screen-Darstellung prüfen.
- UI darf keine ungeprüften Rohdaten oder technischen Fehlermeldungen direkt ausgeben.

## 7. Datenschutz und Sicherheit

Vor erweitertem Datenzugriff oder externer Wirkung Auswirkung und Ziel transparent machen und — wenn nicht bereits ausdrücklich beauftragt — Zustimmung einholen. Dies betrifft insbesondere Gesundheit, Standort, Fotos, Kalender, Kontakte, Mikrofon/Kamera, Dateien, Zwischenablage, Cookies, Uploads, Nachrichten, Löschen und Massenänderungen.

- Minimal notwendige Berechtigungen und Datenmenge.
- HTTPS und benannte, vertrauenswürdige Endpunkte.
- Externe Eingaben (URL, Dateipfad/-typ/-größe, Widget-Parameter, Intent-Daten und Netzwerkantworten) validieren.
- Keine Geheimnisse oder privaten Nutzerdaten protokollieren.
- Cache und Persistenz versionieren; fehlerhafte oder alte Daten sicher migrieren bzw. verwerfen.
- Schreibende/externe Aktionen idempotent oder bestätigungspflichtig gestalten.

## 8. Verifikation — keine Behauptung ohne Evidenz

Nach jeder Implementierung in dieser Reihenfolge, soweit der Host es ermöglicht:

1. JSON/Metadaten und Dateistruktur prüfen.
2. Alle Scripting-Symbole gegen aktuelle Doku/Typen gegenprüfen.
3. TypeScript-Diagnostik ohne neue Fehler.
4. Reine Domain-/Parser-/Config-Logik mit automatisierten Tests prüfen.
5. Endlichen Lauf ausführen und korrektes Beenden prüfen.
6. UI bzw. jede Ziel-Widgetfamilie previewen.
7. Erfolgsweg, leere Daten, ungültige Daten, verweigerte Berechtigung und Netzwerkfehler prüfen.
8. Reale Host-E2E-Prüfung auf dem Gerät durchführen oder exakt als offen benennen.

Evidenzstufen dürfen nicht vermischt werden: Ein Preview beweist nicht Home Screen, Lock Screen, Shortcuts, Notification oder Safari. Ein Typecheck beweist keinen Runtime- oder Berechtigungsweg.

## 9. Abschlussformat

Jede Übergabe nennt knapp und prüfbar:

1. geänderte Dateien und Verhalten;
2. Architektur- und Lifecycle-Entscheidung;
3. geprüfte offizielle Doku/API-Symbole;
4. ausgeführte Checks mit Ergebnis;
5. verbleibende reale Geräte-/Host-Schritte;
6. neue Berechtigungen, Datenziele und Seiteneffekte;
7. bekannte Grenzen oder unbestätigte Annahmen.

„Fertig“ ist nur zulässig, wenn alle automatisierbaren Kriterien bestanden sind und verbleibende Geräteprüfungen ausdrücklich getrennt ausgewiesen werden.
