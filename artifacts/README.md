# Importable Scripting packages

## Current: Gen1Recomp Native 050

- [`Gen1Recomp-Native-050.scripting`](Gen1Recomp-Native-050.scripting)
- Project/version/build: `Gen1Recomp Native 050` / 0.5.0 (050)
- Size: 8,336,003 bytes
- SHA-256: `dba920d60b0ccb50e68a14d1007afa207c5234dbffb82257b21e4d403783a62b`
- Entries: 32
- Embedded core unchanged: 5,945,550 bytes / 490 entries / `6ab3a495ecf6619831732eb9022d8da43a4473c958848adffc3a8c39de939943`

Native 0.4.9 removed the persistent native title but its custom 3.2-second fade elapsed during runtime startup, so the user saw no replacement. Native 0.5.0 keeps custom chrome hidden through startup, reveals it after runtime readiness for 5.5 seconds, then fades opacity, upward translation and blur over 0.9 seconds. A top-edge press reveals it for 3.2 seconds; token-bound native dismiss remains.

`t.__type__` also persisted after direct toolbar Buttons, disproving that as the complete cause. Native 050 corrects the stronger root-tree mismatch: `TabView` now has five immediate native tagged `NavigationStack` descriptors. Custom screen functions are ordinary children inside those stacks rather than direct tab descriptors carrying unforwarded `tag`/`tabItem` props. Direct toolbar Buttons remain.

Retina `1320×2868`, vector controls, interruption recovery, private effect cache, updates and mods remain included. Core/system component bytes are unchanged because this is a host-shell release.

No ROM, generated cache, rendered audio, save, patch or WAV is present.

## Previous evidence packages

- [`Gen1Recomp-Native-049.scripting`](Gen1Recomp-Native-049.scripting) — removed native title, but custom fade completed too early and `t.__type__` persisted.
- [`Gen1Recomp-Native-048.scripting`](Gen1Recomp-Native-048.scripting) — physically proved Retina geometry/scale 8 without draw bottleneck.
- [`Gen1Recomp-Native-047.scripting`](Gen1Recomp-Native-047.scripting) — near-60 Hz motion and named effect stores.
- [`Gen1Recomp-Native-046.scripting`](Gen1Recomp-Native-046.scripting) — full portrait geometry and severe-stall removal.
- [`Gen1Recomp-Native-045.scripting`](Gen1Recomp-Native-045.scripting) — exact `1×1` viewport attribution.
- [`Gen1Recomp-Native-044.scripting`](Gen1Recomp-Native-044.scripting) — ordinary touch play into Oak's Lab.
- Older retained packages remain checksum-indexed below.

All packages are ROM-free. Verify `SHA256SUMS` before importing.
