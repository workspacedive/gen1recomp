# Importable Scripting packages

## Current: Gen1Recomp Native 040

- [`Gen1Recomp-Native-040.scripting`](Gen1Recomp-Native-040.scripting)
- Project: `Gen1Recomp Native 040`
- Version: 0.4.0
- Build: 040
- Size: 8,320,470 bytes
- SHA-256: `2d6ae25c8e8f6dab55c242270b042d14e1d70a76f8cdb0dbd4d3b829fdaf2c96`
- Entries: 32

Native 0.4.0 adds exact canonical ROM identification, a recoverable private game registry, verified pending-source retention, attractive native game cards, upstream extraction handoff, direct game launch, cache readiness/deletion, and save-file metadata discovery. ROM transfer is a one-use in-memory host command; the runtime removes its temporary Emscripten file before any lifecycle flush and the native source is deleted only after a complete v10 cache is flushed. No ROM, generated game cache, or save content is distributed.

The ROM-free diagnostic and synthetic non-ROM transfer fixture passed Chromium 149 with no page/request/response errors. IDBFS maintenance preserved saves and other games while deleting only the selected cache prefix. These browser checks do **not** prove Scripting `DocumentPicker`, App Group, WebKit persistence, real upstream extraction, game fidelity, lifecycle, audio, or input on a physical device.

## Previous evidence packages

- [`Gen1Recomp-Native-030.scripting`](Gen1Recomp-Native-030.scripting) — 0.3.0 manual component and inactive mod package management; physical validation pending.
- [`Gen1Recomp-Native-020.scripting`](Gen1Recomp-Native-020.scripting) — 0.2.0 native shell; Settings → runtime reached frame 21 on physical iPhone/iOS 18.7.
- [`Gen1Recomp-Preview-014.scripting`](Gen1Recomp-Preview-014.scripting) — physically validated ROM-free runtime preview.

All packages are ROM-free. Verify `SHA256SUMS` before importing.
