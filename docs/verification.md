# Verifikationsprotokoll und Evidenzregeln

**Letzter Lauf:** 2026-08-16T18:14:16Z
**Maschinenlesbarer Bericht:** [`reference-audit.json`](reference-audit.json)

## Ausgeführte Checks

```bash
python3 -m py_compile tools/sync_references.py tools/audit_references.py
python3 tools/sync_references.py
python3 tools/audit_references.py --report docs/reference-audit.json
```

Ergebnis:

- Python-Syntax: bestanden;
- vier gepinnte Git-Repositories erfolgreich ausgecheckt;
- offizielles Dokumentationspaket über GitHub API geladen;
- zehn gepinnte Hauptartefakte (acht Downloads und zwei versionierte Snapshots) per SHA-256 bestätigt;
- fünf `.scripting`-Archive ohne ZIP- oder Pfadfehler;
- alle fünf Archive enthalten `script.json` und `index.tsx`;
- offizielles Dokumentationspaket: 1.314 Einträge, 136 TS/TSX-Dateien, 760 Markdown-Dateien, 4.376.720 Bytes unkomprimiert;
- Governance-/Research-/UI-Dateien vorhanden und mit erwarteten Abschnitten;
- beide versionierten Referenz-Snapshots bytegleich mit ihren gepinnten Upstream-Dateien (ausgenommen lokale `UPSTREAM.md`);
- vier versionierte JSON-Dateien erfolgreich geparst;
- lokale Links in acht gepflegten Markdown-Dateien ohne gebrochenes Ziel;
- Gesamtaudit: **passed**.

Bekannte Upstream-Warnung:

- `Colorful Clouds.scripting`: `script.json.version` ist leer. Das Paket bleibt nur Referenz und wird in diesem Zustand nicht als Produktionsvorlage akzeptiert.

## Gen1Recomp-Verifikation

Ausgeführt:

```bash
npm run verify
npm audit --audit-level=moderate
python3 -m py_compile tools/*.py
python3 tools/audit_references.py --report docs/reference-audit.json
python3 tools/analyze_web_runtime_surface.py --source research/downloads/gen1recomp/source-v0.1.96 --out docs/gen1recomp/web-runtime-surface.json
python3 tools/package_gen1recomp_payload.py --version 0.1.96
python3 tools/prepare_lovejs_smoke.py
python3 tools/prepare_lovejs_launcher.py
python3 -m zipfile -t research/downloads/gen1recomp/lovejs-smoke/smoke.love
python3 -m zipfile -t research/downloads/gen1recomp/lovejs-launcher/gen1recomp.love
```

Zusätzlich wurde `tools/analyze_gen1recomp.py` erneut gegen den gepinnten v0.1.96-Quellbaum, das lokale `game.love` und den leeren fehlgeschlagenen APK-Transfer ausgeführt; der Bericht war nach Entfernen nur des Laufzeitstempels exakt gleich zu `docs/gen1recomp/forensics.json`.

Ergebnis:

- TypeScript 7.0.2 `strict`/`noEmit`: bestanden;
- 63 Node-Unit-Tests: bestanden (Verträge einschließlich geschlossenem Runtime-Boot-Parser, JSON Schema 2020-12, Viewport, funktionale Runtime-Evidenz, love.js-Persistenz-/Lifecycle-Port, Lifecycle-/Concurrency-Manager, Archivregeln, SemVer-Resolver, Aktivierungsjournal und Recovery);
- 20 Python-Unit-Tests: bestanden (Acquisition-Größen/Hashes/Partials, deterministisches LÖVE-Probe-Archiv, HTTP-Header/Report-Endpunkt und LuaJIT-BitOp-Shim-Parität);
- npm-Audit: 0 bekannte Schwachstellen auf der eingestellten Audit-Stufe;
- Python-Syntax aller Tools: bestanden;
- `tools/acquire_gen1recomp.py --source-only`: gepinnte Dev-/Wiki-/Release-Worktree-/love.js-Revisionen erfolgreich reproduziert; bestehende Git-Worktree-`.git`-Dateien werden korrekt erkannt;
- deterministischer ROM-freier Payload: zwei Packläufe bytegleich, SHA-256 `a415960e…`, 483 Dateien / 15.936.729 Bytes unkomprimiert, keine generated/ROM-Inhalte;
- reproduzierbarer statischer Web-Runtime-Surface-Report: 347 Lua-Dateien, 126 LÖVE-Member und 105 direkte Call-Formen inventarisiert (keine Supportbehauptung);
- love.js-Kandidatenrevision und fünf Runtime-Dateien per Größe/SHA-256 bestätigt;
- deterministisches `smoke.love`: ZIP-Integrität bestanden;
- statischer Smoke-Server: COOP/COEP/CSP, `application/wasm`, No-Store und begrenzter Report-Endpunkt geprüft;
- erste Browserausführung: reproduzierbarer Fail durch fehlendes `require("bit")`; keine stille Kompatibilitätsannahme;
- `compatibility/love-web/bit.lua`: vollständige reine-Lua-BitOp-Oberfläche, **9.492 Differentialvergleiche gegen vendored LuaJIT 2.1 bestanden**;
- erweiterte Browserausführung: **23/23 Smoke-Checks bestanden** in gepinntem Headless Chromium 149 mit SwiftShader, COOP/COEP-Isolation aktiv (`crossOriginIsolated=true`, `SharedArrayBuffer` vorhanden); geprüft wurden LÖVE 11.5, Lua 5.1, `setfenv`, `loadstring`, BitOp, Coroutine, WASM, WebGL1/2, Canvas, ImageData, Minimalshader, deterministischer 1/60-Schritt, Queueable-Audiobuffer, Thread-Channel, Session-Datei, SHA-256 und Timer;
- Thread-Befund: `love.thread.newThread` ist als Funktion sichtbar, Worker-Erstellung scheitert jedoch reproduzierbar in love.js' Normalisierungsschicht. Der bootstrap-generierte Hostwrapper blendet nur diesen Konstruktor vor Core-Load aus;
- No-Thread-Charakterisierung: Fetch liefert sofortigen Fehler statt Pending, Update meldet Fehlerzustand, Mod Jobs melden unavailable, ROM Import wählt Coroutine und ChipAudio besteht den synchronen Fanfare-/Restore-Pfad;
- Persistenz-Charakterisierung: ein sofortiger Reload verlor den Marker in einem Chrome-92-Lauf, stellte ihn im isolierten Chromium-149-Lauf aber wieder her; explizites `FS.syncfs(false)` stellte ihn konsistent wieder her. Der neue serialisierte Persistence-Adapter macht diesen Flush deshalb zu einer expliziten Lifecycle-Barriere;
- Capability-Gate: das geschlossene Schema und der strikte Parser akzeptieren nur kanonische JSON-Berichte, binden Live-Evidenz an Host, exakte love.js-Revision und aktuelle Session und leiten Fähigkeiten nur aus bestandenen Funktionschecks ab. Der archivierte Chromium-Bericht ist ausdrücklich nicht aktivierbar; das Scripting-Profil bleibt auch bei synthetischen Pass-Werten hart auf `evidence-pending`;
- Runtime-Manager: gültige Lifecycle-Übergänge, idempotentes Suspend/Resume, parallele `busy`-Ablehnung, Descriptor-Abgleich, ungültige Bootpfade, Verifier-Ausnahmen, Teilstart-Cleanup und Cleanup-Pflicht nach Lifecycle-Fehlern sind host-unabhängig getestet;
- love.js-Runtime-Port: Populate vor Surface-Start, Quiesce vor Flush, Flush vor Dispose, Teilstart-Cleanup, sichere Flush-Wiederholung nach Fehlern, konkurrierende `busy`-Ablehnung und Descriptor-Snapshots sind über injizierte Fakes getestet; ein konkreter Scripting-WebView-Surface-Adapter bleibt unimplementiert und ungeprüft;
- Browserbericht: [`gen1recomp/lovejs-smoke-report.json`](gen1recomp/lovejs-smoke-report.json). Der aktuelle Browser-Build ist gepinnt, aber SwiftShader liefert keinen Hardware-/Performancewert und der Lauf ist kein Scripting-/iOS-Beleg;
- ROM-freier v0.1.96-Launcher-Boot: deterministischer, bootstrap-wrapped Overlay-Payload mit 486 ZIP-Einträgen, sichtbarer 1024x768-Canvas, 10 Sekunden Beobachtung, keine Page-/Runtime-/Request-Fehler; Screenshot zeigte Launcher/Tabs/„ROM REQUIRED“, aber keinerlei ROM-Inhalt. Browser-Mausklicks auf Red/Blue/Yellow/Gold erzeugten vier unterschiedliche Canvas-Zustände mit zugeordneten Screenshot-Hashes und Pixel-Diff-Bereichen. Bericht: [`gen1recomp/lovejs-launcher-report.json`](gen1recomp/lovejs-launcher-report.json);
- Upstream-ROM-freie Quick-Suite erneut bestanden: 172 Engine-Suites, 23/23 Modkit-Suites und Cold Restart. Der erste Aufruf hatte zwar `LUA` absolut gesetzt, aber den von Modkit verschachtelt gestarteten Namen `luajit` nicht auf `PATH`; 22/23 war daher ein dokumentierter Umgebungsfehler. Mit dem gepinnten LuaJIT-Verzeichnis auf `PATH` bestand der unveränderte zweite Lauf vollständig;
- physische Scripting-/iOS-Ausführung: **nicht ausgeführt**.

## Evidenzstufen für kommende Implementierungen

| Stufe | Belegt | Belegt nicht |
|---|---|---|
| Struktur-/JSON-Prüfung | Dateien und Metadaten sind parsebar | Scripting kann das Projekt ausführen |
| TypeScript-Diagnostik | bekannte Syntax-/Typfehler fehlen | Runtime, Berechtigung oder Hostintegration |
| Unit-Test | geprüfte reine Logik verhält sich für Testfälle korrekt | native iOS-API und UI |
| Scripting-Runtime | ausgeführter Pfad funktioniert in dieser Runtime | Home Screen, Lock Screen, Shortcuts, Notification oder Safari |
| UI-/Widget-Preview | getestete Preview rendert | reale Systemdarstellung und Interaktion |
| Geräte-Host-E2E | getesteter Hostweg funktioniert auf dem Gerät | andere OS-Versionen, Geräte oder ungeprüfte Eingaben |

Keine niedrigere Stufe wird sprachlich als höhere ausgegeben.

## Noch nicht möglich

Das Gen1Recomp-Ziel ist festgelegt, aber es ist noch keine physische Scripting-App mit diesem Workspace verbunden. Daher wurden noch nicht ausgeführt:

- app-synchronisierte `.d.ts`-Diagnostik;
- Scripting-Main-Runtime oder WebView-Runtime;
- physische iPhone-/iPad-UI, Lifecycle, Input, Audio oder Persistenz;
- Gen1Recomp-Payload-Boot, Nutzer-ROM-Import, Mods, Saves oder Paritätsgoldens in Scripting;
- belastbare Performance-/Speicherbudgets.

Diese Punkte sind harte Phase-0-Gates. Sie werden nicht durch den erfolgreichen außerhalb von Scripting ausgeführten Browser-Smoke-Test oder host-unabhängige Unit-Tests ersetzt.
