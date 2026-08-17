# Importable Scripting packages

## Current: Gen1Recomp Native 053

- [`Gen1Recomp-Native-053.scripting`](Gen1Recomp-Native-053.scripting)
- Project/version/build: `Gen1Recomp Native 053` / 0.5.3 (053)
- Size: 8,346,167 bytes
- SHA-256: `3cdef5e264e236ed70705ceac041fae48b3c3489e7f0e50341c5adc9daf7b0a4`
- Entries: 33
- Embedded core unchanged: 5,945,550 bytes / 490 entries / `6ab3a495ecf6619831732eb9022d8da43a4473c958848adffc3a8c39de939943`

Native 052 physically rendered all five modern tabs and reached Yellow/Retina/title readiness, but `t.__type__` recurred once. Tab descriptor shape is therefore not the complete cause. Native 053 removes all five toolbar dictionaries, acquires one root dismiss callback and retains explicit close through five ordinary native List Buttons.

Native 053 also fixes the screenshot's misleading “Noch kein Spiel importiert” text. Home now models loading/content/error and distinguishes a genuinely empty loaded registry from ready, imported-not-ready, pending-extraction and reimport-required games. The successful Yellow launch proves that the 052 label alone was not evidence of deleted private game data.

Modern tabs, save refresh/slot/backup/restore/delete, post-ready title, Retina vectors, interruption recovery, manual components and mods remain included. Core/runtime component bytes are unchanged.

Both TypeScript targets, 123/123 Node tests, 30 executed Python tests (5 environment skips), deterministic rebuild, ZIP integrity and npm audit 0 pass. No ROM, generated cache, rendered audio, save, user backup, patch or WAV is present.

## Previous evidence packages

- [`Gen1Recomp-Native-052.scripting`](Gen1Recomp-Native-052.scripting) — modern tabs rendered correctly but did not stop `t.__type__`; Home conflated zero ready games with an empty library.
- [`Gen1Recomp-Native-051.scripting`](Gen1Recomp-Native-051.scripting) — post-ready title timing passed; flattened legacy TabView tree did not stop `t.__type__`; save operations remain untested.
- [`Gen1Recomp-Native-050.scripting`](Gen1Recomp-Native-050.scripting) — introduced post-ready title and flattened legacy TabView descriptors.
- [`Gen1Recomp-Native-049.scripting`](Gen1Recomp-Native-049.scripting) — removed native title, but custom fade completed too early and `t.__type__` persisted.
- [`Gen1Recomp-Native-048.scripting`](Gen1Recomp-Native-048.scripting) — physically proved Retina geometry/scale 8 without draw bottleneck.
- [`Gen1Recomp-Native-047.scripting`](Gen1Recomp-Native-047.scripting) — near-60 Hz motion and named effect stores.
- Older retained packages remain checksum-indexed below.

All packages are ROM-free. Verify `SHA256SUMS` before importing.
