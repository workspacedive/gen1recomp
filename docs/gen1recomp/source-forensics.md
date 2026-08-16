# Gen1Recomp Source Forensics

**Analyzed:** 2026-08-16
**Release baseline:** `v0.1.96` → `73fbaaa25093338585923b8b9809f2fea7fc59dc`
**Dev baseline:** `9469e399262e4e989902b61b449dd353c1fded3b`
**Wiki baseline:** `6fd19ee11802fd1930ebe4d07d26badc39f108f3`
**Machine-readable scan:** [`forensics.json`](forensics.json)
**Reproducer:** `tools/analyze_gen1recomp.py`

## 1. Identity: native recreation, not emulator

The upstream README, architecture document and code agree:

```text
canonical user-supplied ROM
→ SHA-1 validation
→ Lua RomImporter/RomExtractor
→ private generated Lua data + PNG/audio program cache
→ original bytes released
→ hand-written Lua game logic on LÖVE
```

There is no Game Boy CPU interpreter, instruction dispatcher, memory bus, PPU, hardware timing core or emulator dependency. The game logic, maps, scripts, battles, rendering and audio behavior are hand-written. This is the architecture that must remain intact.

The current source accepts canonical US Red, Blue, Yellow and Gold inputs. Gold is present but upstream describes its Gen 2 engine as still under construction. A faithful Gen1 target must not silently claim complete Gold parity.

## 2. Repository inventory

The release tree contains 7,808 tracked files / 207,696,353 bytes including vendored LÖVE Android and UWP dependencies. Excluding the largest explicitly vendored trees (`mobile/android/love`, Android Gradle wrapper and UWP third-party binaries), the project-authored/reference surface is 1,744 files / 31,477,048 bytes.

Tracked code inventory includes:

| Language | Files/lines observed | Meaning |
|---|---:|---|
| Lua | 1,486 files / 452,446 lines | game, import, runtime, mods, tests and tools |
| Python | 57 / 28,602 | extraction/build/modkit/test tooling |
| Shell | 82 / 29,846 | packaging and platform automation |
| Java | 93 / 20,105 | primarily vendored/custom Android LÖVE host |
| Swift | 2 / 513 | custom iOS picker/health bridges |
| C/C++/headers | large vendored surface | LÖVE, SDL, LuaJIT, dependencies and platform ports |

These are lexical line counts, not complexity or performance measurements.

## 3. Runtime lifecycle

The verified lifecycle is:

```text
boot → import → discover mods → load mods → merge/freeze content → play → save
```

### Boot/import

- `conf.lua` configures the LÖVE host.
- `main.lua` owns launcher/game/editor dispatch and LÖVE callbacks.
- `RomImporter` verifies a recognized SHA-1 and size.
- `RomExtractor` or `RomExtractorGen2` creates the private cache.
- extraction has a `love.thread` worker path and a coroutine fallback.
- generated paths and ROMs are excluded from packaged payloads.

### Game

`src/core/Game.lua` is the Gen 1 service owner. It initializes data, input, renderer, state stack, saves, audio and mods. `Game2.lua` is a separate Gen 2 service owner. This distinction already causes compatibility adapters in `src/mods/Gen2Compat.lua`.

### Loop

- `FixedStep.STEP = 1 / 60`.
- an accumulator advances deterministic game logic in whole steps;
- catch-up is clamped and a special discard path absorbs known load hitches;
- audio and presentational tweens use separate real-time accumulators;
- `main.lua` owns a custom `love.run` for event pumping, update, draw, present and frame-cap pacing;
- pause/focus/visibility/low-memory and input recovery are explicit callbacks.

The 60 Hz value is the upstream implementation; it is not a measured display refresh guarantee on Scripting.

## 4. Rendering

The original renderer is already pixel-aware:

- logical classic surface: **160 × 144**;
- optional wide battle surface: 304 × 144;
- `PixelCanvas.new` forces `dpiscale = 1`;
- nearest-neighbor filtering;
- integer scale computed from real framebuffer pixel dimensions;
- aspect-preserving letterbox;
- variable world canvas for survey zoom;
- separate UI/world composition;
- SpriteBatch-based maps, sprite sheets, render targets, shaders/pipelines and palette effects;
- explicit invalidation for GPU resources.

This logic is not a generic screen-coordinate assumption: game coordinates are fixed, while final composition adapts to framebuffer dimensions and DPI. A Scripting port should preserve the 160 × 144 render target and replace only the backend adapter.

### Coupling reality

A lexical scan of `src` found 2,721 `love.*` occurrences (including comments and declarations) across many components. The largest module groups were:

| LÖVE namespace | Occurrences |
|---|---:|
| `love.graphics` | 1,350 |
| `love.filesystem` | 356 |
| `love.system` | 185 |
| `love.math` | 116 |
| `love.thread` | 69 |
| `love.timer` | 60 |
| `love.image` | 49 |
| `love.window` | 46 |
| `love.mouse` | 44 |
| `love.event` | 38 |

Therefore “replace LÖVE with Canvas” is not a small renderer substitution. The compatibility surface includes filesystem, threading, audio, timers, events, image decoding, input and window/lifecycle semantics.

## 5. Module graph and boundaries

The upstream tree has meaningful directories, but they are not independently versioned products. There are 99 observed cross-component require-edge pairs and cycles between major areas. Largest edges:

| From → to | Requires / source files |
|---|---:|
| UI → core | 255 / 82 |
| UI → render | 188 / 66 |
| world → core | 117 / 15 |
| battle → core | 67 / 12 |
| import → mods | 54 / 2 |
| core → render | 48 / 4 |
| mods → core | 47 / 16 |
| script → core | 41 / 7 |
| world → render | 39 / 12 |
| import → core | 35 / 6 |

This does not invalidate the upstream design; it shows that independent binary/package updates cannot be obtained merely by moving directories. Stable façades have to be introduced around the existing payload before internals are split.

## 6. Lua runtime facts

- Target semantics are LuaJIT / Lua 5.1.
- `setfenv`, `loadstring`, `bit` and Lua 5.1 environment behavior are used by the mod sandbox and engine.
- seven authored files have LuaJIT FFI paths: Discord, host shell, orientation/NX, cache mounting, desktop TLS and Android second-screen bridging.
- two files inspect/adjust `jit` behavior.
- most FFI paths are platform-specific and guarded, but the compatibility behavior must be tested rather than assumed.
- `ChipAudio` has a synchronous fallback when `love.thread` is unavailable; extraction has a coroutine fallback. Network fetch workers and mod background jobs need a new broker or verified web-thread path.

On iOS, LuaJIT's own official installation guide states that JIT compilation is disabled because ordinary iOS apps may not generate code at runtime. A native iOS LÖVE build therefore uses the LuaJIT interpreter, not the JIT compiler. A Scripting port must call this “LuaJIT interpreter mode” only if LuaJIT is actually embedded — a PUC Lua/love.js backend is not LuaJIT.

## 7. Mod platform

The upstream mod system is mature and already follows several requested principles:

- `manifest.json` with id, version, API, engine semver range, entry point, dependencies, optional dependencies, conflicts, profiles, game targets, permissions, imports and GitHub update source;
- deterministic ordering: dependencies, priority, id;
- 37 documented registries plus aliases;
- register/override/patch/remove merge operations;
- schema validation and cross-reference resolution;
- content freeze after merge;
- unsealed event and hook buses;
- per-callback `pcall` error containment;
- entry-load rollback journal;
- per-mod save namespaces, durable storage, migrations and checkpoints;
- link compatibility fingerprint;
- v1 compatibility shims and API 2 strict mode;
- modkit validate/lint/pack paths.

### Existing capability model

Manifest permissions are currently:

```text
network
filesystem          (legacy disclosure, not a raw grant)
engine_internals
steps
background
```

The sandbox removes raw `io`, `os`, `debug`, `package`, `ffi`, `love.filesystem` and `love.thread`; scoped APIs expose own assets, own files, own storage, brokered network/jobs/steps, registries, events and hooks.

The upstream source explicitly describes this as defense in depth/application-level isolation, not an OS security boundary. That wording must be preserved.

`engine_internals` remains a high-risk compatibility escape hatch. The Scripting architecture should keep it behind explicit legacy/high-risk consent and should not offer an equivalent to new mods by default.

## 8. Saves and updates

### Saves

- central format number: `saveFormat = 4`;
- game and mod migrations;
- `.tmp` witness and `.bak` recovery copy;
- unknown mod content quarantine for Gen 1;
- recovery and validation reports.

LÖVE filesystem lacks atomic rename in this path, so the save write is recoverable but not a single filesystem transaction.

### Engine payload update

The `.love` updater is strong:

```text
download .part
→ SHA-256 verify
→ payload probe (engine/minShell/payloadHost)
→ rename/copy into updates
→ activate only on restart
→ pending crash marker
→ mount/chainload
→ restore bundled callbacks and delete failing payload on failure
```

The native shell contract, payload host and engine payload are already separately identified in `Version.lua`.

### Mod update gap

`LauncherMods.installZip(replace=true)` validates the incoming archive and preserves user `baseroms`, but removes existing same-id trees before copying the replacement. On copy failure it removes the partial new tree; it does not restore the old mod code tree. That is not a complete atomic update/rollback transaction and needs a staged-version directory + pointer activation model in the target architecture.

## 9. Current version model

`src/core/Version.lua` centralizes:

| Field | v0.1.96 payload |
|---|---|
| engine | `0.1.96` when CI-stamped |
| shell | `1` |
| payloadHost | `love` |
| minShell | `1` |
| mod API | `2` |
| link protocol | `2` |
| save format | `4` |
| cache generation | `rom-cache-v5` |

LÖVE is separate only at build configuration level: 11.5 for most targets, Android love-android 11.5a, and iOS 12.0. Kernel, game core, renderer and UI do not yet carry independent manifests/API versions.

## 10. Tests executed

A host LuaJIT 2.1 interpreter was built from the vendored source. Pillow 11.3.0 was installed into the ignored research environment because one Python routing test imports it.

Command:

```bash
PYTHONPATH=research/downloads/python \
LUA=<vendored-luajit>/src/luajit \
scripts/test.sh --quick
```

Result: **all runnable ROM-free tiers passed**:

- T0 builder/platform gates;
- T1/T2 engine invariants and 172 engine suites;
- T4 mod SDK and 23 modkit suites;
- T4 cold-restart checkpoint integration.

Not run:

- T3 content/parity over generated Red data, because no copyrighted ROM/cache was supplied;
- LÖVE screenshot/golden tier;
- Android APK execution;
- iOS execution;
- Scripting host execution.

No unrun tier is reported as passed.

## 11. Critical upstream risk noted for iOS

The release build script labels the target LÖVE 12.0 but clones both `love2d/love` and `love-apple-dependencies` from unpinned `main` by default. LÖVE's own wiki still identifies 12.0 as unreleased. The Gen1Recomp tag therefore remains insufficient for reproducibility.

For the published v0.1.96 workflow, GitHub records the iOS build step at `2026-08-16T03:34:13Z`–`03:35:48Z`. The respective `main` histories' latest commits at step start, still unchanged as branch tips at the audit time, were LÖVE `853f1cad4bb65d63f02dbcd3fa31b0c622d3abbc` and Apple dependencies `a5522634f1e581a1ebab73bf3ab4bd7a853b7a3e`. These are recorded in `research/gen1recomp-lock.json` as a high-confidence time reconstruction. They are not artifact-attested because the Actions log archive and IPA could not be transferred. Future builds must pass/persist immutable refs directly rather than reconstruct them afterward.
