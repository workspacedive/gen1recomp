# Target Architecture — Gen1Recomp on Scripting/iOS

**Status:** Architecture baseline; runtime backend pending Phase 0 device gate
**Decision:** preserve original `.love` payload first; do not begin a TypeScript game rewrite

## 1. Two-plane model

### Control plane — Scripting/TSX

Owns:

- launcher and platform UI;
- user-driven ROM/mod/save import;
- capability consent;
- version/compatibility resolution;
- component staging, integrity and rollback;
- native Scripting APIs (files, document picker, haptics, WebView lifecycle);
- diagnostics export.

It never reads or mutates game internals directly.

### Game plane — isolated runtime surface

Owns:

- Lua VM;
- LÖVE API and game loop;
- original Gen1Recomp kernel/core/game UI;
- mod registry/events/hooks;
- game rendering and audio.

For the preferred spike this plane is a local `WebViewController` running a pinned LÖVE 11.5 web runtime. The backend remains provisional until real-device evidence.

## 2. Required layer order

```text
Scripting Host (control plane)
↓ HostProtocol
Platform / iOS-Scripting Broker
↓ PlatformPort
Runtime Manager
↓ LuaRuntimePort
LÖVE Host Compatibility
↓ LoveHostPort
LÖVE2D distribution (separate artifact)
↓ stable Love API
Kernel (fixed step, input abstraction, state stack, lifecycle)
↓ GameKernelPort
Gen1Recomp Core (original game logic/data contracts)
↓ Mod API
Mod Layers
```

Parallel UI path:

```text
Platform UI (TSX)
→ Application API
→ Application Services
→ HostProtocol/Game public commands
```

Rendering path:

```text
Gen1Recomp/LÖVE draw calls
→ RendererPort
→ selected backend
   ├── WebGL through LÖVE web runtime (preferred candidate)
   └── TimelineCanvas diagnostic/fallback (not parity-approved)
```

There is no `MetalRenderer` branch until Scripting exposes a verified Metal API. The existing native Gen1Recomp iOS build can use LÖVE 12 Metal, but that is a different host artifact.

## 3. Component boundaries

### `scripting-host`

- Scripting `index.tsx` lifecycle;
- creates platform UI and runtime surface;
- owns no ROM parser and no game rules;
- sends coarse commands, never per-frame state.

### `platform-ios-scripting`

Adapters around exact documented Scripting APIs:

- file picker/bookmark and private storage;
- cryptographic verification;
- archive handling with policy validation;
- haptics and audio-session lifecycle;
- WebView creation/disposal;
- orientation/wake-lock restoration;
- network download broker.

### `runtime-manager`

- loads a runtime manifest;
- verifies API/dependency ranges and artifact checksum;
- starts/stops/suspends one runtime instance;
- owns runtime state machine;
- reports capabilities actually detected, not desired capabilities.

### `lua-runtime`

Stable interface; implementations are separate artifacts:

- `lovejs-lua51` candidate;
- future `wasm-lua51` candidate;
- native `luajit-interpreter-ios` only for a native app host, never falsely selected in Scripting.

### `love-compat`

A host overlay, not changes inside Gen1Recomp:

- supplies the parity-tested pure-Lua BitOp module missing from the tested love.js distribution;
- maps persistent files and network broker into the LÖVE web filesystem;
- maps pause/resume/input events;
- supplies compatibility shims for guarded FFI/native calls;
- refuses unavailable capabilities with stable errors;
- records each divergence from upstream LÖVE.

### `love2d`

Pinned, immutable, separately checksummed runtime distribution. Any browser-specific fork/patch set is recorded against an exact upstream commit and carries its own API version and tests.

### `kernel`

The deterministic orchestration contract represented initially by upstream:

- `FixedStep`;
- abstract input edges/state;
- state stack;
- lifecycle pause/resume;
- timing constants;
- events/hooks dispatch boundary.

Do not physically extract it from upstream in Phase 1. First define a façade and characterization tests. Extraction is permitted only after tests prove no behavior change.

### `gen1recomp-core`

Original import/data/world/script/pokemon/battle/game-UI logic and packaged assets/manifests. It imports only LÖVE/kernel/mod public surfaces, never Scripting.

### `mod-broker`

Preserves upstream Mod API 1/2 and translates manifest permissions into application-level capabilities. No claim of process/OS isolation.

### `platform-ui`

Native launcher, ROM/data, save, mod, settings, accessibility, update and diagnostics screens. It sends commands to application services and cannot import kernel/LÖVE/mod internals.

## 4. Host protocol

The game plane and Scripting plane communicate only through versioned envelopes:

```ts
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

type HostMessage =
  | { kind: "request"; protocol: 1; requestId: string; method: HostMethod; payload: JsonValue }
  | { kind: "response"; protocol: 1; requestId: string; ok: true; payload: JsonValue }
  | { kind: "response"; protocol: 1; requestId: string; ok: false; error: HostError }
  | { kind: "event"; protocol: 1; event: HostEvent; payload: JsonValue }
```

Initial methods:

```text
host.capabilities
storage.read / storage.write / storage.list / storage.remove
import.request
crypto.digest
network.fetch
haptics.play
lifecycle.ready / lifecycle.suspend / lifecycle.resume / lifecycle.exit
diagnostics.emit / diagnostics.export
```

Rules:

- payloads are schema-validated at both sides;
- request IDs are unique and responses single-shot;
- file paths are virtual broker paths, never arbitrary host paths;
- no frame, sprite, input sample or PCM buffer crosses this bridge unless a benchmark proves it necessary;
- high-frequency game work stays entirely inside the game plane;
- unknown protocol/method/capability fails closed.

## 5. Runtime state machine

```text
idle
→ resolving
→ verifying
→ preparing
→ starting
→ running
↔ suspended
→ stopping
→ stopped

Any pre-running failure → failed
Any running fatal error → recovering → known-good or failed
```

Transitions are discriminated and logged. `starting` cannot be re-entered, and suspend/resume commands are idempotent.

## 6. Renderer interface

The core-facing interface expresses behavior, not WebGL/Canvas primitives:

```text
createSurface(logicalWidth, logicalHeight, options)
loadTexture(assetId, bytes, sampling)
createAtlas(entries)
beginFrame(frameId)
beginPass(target, clear)
drawBatch(batch)
applyPipeline(pipelineId, uniforms)
endPass()
present(viewport)
invalidate(reason)
stats()
```

Backend requirements:

- exact 160 × 144 render target;
- nearest-neighbor and integer final scale;
- stable aspect ratio/letterbox;
- reusable textures/atlases;
- render-to-texture;
- batching;
- shader capability detection;
- explicit context-loss/invalidation handling;
- no allocation requirement in hot paths where backend permits reuse.

The interface does not promise a feature unless backend capability detection returns it. A mod shader/pipeline that requires an unavailable feature is disabled with an attributed error, not silently approximated.

## 7. Input interface

```ts
type GameButton = "up" | "down" | "left" | "right" | "a" | "b" | "start" | "select" | "menu"

type InputSample = {
  sequence: number
  monotonicTime: number
  source: "touch" | "controller" | "keyboard"
  held: ReadonlySet<GameButton>
  pressed: ReadonlySet<GameButton>
  released: ReadonlySet<GameButton>
}
```

Adapters normalize sources before the kernel. Touch layout, dead zone, repeat, long press and haptic policy stay outside core. Input sequences are recorded for deterministic replay. Controller/keyboard adapters exist only when the host actually exposes them.

## 8. Mod capability model

Baseline safe surface (not raw grants):

```text
assets:read-own
events:subscribe
hooks:register
registry:read
registry:write-during-load
save:read-own
save:write-own
storage:read-own
storage:write-own
ui:register
```

Optional explicit capabilities:

```text
network:https
background:compute
steps:read
imports:read-declared
platform:haptics
```

Compatibility-only, high risk:

```text
legacy:engine-internals
```

Mappings preserve upstream manifests:

| Upstream permission | Target handling |
|---|---|
| none | baseline scoped API only |
| `network` | consent + HTTPS broker; no raw socket by default |
| `background` | bounded broker job if backend supports it |
| `steps` | explicit health/steps consent and broker |
| `filesystem` | disclosure only; never raw host filesystem |
| `engine_internals` | legacy/high-risk mode, off by default for new mods |

Each mod still runs in a language-level private environment. This reduces accidental and many direct accesses, but it is not an OS/process sandbox because mods and engine share a runtime.

## 9. Component manifest

Every independently updateable component has:

```json
{
  "schemaVersion": 1,
  "id": "org.gen1recomp.runtime.lovejs",
  "kind": "runtime",
  "version": "0.1.0",
  "apiVersion": "1.0.0",
  "artifact": {
    "path": "runtime.zip",
    "size": 0,
    "integrity": { "algorithm": "sha256", "digest": "...64 lowercase hex..." }
  },
  "dependencies": [
    { "id": "org.gen1recomp.host-protocol", "range": "^1.0.0" }
  ],
  "compatibility": {
    "hostProtocol": "^1.0.0",
    "kernelApi": "^1.0.0",
    "loveApi": "11.5.x"
  },
  "capabilities": [],
  "migrations": [],
  "selfTests": []
}
```

Immutable component files live under `components/<id>/<version>/`. Runtime mutable data, caches, saves and mods never share that tree.

## 10. Update and rollback transaction

```text
download into .part
→ verify transport result, size and SHA-256
→ safe extract into staging/<transaction-id>
→ validate manifest/schema/dependency graph/capabilities
→ run component self-tests
→ write candidate active pointer + previous pointer
→ activate only at safe restart boundary
→ health check
→ commit active pointer or restore previous pointer
→ retain bounded known-good generation
```

Archive policy before extraction:

- path traversal/symlink rejection;
- maximum compressed/uncompressed size;
- maximum entry count and nesting depth;
- file-type allowlist per component kind;
- no ROM/cache/baseroms in distributed mod/package artifacts;
- checksum after extraction where manifests list files.

Because Scripting filesystem atomicity has not been proven, pointer updates use an abstract `ActivationStore` with `active`, `knownGood`, `previous` and `journal` records. The journal moves through `prepared → verified → tested → activating → activated`; recovery discards pre-pointer staging and conservatively restores the previous set from every pointer-changing phase. The eventual Scripting storage adapter must prove durable write semantics on-device; these logical records are not a claim that host file replacement is atomic.

## 11. Compatibility/deprecation

- APIs use major/minor versions; only major breaks semantics.
- unknown newer major is refused.
- old major can be translated only by an explicit compatibility adapter.
- deprecations are attributed, counted and documented; no silent behavior change.
- migrations are ordered, idempotent, version-ranged and tested from every supported prior schema.
- compatibility result is computed before activation and exposed in the UI.

## 12. Repository shape after feasibility gate

```text
gen1recomp-scripting/
├── components/
│   ├── host-protocol/
│   ├── platform-port/
│   ├── runtime-port/
│   ├── renderer-port/
│   ├── kernel-port/
│   └── mod-api/
├── scripting/
│   ├── host/
│   ├── platform/
│   ├── ui/
│   ├── input/
│   └── diagnostics/
├── runtime/
│   ├── manager/
│   └── adapters/lovejs/
├── compatibility/love-web/
├── love2d/                         # manifest/patch metadata, not mixed core
├── kernel/                         # façade + characterization tests first
├── gen1recomp/                     # pinned upstream payload integration
├── rendering/
│   ├── api/
│   ├── webgl/
│   └── timeline-canvas-probe/
├── mods/
│   ├── api/
│   ├── loader/
│   └── broker/
├── tests/
│   ├── contracts/
│   ├── runtime/
│   ├── adapters/
│   ├── integration/
│   ├── parity/
│   └── performance/
├── research/
├── docs/
└── tools/
```

No empty production directories are created before the runtime gate passes. Documentation/contracts come first; implementation follows the smallest vertical slice.

Current pre-gate code is deliberately narrower than that target tree:

- `components/contracts/src/` contains strict host, platform, runtime, renderer, input, mod-capability and manifest contracts;
- `components/updates/src/` contains host-independent archive policy, dependency resolution and recoverable activation logic;
- `compatibility/love-web/bit.lua` contains the LuaJIT-BitOp-compatible host overlay required by the tested PUC Lua runtime;
- `runtime/adapters/lovejs/persistence.ts` serializes Emscripten populate/flush operations with timeout/error attribution after the probe exposed an immediate-reload durability race;
- `schemas/` contains matching JSON Schema 2020-12 wire, manifest and activation-journal definitions;
- `tests/contracts/`, `tests/updates/` and `tests/tools/` exercise those host-independent boundaries.

There is still no Scripting host adapter, WebView runtime, game payload integration or broad port. Those remain blocked on declaration-backed physical-device probes.

## 13. Core-change exception process

If a Scripting host problem appears to require an upstream Kernel/LÖVE/Core change, the change is blocked until an ADR records:

1. exact failure and reproduction;
2. why adapter, wrapper, shim, broker and compatibility layer each fail;
3. exact upstream location;
4. behavior/API/parity impact;
5. alternatives and their measured costs;
6. smallest proposed patch;
7. characterization and regression tests;
8. rollback plan.

Scripting imports are forbidden in upstream Lua core under all outcomes.
