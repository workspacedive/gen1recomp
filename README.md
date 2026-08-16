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

Die Laufzeitentscheidung ist noch durch reale Gerätetests blockiert. Der bevorzugte, aber unbewiesene Spike ist eine lokale Scripting-WebView mit einer gepinnten LÖVE-11.5-Weblaufzeit. `TimelineCanvas` bleibt Diagnose/Fallback und ist nicht als Paritätsrenderer freigegeben.

### Forschungs- und Architekturdokumente

- [`docs/gen1recomp/phase-0-spec.md`](docs/gen1recomp/phase-0-spec.md) — Machbarkeitshypothesen, Gates und No-Go-Kriterien
- [`docs/gen1recomp/source-forensics.md`](docs/gen1recomp/source-forensics.md) — Quell-, Runtime-, Render-, Mod-, Save- und Update-Forensik
- [`docs/gen1recomp/android-analysis.md`](docs/gen1recomp/android-analysis.md) — getrennte Android-Referenzanalyse
- [`docs/gen1recomp/technology-evaluation.md`](docs/gen1recomp/technology-evaluation.md) — Runtime-/Grafik-/Audio-/Input-Entscheidungsmatrix
- [`docs/gen1recomp/web-runtime-analysis.md`](docs/gen1recomp/web-runtime-analysis.md) / [`web-runtime-surface.json`](docs/gen1recomp/web-runtime-surface.json) — reproduzierbarer LÖVE-/Lua-Web-Kompatibilitätsumfang
- [`docs/gen1recomp/target-architecture.md`](docs/gen1recomp/target-architecture.md) — Komponenten, Ports, Protokolle und Rollback
- [`docs/gen1recomp/compatibility-matrix.md`](docs/gen1recomp/compatibility-matrix.md) — unabhängige Versionen und Aktivierungsregeln
- [`docs/gen1recomp/ui-ux.md`](docs/gen1recomp/ui-ux.md) — native Plattform-UI versus originale Game-UI
- [`docs/gen1recomp/scripting-capability-probes.md`](docs/gen1recomp/scripting-capability-probes.md) — physischer Geräteprüfplan
- [`docs/gen1recomp/device-connection.md`](docs/gen1recomp/device-connection.md) — sicherer lokaler `scripting-cli`-/Deklarations-Handoff
- [`docs/gen1recomp/architecture-audit.md`](docs/gen1recomp/architecture-audit.md) — dokumentübergreifender Konsistenz- und Evidenzaudit
- [`docs/gen1recomp/forensics.json`](docs/gen1recomp/forensics.json) — maschinenlesbare Faktenbasis

### Aktueller minimaler Implementierungsstand

Der erste host-unabhängige Schnitt ist implementiert; ein spielbarer Scripting-Port ist es noch nicht:

- `components/contracts/src/`: strikte TypeScript-Verträge für Hostprotokoll, Plattform, Runtime, Renderer, Input und Komponentenmanifeste;
- `schemas/`: JSON Schema 2020-12 für Hostnachrichten und Komponentenmanifeste;
- `components/updates/src/`: sichere Archiv-Vorprüfung, SemVer-Abhängigkeitsauflösung sowie journalisierte Aktivierung/Recovery;
- `tests/`: Vertrags-, Schema-, Archiv-, Resolver-, Journal-/Recovery- und Acquisition-Tests;
- `probes/lovejs-smoke/`: ROM-freier, extern vorbereitbarer LÖVE-11.5-Web-Smoke-Test; noch kein Scripting-Runtime-Pass.

Gepinnte Gen1Recomp-/Wiki-/Runtime-Quellen reproduzieren und den ROM-freien Web-Probe vorbereiten:

```bash
python3 tools/acquire_gen1recomp.py --source-only
python3 tools/prepare_lovejs_smoke.py
```

Prüfen:

```bash
npm ci
npm run verify
npm audit --audit-level=moderate
python3 tools/audit_references.py --report docs/reference-audit.json
```

Breite Portierung, Scripting-API-Adapter und Payload-Integration beginnen erst nach declaration-backed Geräteproben. Unbekannte Fähigkeiten werden als inkompatibel behandelt, nicht erfunden.
