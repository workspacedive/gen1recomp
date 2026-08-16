# Tiefenrecherche: Scripting App für iOS

**Stand:** 2026-08-16 (UTC)
**Ziel:** belastbare technische Basis für die nächste Scripting-Implementierung
**Produktabgrenzung:** Gegenstand ist **Scripting** (`scripting.fun`, TypeScript/TSX, App Store ID `6479691128`), nicht **Scriptable** (`scriptable.app`, JavaScript).

## 1. Verifiziertes Produktprofil

Die [offizielle Produktseite](https://www.scripting.fun/en.html) beschreibt Scripting als iOS-/iPadOS-Arbeitsumgebung für:

- TypeScript und TSX mit nativen iOS-APIs;
- native Seiten und Widgets;
- App Intents, Shortcuts und Share Sheet;
- Live Activities, Dynamic Island und Notifications;
- Safari-Skripte;
- AI Agents, Tools und Skills.

Der [offizielle Quick Start](https://scriptingapp.github.io/guide/Quick%20Start) bestätigt das Programmiermodell:

- Komponenten werden aus `"scripting"` importiert;
- UI ist React-ähnliches TSX über SwiftUI-Wrapper;
- Zustand und Effekte verwenden Hooks wie `useState`, `useEffect`, `useReducer`, `useMemo`, `useCallback` und Context;
- eine einmalige UI wird mit `Navigation.present(...)` präsentiert;
- nach dem Schließen muss ein endliches Skript `Script.exit()` aufrufen, um Ressourcen freizugeben.

Die aktuelle API-Einstiegsquelle für LLMs ist der [offizielle `llms.txt`-Index](https://scriptingapp.github.io/llms.txt). Der Index ist umfangreich und releaseabhängig; deshalb wird keine lokale Liste aller APIs als dauerhaft vollständig behandelt.

## 2. Projekt- und Hostmodell

Ein importierbares Projekt enthält mindestens:

```text
Project Name/
├── script.json
└── index.tsx
```

`script.json` benötigt gemäß offiziellem Development-Skill mindestens `name`, `icon`, `color` und `version`. Zusätzliche Hosts werden nur bei Bedarf ergänzt:

| Einstiegspunkt | Host/Zweck |
|---|---|
| `index.tsx` | Start in der Scripting-App / native Seite / endliche Aufgabe |
| `widget.tsx` | Home-Screen-/Lock-Screen-Widget |
| `app_intents.tsx` | Aktionen hinter interaktiven Widgets, Live Activities und Controls |
| `live_activity.tsx` | Lock Screen und Dynamic Island |
| `notification.tsx` | erweiterte Notification-UI |
| `intent.tsx` | Shortcuts und Share Sheet |
| `browser.tsx` | Safari-Projektskript |
| weitere spezialisierte Dateien | Control Widgets, Keyboard, Spotlight, Translation UI, Assistant Tools, Alarm Live Activity |

Die vollständige, lokal gespeicherte Referenz befindet sich unter `references/official/scripting-app-development/` und stammt aus dem offiziellen Repository [ScriptingApp/scripting-app-development](https://github.com/ScriptingApp/scripting-app-development).

## 3. Widget-Fakten und Konsequenzen

Die heruntergeladene offizielle Scripting-Dokumentation und der offizielle Development-Skill bestätigen:

- Widget-UI lebt in `widget.tsx` und wird über `Widget.present(...)` ausgegeben.
- Alle Daten müssen **vor** `Widget.present(...)` vorbereitet sein; der Ausführungskontext wird danach beendet.
- Hooks bilden im Widget keinen persistenten React-Lifecycle.
- Layout und Inhalt sollen über `Widget.family`, `Widget.displaySize` und `Widget.parameter` angepasst werden.
- Scripting-Previews sind Näherungen; die reale Home-Screen-Darstellung bleibt eine notwendige Geräteprüfung.
- Interaktive `Button`-/`Toggle`-Aktionen verwenden registrierte App Intents aus `app_intents.tsx`.
- Ein Button verwendet entweder eine direkte Action oder einen Intent, nicht beides.

Apple beschreibt Widgets in der aktuellen [Human Interface Guideline für Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets) als zeitnah, auf einen Blick erfassbar und auf fokussierte Interaktionen begrenzt. Daraus folgen lokal:

- pro Widgetgröße eine echte Informationspriorisierung statt bloßer Skalierung;
- keine appartige Ansammlung vieler Controls;
- sichtbare Aktualität bei Daten, die seltener aktualisiert werden als Nutzer sie prüfen;
- Unterstützung von Light, Dark, Clear/Tinted und eingeschränkten Accessory-Kontexten;
- im Allgemeinen 16 pt Widgetrand, 11 pt nur bei begründet kompakten Gruppen;
- Text mindestens 11 pt, Systemschrift/SF Symbols bevorzugt;
- Preview plus echte Home-Screen-/Lock-Screen-Prüfung.

## 4. Entwicklung am Desktop

Das offizielle Repository dokumentiert `scripting-cli` als Live-Sync-/Debugging-Weg:

```bash
# Voraussetzung laut offizieller README: Node.js 20+
npx scripting-cli start
```

Nach der Verbindung synchronisiert die App aktuelle `.d.ts`-Deklarationen. Diese sind die beste lokale Quelle für exakte Signaturen der tatsächlich verbundenen App-Version. Die öffentlichen Guides bleiben maßgeblich für Verhalten, Berechtigungen und Hostgrenzen.

Wichtig:

- `npx` lädt das Paket bei Bedarf; dies ist ein externer Installationsschritt.
- Vor Verbindung muss der Sync-Ordner auf Secrets, private Dateien und große Artefakte geprüft werden.
- CLI-Sync oder In-App-Ausführung ersetzt kein Systemhost-E2E für Widgets, Live Activities, Shortcuts, Notifications oder Safari.

Am 2026-08-16 wurde zusätzlich das veröffentlichte npm-Paket `scripting-cli@1.5.0` statisch geprüft; Tarballgröße, SHA-1/SHA-512, npm-Integrität und geprüfte Dateien sind in `research/scripting-cli-lock.json` gepinnt. Es startet Express/Socket.IO auf dem gewählten Port, zeigt eine lokale `http://<LAN-IP>:<Port>`-Adresse/QR-Code und synchronisiert Dateien sowie Deklarationen über HTTP-/Socket-Ereignisse. In den geprüften Server-/Routerpfaden wurde keine Authentifizierungs- oder Pairing-Token-Schicht gefunden. Deshalb wird dieser Sync-Dienst aus Arena **nicht** über einen öffentlichen Preview-Host angeboten. Die physische App-Verbindung muss in einem vertrauenswürdigen lokalen Netz auf einem Nutzerrechner erfolgen, bis Upstream einen authentifizierten Remote-Modus dokumentiert. Das ist ein Sicherheitsgate, keine technische Behauptung, dass eine öffentliche Verbindung unmöglich wäre.

## 5. Dynamik und Modularität

Die untersuchten fertigen Projekte zeigen, dass Scripting Unterordner und modulare Imports unterstützt. Empfohlenes Datenmodell:

```text
Input/Parameter
  → Validierung und normalisierte Config
  → Domain/Use Case
  → schmaler Datenadapter (native API, HTTP, Storage)
  → typisierter UI-State
  → Host-spezifische View/Output
```

„Dynamisch“ wird konkret umgesetzt durch:

- datengetriebene Collections/Sections statt kopierter UI-Blöcke;
- `Widget.family` für familienabhängige Informationsarchitektur;
- `Widget.parameter` oder validierte persistierte Einstellungen für Nutzerkonfiguration;
- zentrale i18n-Ressourcen und localegerechte Formatter;
- zentrale semantische Theme-/Spacing-Tokens;
- Cache mit Schema-Version, Aktualitätszeitpunkt und validiertem Fallback bei Netzabhängigkeit;
- Domain-Modelle, die von Widget, Seite und Intent wiederverwendet werden.

Nicht dynamisch bzw. zu vermeiden:

- API-Schlüssel, Nutzer-IDs, Ortsdaten oder Credentials im Quelltext;
- Hexfarben, Abstände und Texte über viele Views verstreut;
- UI direkt an unvalidierte API-Antworten koppeln;
- dieselbe Fachlogik in `index.tsx`, `widget.tsx` und `intent.tsx` kopieren;
- Reflexion oder generische Abstraktion ohne echten Variationspunkt.

## 6. Sicherheits- und Datenschutzbefund

Scripting kann auf sensible native APIs zugreifen. Der genaue Berechtigungsdialog und Denial-Pfad muss pro API aus aktueller Doku und am Gerät geprüft werden. Besonders sensibel:

- Health, Standort, Kontakte, Fotos, Kalender/Erinnerungen;
- Mikrofon, Kamera, Speech Recognition;
- Dateien, Zwischenablage und Browserdaten;
- Netzwerk-Uploads, Nachrichten und externe Automationen.

Verbindliche Konsequenzen:

- minimale Capability und minimale Datenmenge;
- klare Erklärung von Ziel und Zweck vor nicht bereits autorisiertem Zugriff;
- keine sensitiven Logs;
- Eingabevalidierung für Parameter, Intent-Daten, URLs und Dateien;
- Secrets nur über eine **aktuell dokumentierte sichere Scripting-API** — kein erfundener Keychain-Port aus Scriptable oder Swift;
- wiederholbare Trigger idempotent gestalten.

## 7. Quellenlage und Aktualität

| Quelle | Geprüfter Stand | Verwendung |
|---|---:|---|
| [scripting.fun](https://www.scripting.fun/en.html) | Zugriff 2026-08-15 | Produktidentität und Capability-Überblick |
| [Quick Start](https://scriptingapp.github.io/guide/Quick%20Start) | Zugriff 2026-08-15 | TSX, Komponenten, Hooks, Navigation/Lifecycle |
| [`llms.txt`](https://scriptingapp.github.io/llms.txt) | Zugriff 2026-08-15 | aktueller API-Index |
| [ScriptingApp/scripting-app-development](https://github.com/ScriptingApp/scripting-app-development) | Commit `2991c41f42be9e50d3080c5af34315e68ebb3d86` | Projekt-, Host-, CLI-, Validierungs- und Security-Workflow |
| [ScriptingApp/scripts](https://github.com/ScriptingApp/scripts) | Commit `69115b32e48497e18c114f9c40b9ab89f9364847` | kuratiertes, fertiges Projekt; README deklariert MIT |
| [ScriptingApp/Community-Scripts](https://github.com/ScriptingApp/Community-Scripts) | Commit `1eb87838d2fc60635cfdff762cc88502966f1e99` | fertige `.scripting`-Pakete als sekundäre Muster |
| [ScriptingApp/skills](https://github.com/ScriptingApp/skills) | Commit `749a52a8946a1e9397412fadd89226ecb51eb87d` | modulare Chart-/Map-/Gradient-Muster |
| [Scripting-Dokumentationspaket](https://github.com/ScriptingApp/ScriptingApp.github.io) | Paketdateien 2026-07-01; Repo-Commit `34c59e98dd2c203edca66a8418e93d90e7ecee22` | offline durchsuchbare API-Beispiele; vor Nutzung online gegenprüfen |
| [`scripting-cli` auf npm](https://www.npmjs.com/package/scripting-cli) | Version `1.5.0`, geprüft 2026-08-16 | aktueller lokaler Sync-/Deklarationsweg und statischer Transport-Sicherheitsaudit |
| [Apple HIG](https://developer.apple.com/design/human-interface-guidelines) | Zugriff 2026-08-15 | UI/UX, Accessibility, Widgets |

### Aktualitätswarnung

Die heruntergeladene App-Store-Dokumentation trägt überwiegend den Zeitstempel 2026-07-01, während Community- und Skill-Repositories danach geändert wurden. Daher gilt sie als Offline-Orientierung, nicht als alleinige Wahrheit. Vor Produktcode wird immer die aktuelle Online-Dokumentation und, nach Geräteverbindung, die aktuelle `.d.ts` geprüft.

## 8. Ergebnis

Das Produktziel ist inzwischen Gen1Recomp in Scripting/iOS. Forschung, Micro-Spec, Architektur, Verträge und host-unabhängige Update-Sicherheitslogik liegen vor. Ein Scripting-Produktprojekt wird trotzdem erst nach einer lokalen, vertrauenswürdigen `scripting-cli`-Verbindung und Prüfung der app-synchronisierten `.d.ts` angelegt: WebView-, Dateisystem-, Lifecycle- und UI-Code darf nicht aus veralteten Beispielen oder geratenen Signaturen entstehen. Bis dahin bleiben der ROM-freie love.js-Browser-Probe und reine TypeScript-Module ausdrücklich außerhalb eines behaupteten Scripting-Runtime-Passes.
