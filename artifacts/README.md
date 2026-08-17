# Importable Scripting packages

## Current: Gen1Recomp Native 049

- [`Gen1Recomp-Native-049.scripting`](Gen1Recomp-Native-049.scripting)
- Project/version/build: `Gen1Recomp Native 049` / 0.4.9 (049)
- Size: 8,335,740 bytes
- SHA-256: `7127e47a49f894d95aeafaf0a3d02288eabf8f132fbe66b3b5aa81a172b98b64`
- Entries: 32
- Embedded core payload unchanged: 5,945,550 bytes / 490 entries / `6ab3a495ecf6619831732eb9022d8da43a4473c958848adffc3a8c39de939943`

Native 0.4.8 physically proved the intended Retina path: `440×956 CSS -> 1320×2868`, fit scale 8, with late draw averages only 0.09–0.37 ms and steady p95 around 23 ms. It did not retest interruption recovery or provide same-artifact effect-cache hits.

Native 0.4.9 addresses two host-shell issues without changing the core payload. Scripting exposes no API to animate a presented WebView's native navigation title. The host now presents without permanent `navigationTitle` and supplies an in-WebView `Pokémon Yellow` title/black gradient that fades after 3.2 seconds over 0.7 seconds. A top-edge press reveals it again; its close button posts an authenticated session event and calls native `WebViewController.dismiss()`.

The recurring pre-runtime `t.__type__` is now tied to a concrete descriptor mismatch. All five toolbar dictionaries previously contained custom `<ScreenToolbar />` function components, while Scripting's official completed example places a native `<Button>` directly in `toolbar.cancellationAction`. Native 049 removes the wrapper and uses direct Buttons in all five screens. Physical non-recurrence is required before closure.

No ROM, generated cache, rendered audio, save, patch or WAV is present.

## Previous evidence packages

- [`Gen1Recomp-Native-048.scripting`](Gen1Recomp-Native-048.scripting) — physically proved Retina geometry/fit scale 8 without a draw CPU bottleneck.
- [`Gen1Recomp-Native-047.scripting`](Gen1Recomp-Native-047.scripting) — near-60 Hz steady motion and named private effect stores.
- [`Gen1Recomp-Native-046.scripting`](Gen1Recomp-Native-046.scripting) — full portrait geometry and removal of severe periodic stalls.
- [`Gen1Recomp-Native-045.scripting`](Gen1Recomp-Native-045.scripting) — pre-presentation `1×1` viewport and severe periodic gaps.
- [`Gen1Recomp-Native-044.scripting`](Gen1Recomp-Native-044.scripting) — ordinary touch play into Oak's Lab.
- [`Gen1Recomp-Native-043.scripting`](Gen1Recomp-Native-043.scripting) — Yellow title/intro and audible music.
- [`Gen1Recomp-Native-042.scripting`](Gen1Recomp-Native-042.scripting) — queue-loop attribution after data load.
- [`Gen1Recomp-Native-041.scripting`](Gen1Recomp-Native-041.scripting) — global BitOp correction.
- [`Gen1Recomp-Native-040.scripting`](Gen1Recomp-Native-040.scripting) — canonical Yellow and extractor entry.
- [`Gen1Recomp-Native-030.scripting`](Gen1Recomp-Native-030.scripting) — component/mod management predecessor.
- [`Gen1Recomp-Native-020.scripting`](Gen1Recomp-Native-020.scripting) and [`Gen1Recomp-Preview-014.scripting`](Gen1Recomp-Preview-014.scripting) — physical ROM-free runtime paths.

All packages are ROM-free. Verify `SHA256SUMS` before importing.
