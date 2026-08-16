# ROM-free love.js 11.5 smoke probe

This probe tests an isolated LÖVE web-runtime candidate outside Scripting before any Gen1Recomp payload integration. It contains no ROM, cache, save or upstream game code.

## Prepare

The runtime is intentionally not committed. Acquire the pinned repository/revision from `research/gen1recomp-lock.json`, then run:

```bash
python3 tools/prepare_lovejs_smoke.py
```

The preparer verifies five external runtime files by size/SHA-256 and creates a deterministic `smoke.love` in the ignored research tree.

## Serve

```bash
python3 tools/serve_lovejs_smoke.py --bind 0.0.0.0 --port 4173
```

The server supplies the COOP/COEP, CSP and WASM MIME headers required by this candidate. Open the page, wait for `PROBE_COMPLETE`, and retrieve the bounded local report from `/__probe_report`.

## Evidence boundary

A browser pass proves only that this pinned probe ran in that browser/environment. It does not prove:

- execution inside Scripting's WKWebView;
- audible Web Audio after user gesture;
- simultaneous touch/controller behavior;
- durable IndexedDB/Emscripten filesystem persistence;
- background/resume/context-loss recovery;
- Gen1Recomp or mod compatibility;
- frame-rate, memory or parity targets.

The same pinned bundle must later be run inside a declaration-backed Scripting WebView on a physical device and recorded separately.
