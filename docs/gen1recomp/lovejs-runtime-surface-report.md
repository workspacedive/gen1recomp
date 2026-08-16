# love.js browser runtime-surface lifecycle report

- **Observed:** 2026-08-16T18:44:20.572Z
- **Scope:** outside-Scripting browser reference only
- **Machine-readable report:** [`lovejs-runtime-surface-report.json`](lovejs-runtime-surface-report.json)
- **Report SHA-256:** `e3ff051eb88990548092e35f14a5c354add5148ed68f80b793e40756e7742bdc`

## Exact inputs

- love.js revision: `9355186de22db13bd88bf2a0db75d2925647d036`;
- browser: Headless Chromium `149.0.7827.0`;
- prepared ROM-free launcher: 486 entries, 5,938,923 bytes, SHA-256 `3112c0d5a8f37f4b584a7cb62cd5d969c2bbda55a88926399d7a588f10d5677a`;
- production stack under test: compiled `LoveJsRuntimePort`, `LoveJsPersistenceAdapter`, and `BrowserLoveJsGameSurface`;
- server policy: COOP `same-origin`, COEP `require-corp`, restrictive CSP, no cache;
- browser launch: package-supplied `--disable-web-security`, `--disable-site-isolation-trials`, isolate-disabling `--disable-features`, and `--allow-running-insecure-content` flags were removed. The recorded run reported `crossOriginIsolated=true`.

The test used the deterministic ROM-free launcher only. No ROM, extracted game data, save, or mod payload was present.

## Functional result

| Operation | Result | Observation |
|---|---|---|
| runtime boot | pass | requested `gen1recomp.love` reached visible 1024×1024 canvas; adapter would reject love.js' `nogame.love` fallback |
| suspend + flush | pass | main-loop frame remained 26 before/after the 500 ms pause verification window and explicit `FS.syncfs(false)` completed |
| resume | pass | main-loop frame advanced from 26 to 56 after resume |
| stop + flush + dispose | pass | frame remained 56 and `Module.done=true` after the second explicit flush and asynchronous `Module.exit(0)`/`onexit` completion |
| browser/page/request errors | pass | no captured errors or failed requests |

This is functional evidence for the runtime port's full boot/suspend/resume/stop ordering, both explicit flush barriers, and the pinned player's exposed `Player.start`, `Module.Browser.mainLoop.pause/resume`, filesystem-ready startup, and asynchronous exit behavior in this browser. `Module.Browser` is implementation-specific love.js/Emscripten surface area, not a general LÖVE API, and remains isolated inside the adapter.

## Startup persistence correction

Source inspection showed that the pinned `love.js` factory calls `FS.syncfs(true)` and enters `Module.run` only from its callback. Therefore the pinned browser surface—not the outer runtime port—owns initial population. `LoveJsRuntimePort` now requires an explicit `startupPersistence` strategy:

- `surface` for this pinned player;
- `port` only for a future host that demonstrably exposes an initialized filesystem before game start.

This prevents a deadlock or false claim that `Module.FS` exists before the pinned player initializes it.

## Not established

The run does **not** establish:

- Scripting WebView API shape or execution;
- iOS WebKit compatibility or physical-device lifecycle deadlines;
- durable recovery after iOS suspension or termination;
- audible audio, interruption handling, touch, controller, orientation, or accessibility behavior;
- ROM import, extracted game data, save migration, mods, in-game visual parity, memory, or sustained performance.

The Scripting activation profile remains hard-blocked.
