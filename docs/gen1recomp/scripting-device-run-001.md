# Scripting physical-device runs 001–007

- **Evidence level:** user-reported installed Scripting host on a physical iOS device
- **Scripting app version/build:** not yet supplied
- **OS/device:** iOS 18.7 on iPhone; exact model not yet supplied
- **Artifacts:** Preview lineage 0.1.0–0.1.4; current physical pass is Preview 0.1.4, SHA-256 `70a2cb7febc106f42c5bfbba55636879c560bd24b438ba03871cfcec02242184`

## Observed

- Scripting diagnostic: `/index.tsx` line 118 — `Cannot find name 'Script'`.
- `FileManager.scriptsDirectory` resolved the imported project correctly.
- `WebViewController.loadFile` and modal presentation succeeded.
- The local ES-module entry did not execute within eight seconds.
- The native console/message bridge itself worked and received the module-load error event.
- Shutdown evaluation then produced `Script error`, as expected because the runtime module had never installed the shutdown bridge.

## Run 002

Artifact: Preview 0.1.1, SHA-256 `fac9ae156a6125f7af6f1257233236edf3d80d0cb2322325b31940e67b08c959`.

The first classic-bundle replacement removed the `Script` diagnostic, but the bundle still did not set its startup marker. Its ES2022 output contained JavaScript private fields and optional chaining, so classic-vs-module loading alone was not sufficient. The previous timeout could not distinguish resource loading from parser/execution failure.

## Run 003

The next submitted log still contained the exact removed strings `module-load` and `The local preview module did not start`. Those literals are absent from the 0.1.2 archive, proving that Scripting/iCloud continued to execute the previously imported project tree or WebView URL cache rather than the replacement files.

## Run 004

Preview 0.1.3 proved that the unique project path, classic loader, downleveled bundle, native bridge, and runtime entry all execute. The pinned player then emitted four immediate `TypeError: Load failed` errors before entering its error state. These map exactly to its four `fetch` requests for `gen1recomp.love`, `normalize1.lua`, `normalize2.lua`, and `love.wasm`; Scripting WKWebView permits local classic scripts but rejects these local-file fetches.

## Run 005 — Preview 0.1.4 physical pass

The user-installed Preview 0.1.4 reached `preview.ready` at frame 2 on iPhone/iOS 18.7 with a visible 1024 × 768 surface. The device log confirmed the intended `0.1.4 / 014` host/runtime identity, embedded package adapter, exact decoded payload/Lua/WASM byte lengths, classic bundle execution, LÖVE/Lua startup, and `crossOriginIsolated: false`. No local fetch failure or startup `TypeError` remained.

The only observed error occurred after dismissal: the host logged `preview dismissed; requesting runtime flush and shutdown` and then `Script error.` The host had already lost a usable page before evaluating the shutdown bridge. This is a close/flush sequencing defect, not a runtime-start defect. The native 0.2.0 shell does not repeat post-dismiss JavaScript evaluation; save-bearing gameplay remains blocked until a pre-dismiss flush handshake is physically validated.

## Run 006 — Native 0.2.0 diagnostic pass

The user launched `Gen1Recomp Native 020`, reached its native Settings action, and started the packaged runtime diagnostic. The device log confirmed the exact `0.2.0 / 020` identity, pinned love.js revision/payload, all four embedded resources at expected byte lengths, classic bundle execution and `ready frame 21` without startup errors.

This proves the Native 0.2.0 TSX host was sufficiently functional to present and invoke the Settings action and that its WebView adapter preserved the validated runtime path. No screenshot, system-update request, App Group interruption test, dismissal log or iPad evidence was supplied, so those remain separate. Native 0.3.0 adds manual component ZIP and file/GitHub mod management and requires a fresh run.

## Run 007 — Native 0.4.0 canonical Yellow import reaches extractor, then fails at global BitOp

Environment supplied by the user: **Scripting 3.2.0**, **iOS 26.6**, **iPhone 16 Pro Max**. The user selected their renamed `.txt` cartridge file through DocumentPicker; Native 0.4.0 accepted it as canonical Pokémon Yellow, which proves the device-side exact 1 MiB/SHA-1 gate passed. The native Games card persisted Yellow with digest prefix `cc7d0326…` and `Import abschließen`, proving private registration and pending-source retry survived runtime dismissal without another picker.

Three runtime attempts reached the exact Native 0.4.0 identity and embedded payload. Reported ready frames were 17, 2, and 2. The upstream Yellow launcher then showed:

```text
Import failed
src/import/Rom.lua:198: attempt to index global 'bit' (a nil value)
```

Attribution is exact: `Rom.decompressPic` uses LuaJIT's global `bit.bxor`; the love.js PUC-Lua overlay supplied a parity-tested `require("bit")` module but did not install the LuaJIT-compatible global. This is a host-adapter defect, not a bad ROM, extractor/core algorithm defect, or emulator issue. Native 0.4.1 corrects `compatibility/love-web/bootstrap.lua` to install the same tested module into `_G.bit` before upstream main loads. No upstream core file is changed.

One Scripting console event at 01:43:55 also reported `Failed to build component. TypeError: undefined is not an object (evaluating 't.__type__')`. The native screen subsequently rendered and remained actionable, so it is tracked as a separate intermittent UI-build observation rather than attributed to extraction. Native 0.4.1 also moves the card status to its own row to reduce the severe text compression visible in the supplied screenshot. A clean 0.4.1 run must confirm whether the component error recurs.

This run proves DocumentPicker access, native canonical Yellow identity, private pending registration, retry without reselection, in-memory WebView handoff, and upstream importer entry on the specified device. It does **not** prove completed extraction, cache persistence, direct game boot, saves, audio, input, or fidelity.

## Attributed corrections

1. `Script` is imported from the documented `scripting` module instead of being treated as an unqualified global.
2. Browser/runtime TypeScript is bundled with pinned `esbuild@0.28.2` into one classic IIFE script. No local `type="module"`, runtime imports, or module dependency tree remains in the archive.
3. The bundle target is now Safari 13; private fields and optional chaining are transformed away.
4. A separate classic loader reports `bundle-load`, `bundle-execution`, or `bundle-timeout` and mirrors each stage to the Scripting console.
5. Preview 0.1.3 proved cache isolation through `Gen1Recomp Preview 013` and `runtime-v013`.
6. Preview 0.1.4 uses another distinct project/runtime identity and embeds the exact payload, both Lua normalizers, and WASM as deterministic base64 classic-script data. The player package loader is replaced before boot, so it performs no `fetch(file://…)` calls.
7. Decoded package byte lengths are logged and the base64 strings are released after use to reduce retained memory.
8. Both Preview and automatic Phase-0 package paths use the same embedded-package and diagnostic-loader correction.
9. Deterministic packaging tests assert that emitted browser bundles contain no `import`, `export`, private-field, or optional-chaining syntax and that all four embedded package keys are present.
10. Native 0.4.1 installs the parity-tested `bit` compatibility module into `_G.bit` before upstream main loads, matching the LuaJIT global used by ROM picture extraction and several Gen 2 paths.

## Replacement artifact

`Gen1Recomp Preview 014.scripting` version 0.1.4

- new project identity `Gen1Recomp Preview 014`;
- new runtime URL root `runtime-v014`;
- 11 entries;
- 8,263,309 bytes;
- SHA-256 `70a2cb7febc106f42c5bfbba55636879c560bd24b438ba03871cfcec02242184`;
- exact extracted archive re-passed interactive launcher startup and controlled shutdown in Chromium 149.

The replacement passed physical startup as Run 005. The next device report should identify the Scripting app version/build and exact iPhone model.

Native 0.2.0's Settings-to-runtime diagnostic passed as Run 006. Native 0.4.0 Run 007 reached canonical Yellow extraction and exposed the corrected global-BitOp adapter defect. Native 0.4.1 is the immediate regression candidate. Completed extraction, App Group relaunch durability, direct boot, saves, input/audio/fidelity, manual system catalog/package installation, and updated-generation materialization remain untested. Native 0.3.0's component/mod/GitHub operations also still require physical validation.
