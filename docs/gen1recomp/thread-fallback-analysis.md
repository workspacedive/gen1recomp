# love.js Worker-Thread Fallback Analysis

**Date:** 2026-08-17

**Runtime:** pinned 2dengine love.js `9355186de22db13bd88bf2a0db75d2925647d036`
**Finding:** `love.thread.newThread` exists but worker construction fails; capability and performance must be measured behaviorally

## Measured worker failure

The ROM-free browser probe successfully used main-state Channels, then attempted to construct `worker.lua`. love.js failed in its normalization layer:

```text
/usr/local/share/lua/5.1/normalize1.lua:87:
bad argument #2 to '_lfs_newFile' (string expected, got nil)
```

This failure persisted in isolated Headless Chromium 149 with `crossOriginIsolated=true` and `SharedArrayBuffer` available. It is not resolved merely by supplying COOP/COEP headers in this candidate.

## Host compatibility normalization

`compatibility/love-web/bootstrap.lua` hides only `love.thread.newThread` before upstream `main.lua` loads. `love.thread.getChannel` remains available because its same-state push/pop roundtrip passed.

`tools/prepare_lovejs_launcher.py`:

1. creates a deterministic ROM-free payload from pinned v0.1.96 source;
2. preserves upstream `main.lua` and `conf.lua` under host-reserved names;
3. adds generated root wrappers for capability and visible-viewport configuration;
4. installs BitOp, queue-loop and no-worker audio adapters;
5. applies one explicit two-line integration seam in `ChipAudio.lua`, making the existing fill constants read optional `ChipSynth` host fields before retaining upstream defaults;
6. executes the original upstream main chunk.

LÖVE/love.js source, ChipSynth sample generation, game timing and renderer code are unchanged. The ChipAudio seam is recorded in the payload manifest and fails packaging if the pinned upstream lines differ.

## Upstream fallback mapping

| Subsystem | Behavior when `newThread` is absent | Characterization |
|---|---|---|
| `src.net.Fetch` | immediate `background threads unavailable` error job | direct Lua test passed |
| `src.update.Check` | state becomes `error` with that reason | direct Lua test passed |
| `src.mods.Job` | unavailable and returns the same reason | direct Lua test passed |
| `src.import.RomImporter` | incremental coroutine extraction | source gate/call-path assertion passed |
| `src.core.ChipAudio` | synchronous queue fill on the render thread | physically measured below |
| host spawn lock | runs plain when no thread lock exists | upstream ROM-free coverage |

The mod capability broker reports `background:compute` unavailable. Network and updates use HostProtocol brokers rather than pretending love.js workers function.

## Native 0.4.5 physical timing

On iPhone 16 Pro Max / iOS 26.6 / Scripting 3.2.0, eleven RAF windows measured severe starvation while Yellow remained playable:

- representative steady p95 intervals: 67, 75, 81, 91, 96 and 105 ms;
- 26–52 intervals over 50 ms per ten seconds in several steady windows;
- worst measured maximum: 2968 ms;
- a gameplay window produced 153 frames in 10.044 seconds, p95 144 ms, p99 1350 ms and maximum 2300 ms.

The browser accepted a Long Tasks observer but emitted zero entries despite multi-second RAF gaps, so that API is not used for attribution in this WebView.

The steady 4–5 severe gaps per second closely match queue drain for 8192 samples at 44.1 kHz: `44100 / 8192 = 5.38` synchronous synthesis calls per second. This is stronger than symptom-only speculation but remains a cadence correlation; Native 0.4.6 adds direct CPU timing around the exact synth call.

## Bounded no-worker scheduling in Native 0.4.6

`compatibility/love-web/audio.lua` is activated only by the Scripting game-session environment. It preserves:

- 44.1 kHz sample rate and 16-bit stereo output;
- the same ChipSynth channel programs and per-sample algorithm;
- the same mutable engine continuing sequentially across blocks;
- upstream music playback and QueueableSource transport.

It changes scheduling geometry:

| Setting | Previous | Native 0.4.6 |
|---|---:|---:|
| samples per SoundData hand-off | 8192 | 1024 |
| queue buffers | 32 | 128 |
| initial slices | 4 | 4 |
| maximum slices per update | 3 | 1 |
| nominal full queue | 5.94 s | 2.97 s |

One steady hand-off therefore contains one eighth of the prior sample work. Aggregate music calls/samples/CPU/max and every newly rendered one-shot effect's samples/CPU are logged as `[host-perf]` lines. This permits separate follow-up for cached SFX/cries if music slicing removes periodic stalls but action-specific hitches remain.

Physical Native 0.4.6 kept audio continuous and materially improved motion. Three late windows reached p95 23–25 ms, maxima 31–37 ms and no gaps over 50 ms. Direct logs measured 1024-sample calls at 7–23 ms and aggregate music CPU at 632–2918 ms per five seconds. First-use effects independently reached 106–412 ms; 223/267/250 ms effect calls aligned with nearby 236/278/262 ms RAF maxima.

## Even scheduling and private effect reuse in Native 0.4.7

Native 0.4.7 uses 512-sample blocks, 256 queue buffers and at most two fills per update. Queue duration and maximum samples generated by one update remain 2.97 seconds and 1024 respectively, but approximately 86 smaller calls per second distribute average synthesis across nearly every 60 Hz frame instead of alternating about 43 heavy and 17 light frames.

First-use `SoundData` is also encoded as PCM WAV beneath `<game>/audio-render-cache-gen1recomp-0.1.96-chip-v1`. A sidecar stores the complete canonical signature: game/ABI namespace, audio generation/program file, full header/options, mix/pitch and stereo state. A hashed filename is never sufficient by itself; sidecar equality and successful decode are mandatory. Corruption or changed definitions fall back to synthesis. Existing periodic IDBFS flush persists entries, and selective game removal deletes the entire containing game prefix. Rendered audio stays private and is excluded from artifacts and Git.

The first encounter still performs synchronous synthesis; the cache improves later sessions. Update/draw callback CPU is now logged separately from music/effect timing.

## Regression evidence

- `tests/compatibility/thread_fallback_test.lua` covers no-thread subsystem behavior.
- `tests/tools/test_thread_fallback.py` covers fallback and fanfare behavior.
- `tests/tools/test_lovejs_launcher.py` verifies the audio overlay and exact fail-closed fill seam.
- `tests/runtime/deferred-viewport-loader.test.ts` proves the runtime does not consume `1×1` and waits for stable presented `440×900` geometry.
- 109 Node tests and 31 executed Python tests pass; 3 other environment-dependent Python probes skip. The committed fake-runtime cache test ran with the locally built Lua 5.4 reference interpreter.

## Remaining risk

Smaller slices still consume the same aggregate main-thread synthesis work, and first-use SFX/cries still block before they can be cached. WAV decoding, cache persistence, warm-cache fidelity and the 256-buffer QueueableSource limit require physical Native 0.4.7 proof. A roughly three-second queue tolerates less unrelated blocking than the prior six-second queue. Worker-only mod jobs remain unavailable, and the independent Scripting `t.__type__` component-builder event is unresolved.
