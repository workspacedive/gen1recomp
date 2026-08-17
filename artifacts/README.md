# Importable Scripting packages

## Current: Gen1Recomp Native 045

- [`Gen1Recomp-Native-045.scripting`](Gen1Recomp-Native-045.scripting)
- Project: `Gen1Recomp Native 045`
- Version: 0.4.5
- Build: 045
- Size: 8,325,762 bytes
- SHA-256: `f0f73aa281c506bdd070651d88cdce996f1050a2812adb439e8c9504c58bef10`
- Entries: 32
- Embedded payload: 5,940,145 bytes / 487 entries / SHA-256 `da5390b392b5b005abf36872920d119f5b15265867b71100e826691a62f55cd9`

Native 0.4.4 physically proved visible and functional upstream D-pad/A/B/Start/Select controls through ordinary Yellow play into Oak's Lab. That run also established the next defects: the fixed 1024×768 canvas made the game and controls too small, showed less field than the `.ipa`, and stuttered strongly in Oak's introduction, naming, overworld and battles. The separate Scripting `t.__type__` event recurred before successful runtime startup, so it is not claimed fixed.

Native 0.4.5 keeps the upstream renderer and touch controls. A generated host `conf.lua` wrapper supplies an aspect-matched, bounded backing surface before window creation: integer game scale 4 on phone viewports and 5 on tablet viewports, with the long edge left to Gen1Recomp's expanded-world renderer. The canvas is uniformly contained by the WebView rather than stretched. This geometry is intended to enlarge the existing controls and fill the available view without multiplying fill rate by Retina DPR.

Raw ten-second RAF interval distributions, gap counts, Long Tasks data when supported, visibility, runtime frame, CSS viewport, backing dimensions and DPR are logged. Native 0.4.5 is therefore a physical adaptive-viewport and measurement candidate; it does **not** claim that stutter is already corrected.

## Previous evidence packages

- [`Gen1Recomp-Native-044.scripting`](Gen1Recomp-Native-044.scripting) — physically proved ordinary touch-controlled play into Oak's Lab and exposed scaling/stutter defects.
- [`Gen1Recomp-Native-043.scripting`](Gen1Recomp-Native-043.scripting) — physically reached Yellow title/intro and immediately audible music.
- [`Gen1Recomp-Native-042.scripting`](Gen1Recomp-Native-042.scripting) — physically generated/loaded Yellow data and attributed queueable-source looping.
- [`Gen1Recomp-Native-041.scripting`](Gen1Recomp-Native-041.scripting) — removed the global-BitOp error.
- [`Gen1Recomp-Native-040.scripting`](Gen1Recomp-Native-040.scripting) — proved canonical Yellow identification, retained retry and extractor entry.
- [`Gen1Recomp-Native-030.scripting`](Gen1Recomp-Native-030.scripting) — component/inactive-mod management; physical validation pending.
- [`Gen1Recomp-Native-020.scripting`](Gen1Recomp-Native-020.scripting) and [`Gen1Recomp-Preview-014.scripting`](Gen1Recomp-Preview-014.scripting) — physically validated ROM-free runtime paths.

All packages are ROM-free and contain no extracted game cache or saves. Verify `SHA256SUMS` before importing.
