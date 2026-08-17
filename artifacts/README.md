# Importable Scripting packages

## Current: Gen1Recomp Native 044

- [`Gen1Recomp-Native-044.scripting`](Gen1Recomp-Native-044.scripting)
- Project: `Gen1Recomp Native 044`
- Version: 0.4.4
- Build: 044
- Size: 8,322,573 bytes
- SHA-256: `a718337d58493fb12f4578eec7a85037b6824893da05996b99d8f068b3501feb`
- Entries: 32

Native 0.4.3 physically reached the canonical Yellow title/intro with immediately audible music and no queue-loop error or generic modal. On-screen controls were absent because love.js reports `Web`, while upstream enables its overlay only on Android/iOS or through `POKEPORT_TOUCH=1`.

Native 0.4.4 sets that upstream-documented override for game sessions, retaining LÖVE's existing touch callbacks and upstream D-pad/A/B/Start/Select implementation. No browser-side duplicate controls or emulator input layer is added. A browser game-session probe confirmed the exact artifact supplies `POKEPORT_TOUCH=1` and `POKEPORT_GAME=yellow` to the runtime.

Native 0.4.4 also avoids rebuilding the transient native working tree immediately before WebView presentation, the transition correlated with every physical `t.__type__` component-build event.

## Previous evidence packages

- [`Gen1Recomp-Native-043.scripting`](Gen1Recomp-Native-043.scripting) — physically reached Yellow title/intro and immediately audible music.
- [`Gen1Recomp-Native-042.scripting`](Gen1Recomp-Native-042.scripting) — physically generated/loaded Yellow data and attributed queueable-source looping.
- [`Gen1Recomp-Native-041.scripting`](Gen1Recomp-Native-041.scripting) — removed the global-BitOp error.
- [`Gen1Recomp-Native-040.scripting`](Gen1Recomp-Native-040.scripting) — proved canonical Yellow identification, retained retry and extractor entry.
- [`Gen1Recomp-Native-030.scripting`](Gen1Recomp-Native-030.scripting) — component/inactive-mod management; physical validation pending.
- [`Gen1Recomp-Native-020.scripting`](Gen1Recomp-Native-020.scripting) and [`Gen1Recomp-Preview-014.scripting`](Gen1Recomp-Preview-014.scripting) — physically validated ROM-free runtime paths.

All packages are ROM-free and contain no extracted game cache or saves. Verify `SHA256SUMS` before importing.
