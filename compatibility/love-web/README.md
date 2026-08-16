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
