# Importable Scripting packages

## Current: Gen1Recomp Native 048

- [`Gen1Recomp-Native-048.scripting`](Gen1Recomp-Native-048.scripting)
- Project/version/build: `Gen1Recomp Native 048` / 0.4.8 (048)
- Size: 8,333,969 bytes
- SHA-256: `de7fbce88a51c9e843277a2a142ec310e8dcbe8a4d6ba04fa76379872580413c`
- Entries: 32
- Embedded payload: 5,945,550 bytes / 490 entries / SHA-256 `6ab3a495ecf6619831732eb9022d8da43a4473c958848adffc3a8c39de939943`

Native 0.4.7 physically ran much smoother and more evenly. Its best window rendered 601 frames in 10.017 seconds at p95 20 ms, p99 23 ms and maximum 24 ms. Draw CPU was only 0.15–0.33 ms on late windows; remaining first-run maxima followed named effect stores. Native 047's private effect cache remains compatible with Native 048.

Two new physical defects define Native 048. First, an incoming phone call left an earlier attempt completely frozen. Native 048 pairs hidden/blur with persistence flush and Emscripten main-loop pause, pairs visible/focus/pageshow with resume, and verifies frame progress after 750 ms. Second, the `640×1391` backing was below the iPhone's physical `1320×2868` display and made pixel-art controller prompts look dirty when enlarged.

Native 048 maps CSS points through DPR to a one-to-one physical framebuffer. On the primary device this targets `1320×2868`, with upstream Renderer expected to select fit scale 8. A separate adapter replaces only `TouchControls.draw` with high-resolution vector d-pad, A/B discs and Start/Select capsules. Upstream hit testing, ownership, release/reset, haptics and GB button state are unchanged. The larger framebuffer may increase GPU fill cost, so physical quality and performance are required rather than pre-claimed.

No ROM, generated cache, rendered audio, save or patch is present. `t.__type__` remains open.

## Previous evidence packages

- [`Gen1Recomp-Native-047.scripting`](Gen1Recomp-Native-047.scripting) — near-60 Hz steady motion, named private effect stores, and update/draw attribution.
- [`Gen1Recomp-Native-046.scripting`](Gen1Recomp-Native-046.scripting) — physically fixed full portrait geometry and removed severe repeating stalls.
- [`Gen1Recomp-Native-045.scripting`](Gen1Recomp-Native-045.scripting) — exposed the pre-presentation `1×1` viewport and severe periodic gaps.
- [`Gen1Recomp-Native-044.scripting`](Gen1Recomp-Native-044.scripting) — physically proved ordinary touch play into Oak's Lab.
- [`Gen1Recomp-Native-043.scripting`](Gen1Recomp-Native-043.scripting) — physically reached Yellow title/intro and audible music.
- [`Gen1Recomp-Native-042.scripting`](Gen1Recomp-Native-042.scripting) — attributed queueable-source looping after data load.
- [`Gen1Recomp-Native-041.scripting`](Gen1Recomp-Native-041.scripting) — removed the global-BitOp error.
- [`Gen1Recomp-Native-040.scripting`](Gen1Recomp-Native-040.scripting) — proved canonical Yellow identification and extractor entry.
- [`Gen1Recomp-Native-030.scripting`](Gen1Recomp-Native-030.scripting) — component/inactive-mod management; physical validation pending.
- [`Gen1Recomp-Native-020.scripting`](Gen1Recomp-Native-020.scripting) and [`Gen1Recomp-Preview-014.scripting`](Gen1Recomp-Preview-014.scripting) — physically validated ROM-free runtime paths.

All packages are ROM-free. Verify `SHA256SUMS` before importing.
