# Importable Scripting packages

## Current: Gen1Recomp Native 041

- [`Gen1Recomp-Native-041.scripting`](Gen1Recomp-Native-041.scripting)
- Project: `Gen1Recomp Native 041`
- Version: 0.4.1
- Build: 041
- Size: 8,320,895 bytes
- SHA-256: `15cd150c81479071cf9a2b9453c38531f13c6e8708cebec43434b62a7176d1d0`
- Entries: 32

Native 0.4.1 is the immediate extraction regression build. Native 0.4.0 physically accepted canonical Yellow on Scripting 3.2.0/iOS 26.6, persisted its pending card across retries, handed it to love.js, and reached upstream extraction. Extraction then failed at `src/import/Rom.lua:198` because LuaJIT's global `bit` semantic was missing in PUC Lua. Native 0.4.1 installs the existing 9,492-comparison BitOp shim as `_G.bit` before upstream main loads. No Gen1Recomp core or LÖVE source is modified.

The exact Native 0.4.1 ROM-free runtime reached ready frame 97 in Chromium 149 without page/request/HTTP errors. This verifies corrected bootstrap startup, not canonical-ROM extraction; the physical **Finish Import** regression remains required. The card status now uses a separate row to improve the narrow physical layout.

## Previous evidence packages

- [`Gen1Recomp-Native-040.scripting`](Gen1Recomp-Native-040.scripting) — 0.4.0 physically proved canonical Yellow identification, pending registration/retry and upstream extractor entry, then failed on the now-corrected missing global BitOp.
- [`Gen1Recomp-Native-030.scripting`](Gen1Recomp-Native-030.scripting) — 0.3.0 manual component and inactive mod package management; physical validation pending.
- [`Gen1Recomp-Native-020.scripting`](Gen1Recomp-Native-020.scripting) — 0.2.0 native shell; Settings → runtime reached frame 21 on physical iPhone/iOS 18.7.
- [`Gen1Recomp-Preview-014.scripting`](Gen1Recomp-Preview-014.scripting) — physically validated ROM-free runtime preview.

All packages are ROM-free and contain no extracted game cache or saves. Verify `SHA256SUMS` before importing.
