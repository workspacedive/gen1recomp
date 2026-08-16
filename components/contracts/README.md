# Architecture contracts

Host-independent strict TypeScript contracts for the Gen1Recomp Scripting feasibility port.

## Modules

| Module | Responsibility | Does not provide |
|---|---|---|
| `host-protocol.ts` | versioned JSON envelope, closed method/event/error sets, fail-closed parser | a Scripting/WebView transport or method-specific broker implementation |
| `platform.ts` | abstract storage/import/digest/haptic/capability port | proof that Scripting exposes every optional capability |
| `runtime.ts` | runtime descriptor, closed boot-request parser, state machine union and Lua runtime lifecycle port | Lua, LuaJIT, WASM or LÖVE implementation |
| `renderer.ts` | renderer resources/passes/stats and pixel-perfect viewport calculation | WebGL, TimelineCanvas, Metal or CPU backend |
| `input.ts` | normalized buttons, deterministic edge samples and serialization | raw touch/controller/keyboard adapter |
| `mod-capabilities.ts` | upstream permission parsing, scoped capability mapping and least-privilege decisions | OS/process sandboxing or a Lua mod loader |
| `component-manifest.ts` | closed manifest v1 parser with artifact integrity and dependency metadata | artifact extraction, compatibility activation or durable storage |
| `json.ts` / `result.ts` | JSON boundary and explicit result primitives | exceptions-as-control-flow policy |

Wire definitions are mirrored by `schemas/host-message.schema.json` and `schemas/component-manifest.schema.json` using JSON Schema 2020-12; the update journal and love.js functional-evidence adapter have their own closed schemas alongside them. Runtime parsers additionally enforce semantic constraints that JSON Schema cannot conveniently express, such as duplicate dependency IDs and canonical timestamp validity.

No module imports Scripting, Gen1Recomp Lua, LÖVE or a rendering backend. That dependency rule is intentional: adapters depend on these contracts, never the reverse.
