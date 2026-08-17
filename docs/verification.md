# Verifikationsprotokoll und Evidenzregeln

**Letzter Lauf:** 2026-08-16T22:48:10Z
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
- 98 Node-Unit-Tests: bestanden (Verträge einschließlich geschlossenem Runtime-Boot-Parser, JSON Schema 2020-12 einschließlich Updatekatalog, Viewport, funktionale Runtime-Evidenz, love.js-Browser-Surface, Persistenz-/Lifecycle-Port, Lifecycle-/Concurrency-Manager, Archivregeln, SemVer-Resolver, Katalog-Trust, System-Updateplanung/-orchestrierung, Mod-API-2-Manifeste, GitHub-Release-Digests/Assets, Mod-Archiv-/ROM-Ausschluss, Aktivierungsjournal und Recovery);
- 33 Python-Unit-Tests: bestanden (Acquisition-Größen/Hashes/Partials, deterministische LÖVE-, Systemkomponenten-, Phase-0-, Preview- und Native-`.scripting`-Archive, HTTP-Header/Report-Endpunkte einschließlich sicherer Player-Pfadauflösung und LuaJIT-BitOp-Shim-Parität);
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
- Capability-Gate: das geschlossene Schema und der strikte Parser akzeptieren nur kanonische JSON-Berichte, binden Live-Evidenz an Host, exakte love.js-Revision und aktuelle Session und leiten Fähigkeiten nur aus bestandenen Funktionschecks ab. Der archivierte Chromium-Bericht ist ausdrücklich nicht aktivierbar. Das Scripting-Profil modelliert den physisch beobachteten No-Worker-Pfad jetzt mit `crossOriginIsolated` und Worker-Roundtrip als erwartet unverfügbar; es bleibt bis zu Touch-/Audio-/Persistenz-/Deklarationsevidenz auf `evidence-pending`;
- Runtime-Manager: gültige Lifecycle-Übergänge, idempotentes Suspend/Resume, parallele `busy`-Ablehnung, Descriptor-Abgleich, ungültige Bootpfade, Verifier-Ausnahmen, Teilstart-Cleanup und Cleanup-Pflicht nach Lifecycle-Fehlern sind host-unabhängig getestet;
- love.js-Runtime-Port: explizite Startup-Populate-Ownership (gepinnter Player oder Port), Quiesce vor Flush, Flush vor Dispose, Teilstart-Cleanup ohne unbewiesenen FS-Zugriff, sichere Flush-Wiederholung nach Fehlern, konkurrierende `busy`-Ablehnung und Descriptor-Snapshots sind über injizierte Fakes getestet;
- Browser-Surface: der kompilierte Stack aus Runtime-Port, Persistence-Adapter und Browser-Surface startete den exakten ROM-freien Launcher statt des `nogame.love`-Fallbacks, hielt den Main-Loop bei Frame 26 für das 500-ms-Prüffenster an, absolvierte den Suspend-Flush, setzte ihn bis Frame 56 fort und beendete nach Stop-Flush mit unverändertem Frame/`Module.done=true`; keine Page-, Request- oder Runtime-Fehler. Chromium 149 lief mit `crossOriginIsolated=true`, nachdem unsichere package-seitige Security-Disable-Flags explizit entfernt wurden. Bericht: [`gen1recomp/lovejs-runtime-surface-report.md`](gen1recomp/lovejs-runtime-surface-report.md);
- Scripting-Phase-0-Paket: dokumentierter `Script`-Import, Safari-13-Bundle, diagnostischer Loader und eingebettete Player-Pakete; deterministisches ROM-freies Archiv mit 11 Einträgen, 8.262.935 Bytes und SHA-256 `bddcb53a…`; die exakt extrahierte Runtime bestand in Chromium Boot, Suspend-Flush (Frame 46 stabil), Resume (Frame 76) und Stop-Flush/Dispose ohne Fehler, ohne HTTP-Anfragen für Payload/Lua/WASM;
- Interaktive Scripting-Preview 0.1.4 (`Gen1Recomp Preview 014`): die Geräteberichte belegten nacheinander fehlenden `Script`-Import, nicht gestartete ES-Module, wiederverwendete Altdateien und schließlich vier gescheiterte lokale Player-Fetches. Die eindeutige 0.1.4-Identität lädt ein Safari-13-Bundle und vier hashgeprüfte eingebettete Pakete. Das deterministische ROM-freie Archiv hat 11 Einträge, 8.263.309 Bytes und SHA-256 `70a2cb7f…`; außerhalb Scripting bestand es Start und Flush. Auf physischem iPhone/iOS 18.7 erreichte es mit `crossOriginIsolated=false` den sichtbaren 1024 × 768 Launcher bei Frame 2 ohne Startupfehler. Der danach beobachtete `Script error` ist dem post-dismiss JavaScript-Aufruf zugeordnet; Produktions-Flush vor Dismiss bleibt offen;
- Der lokale Scripting-WebView-Startpfad ist physisch belegt; ein vollständiger app-synchronisiert deklarationsgeprüfter Surface-/Lifecycle-Adapter mit Touch, Audio, Save und Pre-Dismiss-Flush bleibt offen;
- Manueller System-Updater: geschlossener Katalog/Trust, individuelle/aggregierte Planung, Dependency-first-Aktivierungsset, API-Kompatibilität, Abbruch, `busy`, Paketfehler, Self-Test, Health-Check, Commit und Rollback sind host-unabhängig getestet. Der sequenzierte Stable-Katalog und zwei ROM-freie aktuelle Komponenten-ZIPs sind deterministisch und per Größe/SHA-256/Allowlist geprüft;
- Native Scripting 0.2.0 (`Gen1Recomp Native 020`): 23 Einträge, 8.288.985 Bytes, SHA-256 `b50cde29…`; der dokumentationsbasierte Typecheck und Chromium-Runtime bestanden. Physisch startete der Nutzer die Runtime über die native Settings-Aktion; alle Pakete dekodierten und `ready frame 21` wurde ohne Startupfehler erreicht. Systemupdate/App-Group-Durability blieben ungetestet; Bericht: [`gen1recomp/scripting-native-020-report.json`](gen1recomp/scripting-native-020-report.json);
- Native Scripting 0.3.0 (`Gen1Recomp Native 030`): 25 Einträge, 8.300.856 Bytes, SHA-256 `6d6700c0…`; fünf native Tabs, vertrauensgebundener manueller Komponentenimport, Datei-/GitHub-Modinstallation, manuelle Einzel-/Sammelupdates, Registry-Backup und inaktive Permission-Anzeige bestanden den Deklarationssubset-Typecheck. Die exakte Runtime erreichte in Chromium 149 Frame 23 und schloss ohne Console-/Page-/Requestfehler; native Datei-/GitHub-Wege sind offen. Bericht: [`gen1recomp/scripting-native-030-report.json`](gen1recomp/scripting-native-030-report.json);
- Native Scripting 0.4.0 (`Gen1Recomp Native 040`): 32 Einträge, 8.320.470 Bytes, SHA-256 `2d6ae25c…`; exakte ROM-Größe/SHA-1, strikte private Game-Registry/Recovery, Pending-Source, In-Memory-Handoff, upstream Import-/Direktstartgrenze, v10-Cacheprüfung, native Karten, Save-Metadaten und selektive Cachelöschung sind implementiert. Beide TypeScript-Ziele, 104/104 Node-Tests und 30/30 ausgeführte Python-Tests bestanden (3 umgebungsbedingt übersprungen), npm audit meldete 0 Schwachstellen. Physisch akzeptierte Scripting 3.2.0 auf iPhone 16 Pro Max/iOS 26.6 die kanonische Yellow-ROM, registrierte sie privat, behielt den Pending-Import über drei reselektionsfreie Versuche und erreichte den Upstream-Importer (Frames 17/2/2). Dort scheiterte `Rom.decompressPic` exakt an der im PUC-Lua-Adapter fehlenden LuaJIT-Globalen `_G.bit`; vollständige Extraktion blieb aus. Bericht: [`gen1recomp/scripting-native-040-report.json`](gen1recomp/scripting-native-040-report.json) und Run 007 in [`gen1recomp/scripting-device-run-001.md`](gen1recomp/scripting-device-run-001.md);
- Native Scripting 0.4.1 (`Gen1Recomp Native 041`): 32 Einträge, 8.320.895 Bytes, SHA-256 `15cd150c…`; installierte den bestehenden BitOp-Shim als `_G.bit`, ohne Coreänderung. Physisch trat der vorherige `global 'bit'`-Fehler nicht mehr auf; Payload `a8a370be…` erreichte Frame 1. love.js zeigte danach jedoch nur einen generischen Pre-Window-Alert, während die zugrunde liegende WebView-Consoleursache nicht im Scripting-Log ankam. Die Karte blieb korrekt pending. Bericht: [`gen1recomp/scripting-native-041-report.json`](gen1recomp/scripting-native-041-report.json);
- Native Scripting 0.4.2 (`Gen1Recomp Native 042`): 32 Einträge, 8.321.442 Bytes, SHA-256 `b111e878…`; physisch leitete der neue Diagnosekanal den vollständigen Fortschritt weiter: 223 Maps/151 Spezies/165 Moves generiert, Game geladen, Display 1024×768/Scale 5 gesetzt. Danach wurde der Fehler exakt als `Queueable Sources can not be looped.` attribuiert. Bericht: [`gen1recomp/scripting-native-042-report.json`](gen1recomp/scripting-native-042-report.json);
- Native Scripting 0.4.3 (`Gen1Recomp Native 043`): 32 Einträge, 8.322.151 Bytes, SHA-256 `24289a69…`; der Queue-Guard bestand den gepinnten love.js-Probe. Physisch erreichte Yellow Titel/Intro, Musik war sofort hörbar, und weder Queue-Fehler noch generisches Modal kehrten zurück. On-Screen-Touchsteuerung fehlte, weil love.js als OS `Web` meldet. Bericht: [`gen1recomp/scripting-native-043-report.json`](gen1recomp/scripting-native-043-report.json);
- Native Scripting 0.4.4 (`Gen1Recomp Native 044`): physisch sichtbare Upstream-Controls und gewöhnliches Touch-Spiel bis in Oaks Labor; dabei blieben Darstellung/Controls zu klein, starkes Stottern sichtbar und `t.__type__` vor dem erfolgreichen Runtime-Start bestehen. Bericht: [`gen1recomp/scripting-native-044-report.json`](gen1recomp/scripting-native-044-report.json);
- Native Scripting 0.4.5 (`Gen1Recomp Native 045`): physisch `1×1 CSS -> 640×640 Canvas -> 440×440 CSS`; damit ist der zu frühe Pre-Presentation-Viewport exakt belegt. Elf Messfenster belegten schwere Stalls (stabile p95 67–105 ms, bis 52 Abstände >50 ms/10 s, Maximum 2.968 s). Der Long-Task-Observer lieferte trotz dieser RAF-Lücken null Einträge. Bericht: [`gen1recomp/scripting-native-045-report.json`](gen1recomp/scripting-native-045-report.json);
- Native Scripting 0.4.6 (`Gen1Recomp Native 046`): 32 Einträge, 8.328.280 Bytes, SHA-256 `82ff76ce…`; Bundle-/LÖVE-Start wartet auf 250 ms stabilen sichtbaren Viewport. Der No-Worker-Musikpfad behält 44,1 kHz/ChipSynth bei, teilt aber 8192-Sample-Blöcke in 1024er-Slices und begrenzt den Fill auf einen Slice je Update; direkte Musik-/Effekt-CPU-Telemetrie ist enthalten. 109 Node-Tests einschließlich simulierter `1×1 -> 440×900`-Präsentation bestanden; physische Korrektur bleibt offen. Bericht: [`gen1recomp/scripting-native-046-report.json`](gen1recomp/scripting-native-046-report.json);
- PotatoVoxel wurde ausschließlich extern im ignorierten Research-Baum an Revision `d4785ff…`/Release 1.7.4 untersucht. Manifest, GitHub-Asset-Digest, Berechtigungen, Konflikte, scoped Cache und fehlende Lizenz wurden dokumentiert; kein fremder Code/Asset gelangte in Produkt oder Tests. Der offizielle Release-Binarytransfer war sandboxseitig blockiert, Quellcheckout/API-Metadaten waren verfügbar; Audit: [`research/potato-voxel-mod-audit.md`](research/potato-voxel-mod-audit.md);
- Browser-Smoke-Bericht: [`gen1recomp/lovejs-smoke-report.json`](gen1recomp/lovejs-smoke-report.json). Der aktuelle Browser-Build ist gepinnt, aber SwiftShader liefert keinen Hardware-/Performancewert und der Lauf ist kein Scripting-/iOS-Beleg;
- ROM-freier v0.1.96-Launcher-Boot: deterministischer, bootstrap-wrapped Overlay-Payload mit 486 ZIP-Einträgen, sichtbarer 1024x768-Canvas, 10 Sekunden Beobachtung, keine Page-/Runtime-/Request-Fehler; Screenshot zeigte Launcher/Tabs/„ROM REQUIRED“, aber keinerlei ROM-Inhalt. Browser-Mausklicks auf Red/Blue/Yellow/Gold erzeugten vier unterschiedliche Canvas-Zustände mit zugeordneten Screenshot-Hashes und Pixel-Diff-Bereichen. Bericht: [`gen1recomp/lovejs-launcher-report.json`](gen1recomp/lovejs-launcher-report.json);
- Upstream-ROM-freie Quick-Suite erneut bestanden: 172 Engine-Suites, 23/23 Modkit-Suites und Cold Restart. Der erste Aufruf hatte zwar `LUA` absolut gesetzt, aber den von Modkit verschachtelt gestarteten Namen `luajit` nicht auf `PATH`; 22/23 war daher ein dokumentierter Umgebungsfehler. Mit dem gepinnten LuaJIT-Verzeichnis auf `PATH` bestand der unveränderte zweite Lauf vollständig;
- physische Scripting-/iOS-Ausführung: Preview 0.1.4 und Native-0.2.0-Settings→Runtime-Startup **bestanden** auf iPhone/iOS 18.7; Native 0.3.0 Datei-/GitHub-/Modpfade sowie Native 0.4.0 Import/Extraktion/Bibliothek/Spielpfade **noch nicht ausgeführt**.

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

## Offene reale Gates

Eine physische Scripting-App hat Preview 0.1.4 ausgeführt, ist aber nicht per `scripting-cli` mit diesem Workspace verbunden. Offen bleiben:

- app-synchronisierte `.d.ts`-Diagnostik und genaue Scripting-App-Version/Buildnummer;
- Native-0.4.0-Fünf-Tab-TSX und adaptive Game Cards auf iPhone/iPad einschließlich Dark Mode, Dynamic Type und VoiceOver;
- DocumentPicker-ROM-/Komponenten-/Modimport, Crypto.sha1, GitHub API/Release-Asset-Redirect, App-Group-Registry/Persistenz, Unterbrechungs-Recovery und materialisierte Runtime auf dem Gerät;
- periodischer/Visibility/Pagehide-/Exit-Flush und Save-Dauerhaftigkeit unter realen Dismiss-/Hintergrund-/Abbruchsequenzen;
- Nutzer-ROM-Identität/Extraktion, vollständiger privater Cache, direkter Spielstart, Save-Discovery/Management, Mods und reale Spielparitätsgoldens;
- hörbare Audio-, simultane Touch-, Lifecycle-, Performance- und Speicherbudgets.

Der bestandene Runtime-Start ersetzt keinen dieser spezifischen Nachweise. Ebenso ersetzen Browser- und Unit-Tests keine native TSX-, Berechtigungs- oder Dateisystemprüfung.
