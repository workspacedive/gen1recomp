# love.js runtime adapters

## Persistence

The browser probe demonstrated three distinct facts:

1. same-session `love.filesystem.write/read` works;
2. an immediate reload can race the asynchronous IDBFS write and lose the marker;
3. after settling—or after explicitly awaiting `Module.FS.syncfs(false)`—the marker is recovered on reload.

`persistence.ts` wraps Emscripten `FS.syncfs` behind a serial Promise queue. It distinguishes populate from flush, requires an attributed flush reason, enforces a bounded timeout and returns typed failures rather than allowing overlapping sync operations.

A future Scripting adapter should call:

- `populate("runtime-start")` before game-plane file consumption when the runtime does not already await population;
- `flush("save-commit")` after a durable save transaction;
- `flush("lifecycle-suspend")` before suspension when host time permits;
- `flush("runtime-stop")` before controlled teardown.

This remains an application-level durability barrier. Physical Scripting suspend/kill behavior and torn host writes are still unproven.

## Functional capability evidence

`capabilities.ts` parses a closed, JSON-only capability report and derives a conservative `RuntimeDescriptor`. Activation depends on measured operations, the exact pinned love.js revision, the expected host, and the current boot session—not namespace or symbol presence. In particular:

- working same-state Channels do not imply usable worker Threads;
- touch/joystick namespace presence does not imply multi-touch or controller input;
- a queued audio buffer does not imply audible playback or scheduling fidelity;
- outside-browser evidence cannot satisfy the Scripting host profile.

The canonical archival outside-browser evidence is [`../../../docs/gen1recomp/runtime-capability-report.outside-browser.json`](../../../docs/gen1recomp/runtime-capability-report.outside-browser.json), derived from the pinned Chromium smoke report. Its `purpose: "archival"` and explicitly archival session ID make it ineligible for the live activation verifier. The Scripting device profile is deliberately marked `evidence-pending`, so even synthetic all-pass JSON cannot activate it. Removing that block requires app-synchronized Scripting declarations plus a physical-device capture that passes the required operations. The parser and policy are an activation guard, not proof that report producers are trustworthy; a future host adapter must capture the report in the same host-created session and pass the matching `sessionId` to the runtime manager.

## Runtime port and durability ordering

`runtime-port.ts` implements `LuaRuntimePort` over two injected, host-neutral boundaries: `LoveJsGameSurfacePort` and `LoveJsPersistencePort`. It does not invent or import a Scripting WebView API. The concrete surface is still blocked on synchronized declarations.

The port enforces this order:

1. populate IDBFS before the game surface starts;
2. ask the game surface to quiesce and settle Lua-side writes;
3. flush IDBFS before publishing `suspended` or disposing the surface;
4. retain a quiesced surface when flush fails so an explicit stop can retry without losing data;
5. flush and dispose a surface that may have started only partially.

`quiesce` is an application contract, not a browser primitive: an implementation must stop game callbacks and wait for save writes before returning success. The current code proves lifecycle/error ordering with fakes only. It does not prove a Scripting lifecycle deadline, IndexedDB durability after iOS termination, or a real WebView loader.
