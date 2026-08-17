# Importable Scripting packages

## Current: Gen1Recomp Native 043

- [`Gen1Recomp-Native-043.scripting`](Gen1Recomp-Native-043.scripting)
- Project: `Gen1Recomp Native 043`
- Version: 0.4.3
- Build: 043
- Size: 8,322,151 bytes
- SHA-256: `24289a697469ca7bddc49289f6aca42fed2b19ae5f1bf7cf51fe87b5887a111c`
- Entries: 32

Native 0.4.2 exposed the exact hidden failure after canonical Yellow extraction and generated-data/game loading: `Queueable Sources can not be looped.` Native 0.4.3 adds a narrow love.js adapter guard that ignores `setLooping` only for queueable sources, whose chip looping is already owned by ChipSynth, while delegating static/stream looping unchanged. A pinned-love.js functional probe passed both sides of this behavior. Gen1Recomp and LÖVE source remain unchanged.

Native 0.4.3 retains WebView console/error capture and suppresses only the known generic pre-window alert modal after logging it, addressing the repeated disruptive popup. The exact artifact runtime reached ready event frame 15 in Chromium 149 without page/request/HTTP errors.

## Previous evidence packages

- [`Gen1Recomp-Native-042.scripting`](Gen1Recomp-Native-042.scripting) — physically generated and loaded Yellow data/game, then attributed the queueable-source looping failure.
- [`Gen1Recomp-Native-041.scripting`](Gen1Recomp-Native-041.scripting) — removed the explicit global-BitOp error; generic hidden pre-window failure remained.
- [`Gen1Recomp-Native-040.scripting`](Gen1Recomp-Native-040.scripting) — physically proved canonical Yellow identification, pending registration/retry and upstream extractor entry.
- [`Gen1Recomp-Native-030.scripting`](Gen1Recomp-Native-030.scripting) — manual component and inactive mod package management; physical validation pending.
- [`Gen1Recomp-Native-020.scripting`](Gen1Recomp-Native-020.scripting) — Settings → runtime reached frame 21 on physical iPhone/iOS 18.7.
- [`Gen1Recomp-Preview-014.scripting`](Gen1Recomp-Preview-014.scripting) — physically validated ROM-free runtime preview.

All packages are ROM-free and contain no extracted game cache or saves. Verify `SHA256SUMS` before importing.
