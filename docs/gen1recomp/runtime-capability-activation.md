# love.js functional capability activation

**Status:** outside-browser profile eligible for host-independent integration; Scripting profile blocked
**Date:** 2026-08-16

## Evidence chain

[`runtime-capability-report.outside-browser.json`](runtime-capability-report.outside-browser.json) is the closed archival normalization of the measurements recorded in [`lovejs-smoke-report.json`](lovejs-smoke-report.json), whose SHA-256 at extraction time was `14d8ba868bc7aab8b8398910a980c04dbd023701b9a81fa01dd0f1e8c61459d0`. It identifies pinned love.js revision `9355186de22db13bd88bf2a0db75d2925647d036`, Chromium `149.0.7827.0`, the original observation time, and one status/observation for each modeled operation. Its `purpose` is `archival`, and its `archived-capture-…` session identifier is documentary correlation assigned during normalization, not a nonce emitted by the original browser run. The activation verifier accepts only `purpose: "live-activation"`, so this file cannot be replayed as live boot evidence.

This normalization adds no higher evidence claim. `osVersion` remains `null`; queued audio explicitly remains inaudible/unverified; touch and joystick are namespace observations only; simultaneous touch is unavailable; worker creation is unavailable even though the symbol existed. Chromium/SwiftShader evidence remains separate from Scripting/WebKit/device evidence.

## Gate rules

`runtime/adapters/lovejs/capabilities.ts`:

1. rejects non-plain/non-JSON values, unknown fields/checks, noncanonical IDs/revisions/timestamps, and unsupported schema versions;
2. requires the report's `sessionId` to match the boot request supplied to the verifier;
3. requires an exact host and pinned love.js revision;
4. requires successful functional checks and exact expected-unavailable outcomes;
5. derives a conservative `RuntimeDescriptor` only from passed checks;
6. never derives `threads` from `love.thread.newThread` presence, `rawMultiTouch` from `love.touch`, or `gameController` from `love.joystick`;
7. keeps `LOVEJS_SCRIPTING_DEVICE_PROFILE` in `evidence-pending` state regardless of reported check values.

The session identifier is correlation, not cryptographic attestation. The eventual Scripting host must create the session, run the probe in the runtime instance being booted, and deliver the report over a trusted application boundary. Accepting uploaded or stale report JSON as live capability evidence would be incorrect.

## Manager boundary

`runtime/manager/runtime-manager.ts` owns lifecycle and concurrency only. It receives the selected component ID, an already-created `LuaRuntimePort`, and an injected verifier. Before backend boot it compares the verifier's descriptor with `LuaRuntimePort.describe()` for component/runtime identity, all version fields, and every evidenced capability. Extra backend claims do not expand the evidenced descriptor.

The manager serializes operations, makes suspend/resume idempotent only in their destination states, rejects invalid transitions, and attempts stop after any failed/throwing boot. The injected love.js `LuaRuntimePort` separately coordinates its game-surface quiescence with populate/flush barriers; this keeps IDBFS mechanics out of the generic manager. Component download, dependency resolution, integrity, staged activation, known-good rollback, and structured telemetry remain separate control-plane responsibilities.

## Scripting activation exit criteria

The hard block may be changed only after all of the following are committed as evidence:

- exact app-synchronized Scripting declarations and host/app version;
- a physical-device report from the same host-created session;
- local WASM, WebGL, Canvas/ImageData/shader, fixed-step, filesystem and explicit-sync operations;
- user-gesture audio plus interruption/resume characterization (the current queue-only result is insufficient for audible parity);
- simultaneous-touch/cancel/lifecycle measurements;
- controller behavior only if a real API and attached-device roundtrip are observed;
- suspend/resume/stop and persistence recovery on physical iOS;
- no substitution of outside-browser evidence for any device-only requirement.

Checks not represented by schema version 1 (including audible output, interruption recovery and iOS lifecycle recovery) require a schema/profile revision before the block is removed; prose evidence alone cannot silently satisfy them.
