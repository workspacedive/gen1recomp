# Gen1Recomp Phase 0 Scripting package

**Status:** deterministic `.scripting` import-format probe; device import not yet verified; not the game application

## Done specification

Host: finite in-app Scripting script presenting a fullscreen `WebViewController`.

Input/data access:

- reads only files bundled in this imported Scripting project;
- contains the deterministic ROM-free Gen1Recomp launcher, never a ROM or extracted cache;
- performs no network requests, uploads, clipboard access, health access, or location access;
- writes one non-personal JSON result under `FileManager.documentsDirectory/Gen1Recomp Diagnostics` after a completed run;
- uses the WebView's persistent website data only to test the pinned love.js filesystem lifecycle.

Behavior:

1. resolve the imported project under `FileManager.scriptsDirectory`;
2. register one validated WebView message channel;
3. call `loadFile` with read access restricted to the bundled runtime directory;
4. run the compiled love.js runtime/persistence/browser-surface stack;
5. report boot, suspend/flush, resume, stop/flush, and disposal results;
6. dispose the controller and call `Script.exit()` on every completion path.

Acceptance criteria:

- archive structure and metadata validate;
- no ROM-derived paths/content are present;
- exact love.js and ROM-free payload hashes are injected by the deterministic packager;
- all browser-side source and host-independent tests pass;
- installed Scripting project loads its local module/WASM/player files;
- a physical device returns an attributed report instead of a blank or silently substituted `nogame.love` page.

## Evidence boundary

The implementation uses officially documented `WebViewController`, `FileManager.scriptsDirectory`, `FileManager.exists`, script-message handling, `loadFile`, `waitForLoad`, `present`, `dispose`, and `Script.exit`. Exact installed-app `.d.ts` diagnostics and physical execution are still mandatory. Until they pass, this package is a Phase-0 probe and must not be described as an operational Gen1Recomp app.

The deterministic packager writes the ignored deliverable with:

```bash
npm install
python3 tools/prepare_lovejs_launcher.py
python3 tools/package_scripting_phase0_probe.py
```

The browser/runtime code is bundled into one classic script because the first physical Scripting run showed that local ES modules did not start in the WKWebView file-loading path.

The current package is 7,597,422 bytes with 13 entries and SHA-256 `3d9fc937ff2fb9a56529f92e0e74dccfad1e68e050b790de09c9502b907ed12d`. Its exact extracted runtime passed the full lifecycle in Chromium 149, which validates packaging and relative resource resolution but not Scripting/WebKit. See [`../../docs/gen1recomp/scripting-phase0-package-report.json`](../../docs/gen1recomp/scripting-phase0-package-report.json).

The final product additionally requires native launcher/import/save/mod/settings UI, physical input/audio/persistence/lifecycle measurements, a user-supplied ROM import path, title/game parity, accessibility, diagnostics, staged updates, and rollback.
