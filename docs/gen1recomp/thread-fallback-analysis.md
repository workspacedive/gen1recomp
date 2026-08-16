# love.js Worker-Thread Fallback Analysis

**Date:** 2026-08-16
**Runtime:** pinned 2dengine love.js `9355186de22db13bd88bf2a0db75d2925647d036`
**Finding:** `love.thread.newThread` exists but worker construction fails; capability must be behavioral, not symbol-based

## Measured failure

The ROM-free browser probe successfully used main-state Channels, then attempted to construct `worker.lua`. love.js failed in its normalization layer:

```text
/usr/local/share/lua/5.1/normalize1.lua:87:
bad argument #2 to '_lfs_newFile' (string expected, got nil)
```

This failure persisted in isolated Headless Chromium 149 with `crossOriginIsolated=true` and `SharedArrayBuffer` available. It is therefore not resolved merely by supplying COOP/COEP headers in this candidate.

## Host compatibility normalization

`compatibility/love-web/bootstrap.lua` hides only `love.thread.newThread` before upstream `main.lua` loads. `love.thread.getChannel` remains available because its same-state push/pop roundtrip passed.

`tools/prepare_lovejs_launcher.py` now:

1. creates a deterministic ROM-free payload from the pinned v0.1.96 source;
2. preserves upstream `main.lua` as `gen1recomp-main.lua`;
3. adds a generated root `main.lua` host wrapper;
4. installs the thread capability normalization and BitOp overlay;
5. executes the untouched upstream main chunk.

No Gen1Recomp or LÖVE source file is patched.

## Upstream fallback mapping

| Subsystem | Upstream behavior when `newThread` is absent | Characterization |
|---|---|---|
| `src.net.Fetch` | returns an immediate error job with `background threads unavailable`; never remains pending | direct Lua test passed |
| `src.update.Check` | state becomes `error` with `background threads unavailable` | direct Lua test passed |
| `src.mods.Job` | `available()` is false and `run()` returns `background jobs are unavailable` | direct Lua test passed |
| `src.import.RomImporter` | `_startExtractThread` returns false and import uses the incremental coroutine extractor | source gate/call-path assertion passed; ROM execution intentionally not run |
| `src.core.ChipAudio` | uses synchronous amortized queue fill (`MUSIC_FILL_INITIAL=4`, `MUSIC_FILL_PER_CALL=3`) | upstream sync/threaded fanfare characterization passed |
| host spawn lock | runs plain when no thread lock exists | covered by existing upstream ROM-free suite |

The mod capability broker must report `background:compute` unavailable for this runtime. Network and updates should move to coarse HostProtocol brokers rather than trying to revive love.js workers.

## Regression evidence

- `tests/compatibility/thread_fallback_test.lua` exercises Fetch, Update and Mod Job soft failures after bootstrap normalization and asserts the ROM importer coroutine gate.
- `tests/tools/test_thread_fallback.py` runs that characterization plus upstream `tests/engine/fanfare_music_hold.lua`'s synchronous audio scenario.
- The full upstream ROM-free quick suite passes when the pinned built LuaJIT directory is present on `PATH`: 172 engine suites, 23/23 Modkit suites and cold restart.
- A first quick invocation omitted that `PATH` entry and caused Modkit's nested `luajit` process to be unavailable; rerunning with the correct pinned path passed. This was an environment error, not a source regression.
- The deterministically repackaged, bootstrap-wrapped ROM-free launcher boots in isolated Chromium 149 at 1024×768 with no page/runtime/request errors.

## Remaining risk

Synchronous chip synthesis may create frame-time pressure, coroutine ROM extraction may take longer, and worker-only mod jobs remain unavailable. No performance target is claimed. These paths require measurement in Scripting on a physical device; optimization is prohibited until those measurements exist.
