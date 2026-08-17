# Importable Scripting packages

## Current: Gen1Recomp Native 052

- [`Gen1Recomp-Native-052.scripting`](Gen1Recomp-Native-052.scripting)
- Project/version/build: `Gen1Recomp Native 052` / 0.5.2 (052)
- Size: 8,345,737 bytes
- SHA-256: `e86c6b908c24bae7541d329430e092db269ab75ec40611feacf01ba3a25f67c0`
- Entries: 33
- Embedded core unchanged: 5,945,550 bytes / 490 entries / `6ab3a495ecf6619831732eb9022d8da43a4473c958848adffc3a8c39de939943`

Native 051 physically proved readiness-bound 5.5-second title reveal, frame 8 startup, Retina `1320×2868` and game load, but `t.__type__` still occurred once. This disproves Native 050's flattened legacy TabView child tree as the complete correction.

Native 052 migrates root navigation to the current official App Store iOS-18+ API: `TabView` binds a typed Observable selection and directly owns five explicit native `Tab` descriptors, each containing one `NavigationStack`. Legacy `tabIndex`, `onTabIndexChanged`, `tag` and `tabItem` root properties are absent. The valid direct native toolbar Buttons remain unchanged. This is a physical candidate, not a claimed root-cause closure.

Native 051 save refresh, slot launch, integrity backup/restore/delete, post-ready title/native close, Retina vectors, interruption recovery, manual components and mods remain included. Core/runtime component bytes are unchanged.

Both TypeScript targets, 122/122 Node tests, 30 executed Python tests (5 environment skips), deterministic rebuild, ZIP integrity and npm audit 0 pass. No ROM, generated cache, rendered audio, save, user backup, patch or WAV is present.

## Previous evidence packages

- [`Gen1Recomp-Native-051.scripting`](Gen1Recomp-Native-051.scripting) — post-ready title timing passed; flattened legacy TabView tree did not stop `t.__type__`; save operations remain untested.
- [`Gen1Recomp-Native-050.scripting`](Gen1Recomp-Native-050.scripting) — introduced post-ready title and flattened legacy TabView descriptors.
- [`Gen1Recomp-Native-049.scripting`](Gen1Recomp-Native-049.scripting) — removed native title, but custom fade completed too early and `t.__type__` persisted.
- [`Gen1Recomp-Native-048.scripting`](Gen1Recomp-Native-048.scripting) — physically proved Retina geometry/scale 8 without draw bottleneck.
- [`Gen1Recomp-Native-047.scripting`](Gen1Recomp-Native-047.scripting) — near-60 Hz motion and named effect stores.
- [`Gen1Recomp-Native-046.scripting`](Gen1Recomp-Native-046.scripting) — full portrait geometry and severe-stall removal.
- [`Gen1Recomp-Native-045.scripting`](Gen1Recomp-Native-045.scripting) — exact `1×1` viewport attribution.
- [`Gen1Recomp-Native-044.scripting`](Gen1Recomp-Native-044.scripting) — ordinary touch play into Oak's Lab.
- Older retained packages remain checksum-indexed below.

All packages are ROM-free. Verify `SHA256SUMS` before importing.
