# love.js runtime-surface lifecycle probe

This developer probe executes the compiled `BrowserLoveJsGameSurface` against the exact pinned love.js player and deterministic ROM-free Gen1Recomp launcher payload. It is not a Scripting or physical-iOS test.

Prerequisites:

```bash
npm run build:contracts
python3 tools/prepare_lovejs_launcher.py
python3 tools/serve_lovejs_surface_probe.py --bind 127.0.0.1 --port 4174
```

The page at `/probes/lovejs-runtime-surface/index.html` loads `player.js` with `g=norun`, then runs `LoveJsRuntimePort` with the production browser surface and serialized persistence adapter against `gen1recomp.love`. It functionally verifies:

- startup reaches the requested payload rather than love.js' `nogame.love` fallback;
- the canvas is visible, Emscripten FS exists, and the main loop is installed;
- `Module.Browser.mainLoop.pause()` stops frame advancement;
- the runtime port's explicit `FS.syncfs(false)` suspend/stop barriers complete;
- `resume()` restarts frame advancement;
- controlled stop reaches the asynchronous `Module.exit(0)`/`onexit` callback.

The harness depends on compiled `.tmp/ts` modules and ignored pinned downloads, so neither generated JavaScript nor payload artifacts are committed. The isolated local server exposes only an explicit probe/runtime-file allowlist (not the repository), supplies COOP/COEP/CSP headers, and captures a bounded `/__probe_report` result. Success demonstrates only this exact outside-browser stack; it does not establish WebKit/Scripting availability, lifecycle deadlines, audio, touch, controller behavior, ROM import, saves, mods, or in-game parity.
