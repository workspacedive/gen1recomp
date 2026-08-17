# Importable Scripting packages

## Current: Gen1Recomp Native 047

- [`Gen1Recomp-Native-047.scripting`](Gen1Recomp-Native-047.scripting)
- Project: `Gen1Recomp Native 047`
- Version/build: 0.4.7 (047)
- Size: 8,330,715 bytes
- SHA-256: `68077463086b37df5cc82bb3829b3a33fca444ed093bceeb6f194de14491620a`
- Entries: 32
- Embedded payload: 5,943,885 bytes / 489 entries / SHA-256 `f6a11c06cc68485481764942070c468c7597e2f6bddb649489cbddc9c59c64dd`

Native 0.4.6 physically fixed the viewport: Scripting exposed `440×956`, the host selected `640×1391`, and CSS uniformly filled `439.84375×956`. It also materially improved game motion. Three late steady windows reached p95 23–25 ms, maximum 31–37 ms and zero gaps over 50 ms, versus Native 045's p95 67–105 ms and up to 52 severe gaps per ten seconds.

Audible sound was not defective. Direct timing nevertheless proved that synchronous synthesis shares the game/render thread: music consumed 632–2918 ms CPU per five seconds, individual 1024-sample calls reached 23 ms, and first-use static effects reached 106–412 ms. Several 223/267/250 ms effects aligned with 236/278/262 ms RAF maxima.

Native 0.4.7 keeps 44.1 kHz ChipSynth semantics but distributes music as 512-sample slices with at most two per update. First-use effects are stored as private PCM WAV entries under the removable game cache. Every cache filename has a sidecar containing the full canonical synthesis signature; hash collision, changed definition or decode failure falls back to synthesis. The first run can still hitch while storing; a second run should report `cache=hit` and avoid ChipSynth effect generation. Update and draw CPU are now measured separately.

No ROM, generated cache, rendered audio, save or patch is present in the artifact. The independent Scripting `t.__type__` event occurred twice before Native 046 successfully started and remains open.

## Previous evidence packages

- [`Gen1Recomp-Native-046.scripting`](Gen1Recomp-Native-046.scripting) — physically fixed full portrait geometry and removed the severe repeating frame cadence.
- [`Gen1Recomp-Native-045.scripting`](Gen1Recomp-Native-045.scripting) — exposed the pre-presentation `1×1` viewport and quantified severe periodic frame gaps.
- [`Gen1Recomp-Native-044.scripting`](Gen1Recomp-Native-044.scripting) — physically proved ordinary touch-controlled play into Oak's Lab.
- [`Gen1Recomp-Native-043.scripting`](Gen1Recomp-Native-043.scripting) — physically reached Yellow title/intro and immediately audible music.
- [`Gen1Recomp-Native-042.scripting`](Gen1Recomp-Native-042.scripting) — physically generated/loaded Yellow data and attributed queueable-source looping.
- [`Gen1Recomp-Native-041.scripting`](Gen1Recomp-Native-041.scripting) — removed the global-BitOp error.
- [`Gen1Recomp-Native-040.scripting`](Gen1Recomp-Native-040.scripting) — proved canonical Yellow identification, retained retry and extractor entry.
- [`Gen1Recomp-Native-030.scripting`](Gen1Recomp-Native-030.scripting) — component/inactive-mod management; physical validation pending.
- [`Gen1Recomp-Native-020.scripting`](Gen1Recomp-Native-020.scripting) and [`Gen1Recomp-Preview-014.scripting`](Gen1Recomp-Preview-014.scripting) — physically validated ROM-free runtime paths.

All packages are ROM-free. Verify `SHA256SUMS` before importing.
