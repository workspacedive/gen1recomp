# Importable Scripting packages

## Current: Gen1Recomp Native 051

- [`Gen1Recomp-Native-051.scripting`](Gen1Recomp-Native-051.scripting)
- Project/version/build: `Gen1Recomp Native 051` / 0.5.1 (051)
- Size: 8,345,651 bytes
- SHA-256: `6ab5468aac85c3e125e708dfb0b9c19dd361943add5008c95463e0172180e9cc`
- Entries: 33
- Embedded core unchanged: 5,945,550 bytes / 490 entries / `6ab3a495ecf6619831732eb9022d8da43a4473c958848adffc3a8c39de939943`

Native 0.5.1 retains the 050 post-ready title, top-edge reveal, native close and direct native TabView-child correction. It adds native save refresh, exact numbered-slot launch, integrity-bound Files backup/export, double-validated transactional restore that never overwrites an existing `.bak`, and explicitly confirmed per-save deletion. The host never parses gameplay state or imitates raw cartridge `.sav` conversion.

The fake-IDBFS suite executes list/read/restore/delete against love.js schema 21 and proves numeric slot order, unsafe-ID rejection, SHA-256 binding, recovery-copy preservation and cache/save scope separation. Both TypeScript targets, 122/122 Node tests, 30 executed Python tests (5 environment skips), deterministic rebuild, ZIP integrity and npm audit 0 pass. Physical Scripting Files/restore/selected-slot behavior remains pending.

No ROM, generated cache, rendered audio, save, user backup, patch or WAV is present.

## Previous evidence packages

- [`Gen1Recomp-Native-050.scripting`](Gen1Recomp-Native-050.scripting) — post-ready title and direct native TabView descriptors; physical result still pending.
- [`Gen1Recomp-Native-049.scripting`](Gen1Recomp-Native-049.scripting) — removed native title, but custom fade completed too early and `t.__type__` persisted.
- [`Gen1Recomp-Native-048.scripting`](Gen1Recomp-Native-048.scripting) — physically proved Retina geometry/scale 8 without draw bottleneck.
- [`Gen1Recomp-Native-047.scripting`](Gen1Recomp-Native-047.scripting) — near-60 Hz motion and named effect stores.
- [`Gen1Recomp-Native-046.scripting`](Gen1Recomp-Native-046.scripting) — full portrait geometry and severe-stall removal.
- [`Gen1Recomp-Native-045.scripting`](Gen1Recomp-Native-045.scripting) — exact `1×1` viewport attribution.
- [`Gen1Recomp-Native-044.scripting`](Gen1Recomp-Native-044.scripting) — ordinary touch play into Oak's Lab.
- Older retained packages remain checksum-indexed below.

All packages are ROM-free. Verify `SHA256SUMS` before importing.
