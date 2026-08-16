# Scripting physical-device runs 001–002

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

## Attributed corrections

1. `Script` is imported from the documented `scripting` module instead of being treated as an unqualified global.
2. Browser/runtime TypeScript is bundled with pinned `esbuild@0.28.2` into one classic IIFE script. No local `type="module"`, runtime imports, or module dependency tree remains in the archive.
3. The bundle target is now Safari 13; private fields and optional chaining are transformed away.
4. A separate classic loader reports `bundle-load`, `bundle-execution`, or `bundle-timeout` and mirrors each stage to the Scripting console.
5. Both Preview and automatic Phase-0 package paths use the same correction.
6. Deterministic packaging tests assert that emitted browser bundles contain no `import`, `export`, private-field, or optional-chaining syntax.

## Replacement artifact

`Gen1Recomp Preview.scripting` version 0.1.2

- 14 entries;
- 7,598,943 bytes;
- SHA-256 `af0284b47839bc42db4a46ff1d1eb47f0ce2e7889440f8e2b24c7dc6468ed8f8`;
- exact extracted archive re-passed interactive launcher startup and controlled shutdown in Chromium 149.

The replacement has not yet run on the physical Scripting device. The next report must include the Scripting app version/build, iOS version, device family, compiler diagnostics, console lines, and generated diagnostic JSON if available.
