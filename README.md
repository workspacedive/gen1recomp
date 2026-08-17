# gen1recomp — Scripting iOS groundwork

Dieses Repository ist für die kommende Entwicklung eines modularen TypeScript-/TSX-Projekts in der iOS-App [Scripting](https://www.scripting.fun/en.html) vorbereitet.

> **Wichtig:** Scripting ist nicht Scriptable. Scripting verwendet TypeScript/TSX und native SwiftUI-Wrapper; Scriptable-Beispiele mit `ListWidget` oder `Script.setWidget` sind keine gültige API-Referenz.

## Verbindliche Arbeitsdateien

- [`agent.md`](agent.md) — Rolle, Ablauf und Definition of Done des Engineering-Agenten
- [`skills.md`](skills.md) — LLM-Skill mit Quellen-, Architektur-, Security- und Verifikationsregeln
- [`docs/ui-ux.md`](docs/ui-ux.md) — konsistentes iOS-UI/UX-System
- [`docs/research/scripting-app.md`](docs/research/scripting-app.md) — technische Tiefenrecherche
- [`docs/research/example-audit.md`](docs/research/example-audit.md) — Audit fertiger, heruntergeladener Projekte

`AGENTS.md` und `SKILL.md` sind symbolische Verweise auf die beiden kanonischen lowercase-Dateien, damit gängige Agent-/Skill-Loader dieselben Regeln finden, ohne doppelte und auseinanderlaufende Kopien zu erzeugen.

## Referenzen

### Versionierte offizielle Snapshots

`references/official/` enthält:

- das vollständige offizielle Projekt **Video to Live Photo**;
- den offiziellen **Scripting App Development Skill** mit Referenzen, Checklisten und Templates.

Die jeweilige Upstream-Revision und Lizenzangabe ist in `UPSTREAM.md` dokumentiert. Vor API-Nutzung bleibt die aktuelle [offizielle LLM-Dokumentation](https://scriptingapp.github.io/llms.txt) maßgeblich.

### Heruntergeladene Forschungsdaten

`research/downloads/` enthält reproduzierbar:

- fünf fertige `.scripting`-Pakete aus Community-Scripts;
- das offizielle Scripting-Dokumentationspaket mit 136 TypeScript-/TSX-Beispielen;
- das offizielle fertige Projekt und den Development-Skill;
- die offiziellen Gradient-, Chart- und Map-Skills.

Der Ordner ist absichtlich Git-ignoriert, weil mehrere Upstream-Sammlungen keine eindeutige Root-Lizenz ausweisen. Quellen, Revisionen und Prüfsummen stehen in [`research/source-manifest.json`](research/source-manifest.json).

## Referenzen reproduzieren und prüfen

Voraussetzungen: Python 3, Git und authentifiziertes GitHub CLI (`gh`). Es werden nur gepinnte öffentliche Upstream-Revisionen geladen; keine Credentials werden im Repository gespeichert.

```bash
python3 tools/sync_references.py
python3 tools/audit_references.py --report docs/reference-audit.json
```

Der Audit prüft:

- SHA-256 der gepinnten Hauptartefakte;
- ZIP-Integrität und Pfadsicherheit aller `.scripting`-Pakete;
- `script.json` und `index.tsx`;
- Pflichtmetadaten;
- Umfang des offiziellen Dokumentationspakets;
- Vorhandensein der Governance-, Research- und UI/UX-Dokumente.

Aktueller Befund: **bestanden**, mit einer dokumentierten Upstream-Warnung — `Colorful Clouds.scripting` besitzt in seiner `script.json` keine gesetzte Version. Details: [`docs/reference-audit.json`](docs/reference-audit.json).

## Gen1Recomp-Ziel

Das konkrete Ziel ist eine möglichst originalgetreue Gen1Recomp-Laufzeit in **Scripting auf iOS**. Das Projekt ist ausdrücklich:

- keine Nutzung von Scriptable;
- kein Game-Boy-Emulator und enthält keinen CPU-/Bus-/PPU-Interpreter;
- keine ungeprüfte Behauptung, Scripting könne native LÖVE-, LuaJIT- oder Metal-Bibliotheken laden;
- eine modulare Portierungsarchitektur mit dem Datenpfad Nutzer-ROM → verifizierter Import/privater Cache → originale Gen1Recomp-Logik → LÖVE-Kompatibilität → Renderer/Audio/Input.

Der zentrale Runtime-Startgate ist bestanden: Preview 0.1.4 hat auf einem physischen iPhone mit iOS 18.7 den lokalen Scripting-Host, klassische Bundles, eingebetteten ROM-freien Payload, Lua-Normalisierer, WASM, love.js/Lua, WebGL, Canvas und laufenden Frame-Loop belegt. Das beweist noch keine ROM-Extraktion, Spielparität, Touch-/Audio-/Save-Qualität, Update-Dauerhaftigkeit, Performance oder breite Gerätekompatibilität. `TimelineCanvas` bleibt Diagnose/Fallback und ist nicht als Paritätsrenderer freigegeben.

### Forschungs- und Architekturdokumente

- [`docs/gen1recomp/phase-0-spec.md`](docs/gen1recomp/phase-0-spec.md) — Machbarkeitshypothesen, Gates und No-Go-Kriterien
- [`docs/gen1recomp/source-forensics.md`](docs/gen1recomp/source-forensics.md) — Quell-, Runtime-, Render-, Mod-, Save- und Update-Forensik
- [`docs/research/gen1recomp-rom-library-audit.md`](docs/research/gen1recomp-rom-library-audit.md) — gepinnte Import-/Cache-/Save-Grenzen und daraus abgeleiteter Native-0.4.0-Handoff
- [`docs/gen1recomp/android-analysis.md`](docs/gen1recomp/android-analysis.md) — getrennte Android-Referenzanalyse
- [`docs/gen1recomp/technology-evaluation.md`](docs/gen1recomp/technology-evaluation.md) — Runtime-/Grafik-/Audio-/Input-Entscheidungsmatrix
- [`docs/gen1recomp/web-runtime-analysis.md`](docs/gen1recomp/web-runtime-analysis.md) / [`web-runtime-surface.json`](docs/gen1recomp/web-runtime-surface.json) / [`lovejs-smoke-report.json`](docs/gen1recomp/lovejs-smoke-report.json) / [`lovejs-launcher-report.json`](docs/gen1recomp/lovejs-launcher-report.json) — reproduzierbarer LÖVE-/Lua-Web-Kompatibilitätsumfang, ausgeführter Smoke-Test und ROM-freier Launcher-Boot
- [`docs/gen1recomp/thread-fallback-analysis.md`](docs/gen1recomp/thread-fallback-analysis.md) — gemessene Worker-Unverfügbarkeit, Bootstrap-Normalisierung und alle No-Thread-Pfade
- [`docs/gen1recomp/target-architecture.md`](docs/gen1recomp/target-architecture.md) — Komponenten, Ports, Protokolle und Rollback
- [`docs/gen1recomp/compatibility-matrix.md`](docs/gen1recomp/compatibility-matrix.md) — unabhängige Versionen und Aktivierungsregeln
- [`docs/gen1recomp/ui-ux.md`](docs/gen1recomp/ui-ux.md) — native Plattform-UI versus originale Game-UI
- [`docs/gen1recomp/native-shell-updates-spec.md`](docs/gen1recomp/native-shell-updates-spec.md) — Done Contract, Datenfluss und Sicherheitsgrenzen des manuellen System-Updaters
- [`docs/gen1recomp/mod-store-architecture.md`](docs/gen1recomp/mod-store-architecture.md) — eigenständiger App-Store-inspirierter Mods-Tab, Profile, Consent, Updates und Rollback
- [`docs/research/potato-voxel-mod-audit.md`](docs/research/potato-voxel-mod-audit.md) — externe, nicht integrierte PotatoVoxel-Referenz zu Manifest, GitHub Releases, Berechtigungen, Cache und Lizenzgrenzen
- [`docs/gen1recomp/scripting-device-run-001.md`](docs/gen1recomp/scripting-device-run-001.md) — kumulative physische Läufe einschließlich bestandenem Preview-0.1.4-Start
- [`docs/gen1recomp/scripting-native-020-report.json`](docs/gen1recomp/scripting-native-020-report.json) — physisch korrelierter nativer 0.2.0-Runtime-Bericht
- [`docs/gen1recomp/scripting-native-030-report.json`](docs/gen1recomp/scripting-native-030-report.json) — Paket-, Sicherheits- und Runtime-Bericht der 0.3.0-Komponenten-/Modverwaltung
- [`docs/gen1recomp/scripting-native-040-report.json`](docs/gen1recomp/scripting-native-040-report.json) / [`scripting-native-041-report.json`](docs/gen1recomp/scripting-native-041-report.json) / [`scripting-native-042-report.json`](docs/gen1recomp/scripting-native-042-report.json) / [`scripting-native-043-report.json`](docs/gen1recomp/scripting-native-043-report.json) / [`scripting-native-044-report.json`](docs/gen1recomp/scripting-native-044-report.json) — physischer Yellow-Import-, Adapter- und Spielstartbefund
- [`docs/gen1recomp/scripting-native-051-report.json`](docs/gen1recomp/scripting-native-051-report.json) — physischer Post-Ready-Titel-Pass, Save-Management-Bericht und widerlegte Legacy-Tab-Hypothese
- [`docs/gen1recomp/scripting-native-052-report.json`](docs/gen1recomp/scripting-native-052-report.json) / [`scripting-native-052-device-plan.md`](docs/gen1recomp/scripting-native-052-device-plan.md) — aktueller moderner Tab-/Observable-Kandidat und Geräteplan
- [`docs/gen1recomp/scripting-capability-probes.md`](docs/gen1recomp/scripting-capability-probes.md) — physischer Geräteprüfplan
- [`docs/gen1recomp/device-connection.md`](docs/gen1recomp/device-connection.md) — sicherer lokaler `scripting-cli`-/Deklarations-Handoff
- [`docs/gen1recomp/architecture-audit.md`](docs/gen1recomp/architecture-audit.md) — dokumentübergreifender Konsistenz- und Evidenzaudit
- [`docs/gen1recomp/forensics.json`](docs/gen1recomp/forensics.json) — maschinenlesbare Faktenbasis

### Aktueller Implementierungsstand

- `components/contracts/src/`: strikte TypeScript-Verträge für Hostprotokoll, Plattform, Runtime, Renderer, Input, Mods und Komponentenmanifeste;
- `components/updates/src/`: geschlossener Katalogparser/Trust-Policy, Update-Inventar und -Planung, SemVer-/Dependency-/API-Kompatibilität, Archivrichtlinie, manueller Transaktionsorchestrator, Aktivierungsjournal und Recovery;
- `updates/`: deterministische ROM-freie aktuelle LÖVE/Lua- und Gen1Recomp-Komponentenpakete plus sequenzierter Stable-Systemkatalog;
- `scripting/Gen1RecompPreview/`: physisch validierter Preview-0.1.4-Runtime-Fallback;
- `scripting/Gen1RecompApp/`: nativer 0.5.2-Produktshell mit aktuellem offiziellem iOS-18+-Tab/Observable-Baum, verifiziertem Spieleimport, ausgewähltem Slot-Start, SHA-256-gebundenem Save-Backup/Restore/Delete, Retina-/Vektor-Gameplane, post-ready In-WebView-Spieltitel, nativem Dismiss, Unterbrechungs-Recovery, privatem Effektcache, Updates und Mods;
- `runtime/adapters/lovejs/` und `runtime/manager/`: serialisierte Persistenz, funktionale Capability-Evidenz und geordnete Lifecycle-/Concurrency-Grenzen;
- `compatibility/love-web/`: vollständiger BitOp-Hostshim plus No-Worker-Normalisierung;
- `schemas/`: geschlossene JSON-Schemas einschließlich Updatekatalog;
- `tools/package_system_updates.py` und `tools/package_scripting_app.py`: reproduzierbare Systemfeeds und `.scripting`-Pakete;
- `tests/`: Vertrag, Schema, Runtime, Archiv, Resolver, Katalog, Updateplan/-orchestrierung, Recovery, Scripting-Deklarationssubset und deterministische Pakete.

Native 0.4.0 identifizierte auf Scripting 3.2.0/iOS 26.6 die kanonische Yellow-ROM, registrierte sie privat und erreichte den unveränderten Upstream-Importer. Dort deckte der reale Lauf die im PUC-Lua-Adapter fehlende LuaJIT-Globale `_G.bit` auf. Native 0.4.1 installiert den bereits differentialgetesteten BitOp-Shim zusätzlich global vor Upstream-Start; der Core bleibt unverändert. Abgeschlossene Extraktion, WebKit-/App-Group-Dauerhaftigkeit, Lifecycle, Input/Audio/Fidelity sowie alle 0.3.0-Datei-/GitHub-Aktionen bleiben physische Gates. Mods bleiben bis zu Profil-, Consent- und Runtime-Injektion inaktiv.

Gepinnte Gen1Recomp-/Wiki-/Runtime-Quellen reproduzieren und den ROM-freien Web-Probe vorbereiten:

```bash
python3 tools/acquire_gen1recomp.py --source-only
python3 tools/package_gen1recomp_payload.py --version 0.1.96
python3 tools/prepare_lovejs_smoke.py
python3 tools/prepare_lovejs_launcher.py
```

Prüfen:

```bash
npm ci
npm run verify
npm audit --audit-level=moderate
python3 tools/audit_references.py --report docs/reference-audit.json
```

Weitere Produktpfade werden nur nach ihrem jeweiligen Declaration-/Gerätegate aktiviert. Unbekannte Fähigkeiten werden als inkompatibel behandelt, nicht erfunden.

Direkt importierbare, ROM-freie Pakete liegen unter [`artifacts/`](artifacts/). Native 0.5.1 bestätigte physisch Retina `1320×2868`, Spielstart und readiness-gebundenen Titel, widerlegte aber den abgeflachten Legacy-Tab-Baum als vollständigen `t.__type__`-Fix. Native 0.5.2 ist der aktuelle moderne native Tab-/Observable-Kandidat; Upstream 0.1.99 bleibt ein getrenntes manuelles Komponentenupdate.
