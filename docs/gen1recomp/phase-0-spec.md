# Phase 0 Micro-Spec — Gen1Recomp → Scripting/iOS

**Status:** Research/Feasibility gate, implementation blocked pending device probes
**Date:** 2026-08-16
**Primary target:** Scripting App on iOS, not Scriptable
**Upstream baseline:** Gen1Recomp `v0.1.96` / commit `73fbaaa25093338585923b8b9809f2fea7fc59dc`

## Goal

Determine a technically honest path that can run the original hand-written Gen1Recomp Lua/LÖVE game logic, import user-supplied ROM data, preserve mod semantics, render pixel-perfect frames, and provide a native Scripting/TSX control plane on iOS — without implementing a Game Boy emulator and without placing Scripting dependencies in the game core.

## Hard invariants

1. No CPU, PPU, memory-bus, instruction, cartridge, or Game Boy hardware emulation.
2. The only ROM path is verify → extract → private generated cache → release ROM bytes.
3. The original Lua game logic and data model remain the parity oracle.
4. LÖVE, runtime, core, mods and platform UI remain separately identified and versioned.
5. Scripting-specific code ends at an adapter/broker boundary.
6. No claim of native LuaJIT, Metal, game-controller support, sandboxing, performance, or parity without evidence.
7. No copyrighted ROM, generated cache, or ROM-derived asset enters this repository.

## Current evidence

- Upstream is a native Lua/LÖVE recreation, not an emulator.
- The release already ships native Android and native iOS packages.
- Android uses vendored love-android 11.5a; iOS currently builds against unreleased LÖVE 12.0 `main`.
- The original runtime targets LuaJIT/Lua 5.1 semantics and uses substantial LÖVE API surface.
- Scripting documents TypeScript/JavaScript, TSX/SwiftUI, `TimelineCanvas`, `WebViewController`, binary file APIs, embedded Python, shell utilities and native media APIs.
- Scripting explicitly does **not** allow scripts to execute arbitrary bundled native binaries.
- No Scripting documentation was found for embedding a native library, Lua/LuaJIT, LÖVE, Metal/CAMetalLayer, GameController, raw multi-touch identifiers, PCM output, `os_signpost`, or process CPU/memory metrics.
- The ROM-free source-built v0.1.96 launcher payload now boots outside Scripting through pinned love.js plus the BitOp overlay: a visible 1024x768 launcher rendered for 10 seconds with no page/runtime/request errors. This is not a game, ROM-import or Scripting pass.

## Feasibility hypotheses

### H1 — Native LÖVE/LuaJIT directly inside Scripting

**Status: rejected by documented host capabilities.** Scripting has no documented native-extension ABI, and its shell explicitly refuses arbitrary binaries. A static LuaJIT/LÖVE library can be embedded in a native iOS app, but not added by a Scripting project after the Scripting app has shipped.

### H2 — Original `.love` payload through LÖVE WebAssembly in a Scripting WebView

**Status: outside-browser smoke passed with a compatibility shim; Scripting remains unproven; preferred spike.** Scripting exposes a `WKWebView`-backed controller. WebKit supports JavaScript, WebGL and WebAssembly generally. Pinned 2dengine love.js revision `9355186…` executed a ROM-free 23-check LÖVE 11.5 probe in Headless Chromium 149/SwiftShader after the first run exposed its missing `bit` module and a pure-Lua BitOp overlay passed 9,492 LuaJIT differential checks. However:

- `love.js` uses PUC Lua 5.1, not LuaJIT;
- FFI is unavailable;
- `love.thread.newThread` creation is unavailable in the outside-browser run despite the symbol existing, so upstream no-thread fallbacks are mandatory; SharedArrayBuffer/cross-origin isolation, local `.love` loading, audible audio, file persistence and mobile memory still need real-device proof;
- `love.js` is third-party and reports known compatibility/performance limits;
- Gen1Recomp has conditional fallbacks for some FFI/thread features, but not a proven browser target.

### H3 — Original Lua via a JS/WASM Lua VM plus a custom LÖVE compatibility layer

**Status: technically conceivable, high risk.** Fengari is Lua 5.3; Wasmoon is Lua 5.4. Both differ from the target LuaJIT/Lua 5.1 semantics. A custom LÖVE façade would need to cover thousands of direct calls across graphics, filesystem, system, threading, image, audio, input, timer and window APIs. This is a fallback research path, not the current implementation plan.

### H4 — Full TypeScript rewrite of Gen1Recomp

**Status: rejected as first path.** It would sacrifice original Lua/mod compatibility, multiply parity risk, and turn the project into a reimplementation rather than a host port.

### H5 — Scripting as native control plane, existing Gen1Recomp iOS IPA as game runtime

**Status: technically clean but does not satisfy “Scripting as the full host.”** Scripting could potentially manage files/settings and launch another app through a documented URL, but it cannot embed or control an unrelated app’s renderer/runtime without an explicit bridge in that app. Keep only as a scope renegotiation fallback.

## Phase 0 deliverables

- [x] Pin dev, release and wiki revisions.
- [x] Analyze source tree, module graph, runtime, renderer, mod system, saves, updates and mobile ports.
- [x] Acquire and validate a release-source-built `game.love` without ROM/cache data.
- [x] Attempt official Android release download and document the sandbox network blocker.
- [x] Run all ROM-free upstream test tiers.
- [x] Record a target architecture and compatibility/version model.
- [x] Define Scripting real-device capability probes.
- [ ] Connect Scripting App through `scripting-cli` and obtain current `.d.ts` files.
- [ ] Run WebView WebAssembly/WebGL/AudioContext/local-file probes on a physical iPhone.
- [ ] Run TimelineCanvas/input/file-I/O probes on the same device.
- [x] Build and execute a ROM-free minimal LÖVE 11.5 `.love` outside Scripting; record the unmodified missing-`bit` failure and adapter-only passing rerun.
- [ ] Repeat the pinned minimal LÖVE 11.5 bundle inside a physical Scripting WebView.
- [x] Boot the source-built ROM-free Gen1Recomp launcher outside Scripting and capture a structured report/non-ROM screenshot.
- [ ] Run a minimal synthetic import fixture/title path inside the selected physical Scripting runtime before any broad port work.

## Go/no-go criteria

### Go for Web LÖVE adapter

All must be demonstrated on a physical target device:

1. Local WebView can instantiate the chosen WASM runtime from project files.
2. Required WebGL context and shader baseline work.
3. Frame callbacks remain active during normal foreground use and correctly pause/resume.
4. Audio can stream without blocking the frame loop.
5. Persistent binary files and cache directories survive restart.
6. Touch can represent D-pad + A/B simultaneous presses without stuck keys.
7. The runtime can boot Lua 5.1 code, `bit`, coroutines and the required LÖVE subset.
8. Measured memory/startup/frame behavior is viable; no threshold is assumed in advance.

### No-go

Any non-replaceable failure in runtime loading, graphics, audio, simultaneous input, persistence or memory means a full faithful Gen1Recomp runtime cannot honestly be delivered inside Scripting. The handoff must then recommend the existing native iOS LÖVE package or obtain an explicit scope change; it must not fake unsupported capabilities.

## Done contract for the first implementation slice

After the gate passes, the first vertical slice is intentionally small:

```text
Scripting launcher
→ select a ROM test fixture / synthetic non-copyrighted bytes
→ brokered validation
→ versioned private cache directory
→ Web runtime boot
→ fixed-step deterministic demo state
→ pixel-perfect 160×144 render
→ D-pad + A/B simultaneous input
→ pause/resume
→ diagnostics export
```

No battle, full ROM extraction, mods, updater or shaders enter the slice until this path is measured and repeatable.
