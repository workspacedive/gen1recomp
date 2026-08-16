# Scripting physical-device runs 001–004

- **Evidence level:** user-reported installed Scripting host on a physical iOS device
- **App/iOS/device versions:** not yet supplied
- **Artifact:** Gen1Recomp Preview 0.1.0, SHA-256 `0804a7651bc0f506abd4932d81ef9d4ac4cff2dd2541994a628198b0f99369e5`

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

## Replacement artifact

`Gen1Recomp Preview 014.scripting` version 0.1.4

- new project identity `Gen1Recomp Preview 014`;
- new runtime URL root `runtime-v014`;
- 11 entries;
- 8,263,309 bytes;
- SHA-256 `70a2cb7febc106f42c5bfbba55636879c560bd24b438ba03871cfcec02242184`;
- exact extracted archive re-passed interactive launcher startup and controlled shutdown in Chromium 149.

The replacement has not yet run on the physical Scripting device. The next report must include the Scripting app version/build, iOS version, device family, compiler diagnostics, console lines, and generated diagnostic JSON if available.
