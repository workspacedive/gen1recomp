# Gen1Recomp Preview 0.1.3 (project identity: Gen1Recomp Preview 013)

**Status:** first interactive `.scripting` import-format build for physical-device feedback; not yet device-verified or production-ready

This build intentionally provides something runnable before the full native launcher is implemented. Version 0.1.3 uses the distinct project name `Gen1Recomp Preview 013` and runtime directory `runtime-v013` so Scripting/iCloud cannot reuse the previously imported project files or WebView URL cache.

- presents the exact deterministic ROM-free Gen1Recomp launcher in a fullscreen local WebView;
- leaves the runtime running for interaction instead of auto-closing like the Phase-0 lifecycle probe;
- forwards love.js/Lua/runtime messages to the Scripting console with a `[Gen1Recomp Preview]` prefix;
- emits structured `preview.ready`, `preview.error`, and `preview.shutdown` events;
- requests explicit filesystem flush and controlled runtime shutdown after the WebView is dismissed;
- saves a non-personal JSON event log under `FileManager.documentsDirectory/Gen1Recomp Diagnostics`;
- performs no network request and contains no ROM or extracted game data.

Native-first boundary: Scripting owns project/file resolution, presentation, lifecycle initiation, console routing, diagnostics, and eventual import/settings/save/mod UI. The WebView is restricted to the LÖVE/Lua game plane because Scripting does not expose a native LÖVE renderer. New product controls and management screens will be implemented natively wherever the documented API permits.

Expected first-device result: the Gen1Recomp game-selection launcher appears and indicates that ROM data is required. This validates local project file resolution, ES modules, WASM, WebGL, the pinned player, message bridging, console output, and controlled shutdown in the installed Scripting host. It does not yet provide ROM import, touch overlays, audio proof, saves, mods, updater, or production launcher UI.

The source uses officially documented `WebViewController`, script message handlers, `loadFile`, `waitForLoad`, `present`, `evaluateJavaScript`, `dispose`, `FileManager`, and `Script.exit`. Exact installed-app declarations and physical behavior remain the authority; any mismatch should be returned with the Scripting version and generated `.d.ts` bundle rather than patched by guesswork.

Build command:

```bash
npm install
python3 tools/prepare_lovejs_launcher.py
python3 tools/package_scripting_preview.py
```

The packager uses pinned `esbuild` to emit one classic `preview-bundle.js`. This avoids local `file://` ES-module loading, which the first physical Scripting run showed did not start in WKWebView.

Current artifact: 14 entries, 7,599,148 bytes, SHA-256 `a9f6975837b9791999da42a6c40c34c4d8ddc1a095e6fd8aff948dd756fd8862`. The exact extracted package reached the interactive launcher and completed explicit flush/shutdown in Chromium 149 without page, runtime, console, or request errors. This validates package contents, not Scripting/WebKit. See [`../../docs/gen1recomp/scripting-preview-report.json`](../../docs/gen1recomp/scripting-preview-report.json).
