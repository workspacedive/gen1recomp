# Runtime manager

`RuntimeManager` is the host-independent lifecycle owner above `LuaRuntimePort`. It does not import Scripting, love.js, LÖVE, Kernel, Core, or mod implementations.

Boot is fail-closed:

1. enter `resolving` for the selected component;
2. validate same-session functional evidence through an injected verifier;
3. require evidence and backend descriptors to agree on identity, versions, and every evidenced capability;
4. invoke the runtime backend only after those checks pass;
5. enter `running` only after a successful backend boot.

Overlapping operations return `busy`. Suspend/resume are idempotent only when already at their target state; all other invalid transitions are rejected. A failed or throwing boot triggers a best-effort backend stop because initialization may have been partial. A lifecycle failure keeps the backend marked potentially active, and boot cannot retry until an explicit stop succeeds.

The manager intentionally does not resolve component manifests, verify artifact hashes, mutate active pointers, or recover a known-good component generation. Those responsibilities stay in the component/update control plane; this class starts only the already-selected, already-integrity-checked runtime port.
