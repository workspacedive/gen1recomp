# Technology Evaluation — Scripting/iOS Runtime

**Date:** 2026-08-16
**Rule:** “Available on iOS” does not mean “available to a Scripting project.” The host API must expose it or a tested WebView backend must provide it.

Legend:

- **Confirmed:** documented in current reviewed source.
- **Candidate:** plausible, requires a physical-device spike.
- **Unavailable:** contradicted by host documentation.
- **Unknown:** no reliable Scripting evidence found.

## Languages and runtime

| Technology | Availability | Performance/memory evidence | Complexity/risk | Recommendation |
|---|---|---|---|---|
| TypeScript/JavaScript | **Confirmed** in Scripting | no Gen1 benchmark yet | low for host/control plane | Use strict TS for Scripting host, brokers, manifests and native platform UI. |
| TSX/SwiftUI wrappers | **Confirmed** | native UI behavior; game-loop performance not implied | low for launcher/settings | Use for platform UI only. Keep game UI in the game renderer. |
| Custom Swift/Objective-C | **Unavailable to a script project** | N/A | would require changing/rebuilding the Scripting app itself | Do not plan a custom bridge unless Scripting adds an official plugin ABI. |
| Rust/native C/C++ | **Unavailable to a script project** | N/A | Scripting shell forbids arbitrary binaries | Do not use directly. WASM is a separate candidate. |
| Embedded Python | **Confirmed** | each `Python.run` is a fresh top-level execution; calls share a serial queue; timeout not honored | blocking/poor lifecycle for a game | Tooling/import experiments only, never frame loop/runtime. |
| Shell/ios_system | **Confirmed, limited** | serial with Python | no arbitrary binaries, no gcc/node/npm/git | Diagnostics/file tooling only. Not Lua/LÖVE host. |
| Native LuaJIT | **Unavailable by documented Scripting surface** | LuaJIT officially disables JIT on iOS even when statically embedded | impossible without host binary support | Keep `LuaRuntime` abstraction; no LuaJIT claim in Scripting. |
| LuaJIT interpreter in native iOS app | **Confirmed generally**, and used by LÖVE patterns | no target benchmark | requires native app build, not Scripting project | Valid for existing native Gen1Recomp iOS package, not this host constraint. |
| PUC Lua 5.1 via love.js | **Outside-browser smoke passed with a required BitOp shim; still unverified in Scripting** | no transferable performance result; headless run used SwiftShader | no LuaJIT/FFI; upstream `bit` module absent; compatibility/browser limits remain | Continue the feasibility spike because it preserves `.love`/LÖVE shape better than a rewrite. Keep the parity-tested bit shim in the host compatibility overlay, never core. |
| Fengari | **Candidate** | JS implementation; no project-specific benchmark | Lua 5.3 mismatch, no FFI | Only fallback for tiny compatibility tests. |
| Wasmoon | **Candidate in WebView** | WASM Lua 5.4; project claims faster than Fengari in its own benchmark, not transferable | Lua 5.4 mismatch and JS bridge cost | Not first choice for running an existing LÖVE payload. |
| WebAssembly | **Unknown in Scripting main runtime; candidate in WebView** | no device result | local loading/CSP/memory must be tested | Probe `WebAssembly` in both runtimes. Never assume main-runtime support. |

Sources: official Scripting `python/en.md` and `shell/en.md` in the downloaded documentation package; [LuaJIT installation](https://luajit.org/install.html); [love.js 11.5 repository](https://github.com/2dengine/love.js); [Fengari](https://github.com/fengari-lua/fengari); [Wasmoon](https://github.com/ceifa/wasmoon).

## Graphics

| Backend | Availability | Characteristics | Risk | Recommendation |
|---|---|---|---|---|
| Scripting `TimelineCanvas` | **Confirmed** | SwiftUI Canvas-backed; command collector replayed every frame; documented ~60 fps; nearest-neighbor image drawing available | no SpriteBatch/render-target/shader contract; bridge/command overhead unmeasured | Use for diagnostics and a small fixed-step/pixel probe, not yet for full game. |
| Scripting `Canvas` | **Confirmed** | state/layout redraw, not per-frame | wrong lifecycle for game rendering | Static previews/charts only. |
| Metal/CAMetalLayer direct | **Unavailable by Scripting docs** | no exposed API | cannot create pipelines/resources/command buffers | Do not create a `MetalRenderer` implementation for Scripting until an official API exists. |
| SwiftUI implementation internals | **Unknown** | Canvas is native but the concrete GPU path is host-owned | cannot control batching or profile Metal directly | Treat as `TimelineCanvasRenderer`, never market it as Metal. |
| WKWebView WebGL | **Candidate** | WebGL1/2 and a minimal LÖVE shader passed in an outside-Scripting Headless Chromium 149/SwiftShader run; WebKit generally supports WebGL/WebGL2 | local-file, hardware context, memory and lifecycle still need Scripting device proof | Preferred graphics candidate for love.js spike. Do not transfer the software-browser result to iOS performance. |
| WKWebView WebAssembly | **Candidate** | love.js WASM instantiated outside Scripting | Scripting host/local/CSP/memory proof still required | Repeat the same pinned local bundle in Scripting. |
| CPU framebuffer → UIImage | **Candidate fallback** | one image draw can reduce draw-command count | per-frame image allocation/upload may be expensive | Benchmark only after implementing buffer reuse where API allows. |
| Core Graphics/Core Animation direct | **Not exposed as low-level game backend** | indirectly used by native views | insufficient control | No dedicated backend claim. |

Scripting Canvas facts come from official `views/canvas/en.md`. LÖVE 12.0's wiki documents a Metal backend on iOS 13+, but also marks 12.0 unreleased; this applies to the existing native iOS build, not to Scripting. Apple's Metal guidance requires measuring frame time and sustainable workloads; it does not supply performance numbers for this project.

## Audio

| Capability | Availability | Recommendation |
|---|---|---|
| `AVPlayer` file/URL playback | **Confirmed** | Suitable for pre-rendered tracks/SFX, not verified for low-latency channel synthesis. |
| shared audio-session control | **Confirmed** | Use for category/interruption handling if native audio backend is selected. |
| PCM microphone input | **Confirmed** through `AudioCapture` | Input only; does not prove PCM output. |
| raw PCM streaming output | **Unknown/not documented** | Required for direct ChipSynth parity; probe Web Audio in WebView or pre-render bounded chunks to files. |
| Web Audio | **Candidate in WebView** | Spike audio worklet/buffer scheduling, pause/resume and interruption behavior. |

A full game cannot pass the gate until music, SFX, cries and low-health alarm can be scheduled without blocking frame delivery.

## Input and lifecycle

| Capability | Availability | Recommendation |
|---|---|---|
| tap/long-press/drag/magnify/rotate | **Confirmed** | Native platform UI and touch probe. |
| simultaneous gesture composition | **Confirmed** | Does not by itself prove separate-finger D-pad + A/B state. Test it. |
| raw multi-touch IDs | **Not documented** | WebView Pointer/Touch Events may be the more complete game-input route. |
| MFi/Xbox/PlayStation GameController | **Not exposed in reviewed Scripting docs** | Mark unsupported unless a current `.d.ts` or probe proves an API. |
| keyboard game input | **Not documented as a page event API** | Do not promise. WebView keyboard events may work on attached keyboards; test. |
| orientation selection/metrics | **Confirmed** through `Device` | Restore user settings after dismissal. |
| wake lock | **Confirmed** | Enable only during active play; restore on exit/background. |
| app background/resume | Script minimize/resume is documented for resident scripts, but the exact page/WebView lifecycle needs proof | Build explicit suspend/resume state machine and test real app switching. |
| haptics/Core Haptics | **Confirmed** | Broker effects; rate-limit and respect user setting. |

## Data, filesystem and updates

| Capability | Availability | Recommendation |
|---|---|---|
| `Uint8Array`, `Data`, ArrayBuffer-based web APIs | **Confirmed in relevant APIs** | Use typed binary boundaries and avoid JSON for ROM/cache data. |
| async file read/write | **Confirmed** | Use for ROM, cache, saves and packages. |
| external file bookmarks/document picker | **Confirmed** | Broker user-selected inputs; copy into private versioned project storage before use. |
| zip/unzip | **Confirmed** | Add independent path traversal/size/file-count validation; do not trust extraction alone. |
| crypto hashes | **Confirmed in current Scripting release/docs** | SHA-1 only for canonical ROM identity compatibility; SHA-256 for packages/integrity. |
| arbitrary process execution | **Unavailable** | Never build updater/mod logic around downloaded executables. |
| atomic rename semantics | **Not established** | Implement stage + checksum + manifest + active pointer; retain known-good generations. Test crash behavior. |

## Observability

| Tool/metric | Availability | Recommendation |
|---|---|---|
| structured script logs | **Confirmed** | Redacted categories and levels; bounded files. |
| frame/update/render duration | **Implementable** from timeline timestamps | Store histograms/percentiles, not just instantaneous FPS. |
| startup/import/cache/save spans | **Implementable** | Monotonic timestamps and correlation IDs. |
| CPU/memory/GC process metrics | **Not documented** | Report unavailable, never fabricate. Lua/WASM runtime may expose its own heap counters only. |
| `os_log` / `os_signpost` | **Not exposed** | No claim. |
| Instruments/Metal System Trace | Applies to native app development, not proven attachable to App Store Scripting process | Use only if a real device session demonstrates access; otherwise rely on in-app spans. |
| thermal state | **Not exposed in reviewed Device docs** | Infer nothing. Observe frame degradation and battery state only; label battery as battery, not thermal. |

## Decision

Continue with the **WebView + LÖVE 11.5 web-runtime feasibility spike**. Its 23-check outside-Scripting gate passes with a separately tested pure-Lua BitOp compatibility overlay, and the ROM-free source-built v0.1.96 launcher renders for a sustained 10-second boot observation without runtime/page/request errors. Queueable buffer construction and same-state channels work, but `love.thread.newThread` worker creation does not; no-thread fallbacks are therefore part of the selected candidate contract. That is evidence for the architecture, not approval for ROM/game integration. The next mandatory gate is the same pinned bundle in Scripting on a physical device, including audible audio, simultaneous input, lifecycle and durable persistence. Platform UI and brokers remain independent TypeScript components. `TimelineCanvas` is diagnostic/fallback only. Metal, native LuaJIT, raw controller input and low-level profiling remain unavailable or unverified and must not appear as implemented components.
