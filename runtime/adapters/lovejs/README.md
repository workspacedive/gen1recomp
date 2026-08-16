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
