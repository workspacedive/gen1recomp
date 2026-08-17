# Importable Scripting packages

## Current: Gen1Recomp Native 046

- [`Gen1Recomp-Native-046.scripting`](Gen1Recomp-Native-046.scripting)
- Project: `Gen1Recomp Native 046`
- Version: 0.4.6
- Build: 046
- Size: 8,328,280 bytes
- SHA-256: `82ff76ce5beacce9075fb4f5388fbe19b760d9f5504e8783d582c12a4ec88a96`
- Entries: 32
- Embedded payload: 5,941,617 bytes / 488 entries / SHA-256 `0e120c4f45bd4ed6134318b55b6cf7e23987bee5977c8f32edd381100ba55050`

Native 0.4.5 physically reported `viewport 1x1 CSS -> 640x640 canvas` before presentation and then `640x640 canvas -> 440x440 CSS`. This exactly explains why its non-stretched surface remained a centered square: Scripting had not presented the WebView when the bundle sampled layout. Native 0.4.6 accepts the game session first, waits for a visible non-placeholder viewport stable for 250 ms, and only then loads the bundle and creates LÖVE's aspect-matched surface.

Native 0.4.5 also measured severe periodic stalls: representative steady p95 intervals were 67–105 ms with 26–52 intervals over 50 ms per ten seconds. That 4–5 Hz cadence closely matches the no-worker path synchronously rendering one 8192-sample music block 5.38 times per second.

Native 0.4.6 preserves ChipSynth programs, sequential engine state and 44.1 kHz sample generation. It changes only queue hand-off granularity to 1024 samples × 128 buffers and uses one slice per update through a minimal configurable integration seam. Direct aggregate music and per-effect synthesis CPU logs accompany the existing RAF telemetry. Smoothness and audio continuity require physical confirmation; they are not pre-claimed.

The independent Scripting `t.__type__` event recurred five seconds before Native 045 successfully started and remains open.

## Previous evidence packages

- [`Gen1Recomp-Native-045.scripting`](Gen1Recomp-Native-045.scripting) — exposed the pre-presentation `1×1` viewport and quantified severe periodic frame gaps.
- [`Gen1Recomp-Native-044.scripting`](Gen1Recomp-Native-044.scripting) — physically proved ordinary touch-controlled play into Oak's Lab.
- [`Gen1Recomp-Native-043.scripting`](Gen1Recomp-Native-043.scripting) — physically reached Yellow title/intro and immediately audible music.
- [`Gen1Recomp-Native-042.scripting`](Gen1Recomp-Native-042.scripting) — physically generated/loaded Yellow data and attributed queueable-source looping.
- [`Gen1Recomp-Native-041.scripting`](Gen1Recomp-Native-041.scripting) — removed the global-BitOp error.
- [`Gen1Recomp-Native-040.scripting`](Gen1Recomp-Native-040.scripting) — proved canonical Yellow identification, retained retry and extractor entry.
- [`Gen1Recomp-Native-030.scripting`](Gen1Recomp-Native-030.scripting) — component/inactive-mod management; physical validation pending.
- [`Gen1Recomp-Native-020.scripting`](Gen1Recomp-Native-020.scripting) and [`Gen1Recomp-Preview-014.scripting`](Gen1Recomp-Preview-014.scripting) — physically validated ROM-free runtime paths.

All packages are ROM-free and contain no extracted game cache or saves. Verify `SHA256SUMS` before importing.
