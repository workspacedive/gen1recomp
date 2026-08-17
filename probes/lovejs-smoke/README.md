# ROM-free love.js 11.5 smoke probe

This probe tests an isolated LÖVE web-runtime candidate outside Scripting before any Gen1Recomp payload integration. It contains no ROM, cache, save or upstream game code.

## Prepare

The runtime is intentionally not committed. Acquire the pinned repository/revision from `research/gen1recomp-lock.json`, then run:

```bash
python3 tools/prepare_lovejs_smoke.py
```

The preparer verifies five external runtime files by size/SHA-256 and creates a deterministic `smoke.love` in the ignored research tree. The archive includes `compatibility/love-web/bit.lua` as a root-level overlay because the first unmodified runtime execution proved that love.js does not provide Gen1Recomp's required LuaJIT BitOp module.

## Serve

```bash
python3 tools/serve_lovejs_smoke.py --bind 0.0.0.0 --port 4173
```

The server supplies the COOP/COEP, CSP and WASM MIME headers required by this candidate. Open the page, wait for `PROBE_COMPLETE`, and retrieve the bounded local report from `/__probe_report`.

## Evidence boundary

The recorded Headless Chromium 149/SwiftShader run passed 23/23 checks after the BitOp overlay; see `docs/gen1recomp/lovejs-smoke-report.json`. A browser pass proves only that this pinned probe ran in that browser/environment. It does not prove:

- execution inside Scripting's WKWebView;
- audible Web Audio after user gesture;
- simultaneous touch/controller behavior;
- durable IndexedDB/Emscripten filesystem persistence under Scripting termination (browser reload requires settling or explicit sync);
- working `love.thread.newThread` workers (creation was detected as unavailable) or complete no-thread fallback parity;
- background/resume/context-loss recovery;
- Gen1Recomp game or mod compatibility (only the separate ROM-free launcher shell has booted);
- frame-rate, memory or parity targets.

The same pinned bundle must later be run inside a declaration-backed Scripting WebView on a physical device and recorded separately.
