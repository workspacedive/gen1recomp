# LÖVE web compatibility overlays

Host/runtime shims required by the selected PUC Lua 5.1 love.js candidate. These files are packaged outside Gen1Recomp core and must remain independently versioned and removable.

## `bit.lua`

The first executed love.js smoke test failed at `require("bit")`. Gen1Recomp has 11 literal imports and uses `band`, `bor`, `bxor`, `bnot`, logical/arithmetic shifts and related LuaJIT BitOp semantics hundreds of times.

`bit.lua` implements the complete LuaJIT BitOp public surface in pure Lua 5.1:

```text
tobit, tohex, bnot, band, bor, bxor,
lshift, rshift, arshift, rol, ror, bswap
```

`tests/compatibility/bit_shim_test.lua` performs 9,492 differential comparisons against the pinned vendored LuaJIT 2.1 implementation, including boundary values, modulo-32 shift counts, variadic operations, deterministic random triples, fractional tie-to-even conversion, non-finite values and error behavior. The test passes in the current research environment.

The shim prioritizes correctness/replaceability. Its performance has not been measured in a physical Scripting WebView. Optimize only after profiling import and chip-audio paths, and preserve differential parity for every change.

## `bootstrap.lua`

The measured love.js runtime exposes `love.thread.newThread` as a function, but constructing a worker fails. A symbol-presence check therefore produces a false capability result. The deterministic launcher packager preserves upstream `main.lua` as `gen1recomp-main.lua` and inserts a tiny host wrapper that calls `bootstrap.install` first. For this pinned runtime component the bootstrap hides only `love.thread.newThread`; Channels remain available.

That normalization causes existing upstream checks to select their intended soft paths:

- network fetches fail immediately instead of remaining pending;
- updater state reports background threads unavailable;
- mod background jobs report unavailable;
- ROM extraction selects its coroutine path;
- chip music selects synchronous amortized queue fill.

The bootstrap changes no LÖVE source. Packaging applies one separately recorded, fail-closed two-line Gen1Recomp seam so `ChipAudio` can read optional host fill constants while retaining upstream defaults. It can be removed with the audio adapter when a replacement runtime passes a real worker roundtrip probe.

## `audio.lua`

Native 0.4.5/0.4.6 physical timing proved that synchronous synthesis shares the game thread even when playback itself sounds correct. The adapter keeps ChipSynth's 44.1 kHz per-sample behavior and changes queue scheduling only. Native 0.4.7 uses 512-sample blocks, 256 buffers and at most two blocks per update. First-use effects are persisted beneath the private removable game prefix as PCM WAV plus a complete canonical synthesis-signature sidecar; the full signature and successful decode are required for a hit.

Rendered effects are ROM-derived private cache. They must never be committed, packaged, logged as bytes or uploaded. Game-cache deletion removes them; saves remain separate.

## `frame.lua`

Installed after upstream `main.lua` defines callbacks. It reports aggregate/average/maximum CPU for `love.update` and `love.draw` plus Lua heap size every five seconds. It does not alter timing or catch/suppress callback errors.
