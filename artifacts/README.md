# Importable Scripting packages

## Current: Gen1Recomp Native 042

- [`Gen1Recomp-Native-042.scripting`](Gen1Recomp-Native-042.scripting)
- Project: `Gen1Recomp Native 042`
- Version: 0.4.2
- Build: 042
- Size: 8,321,442 bytes
- SHA-256: `b111e878c8dfd93065ceeb6f3dcee1e467e7b398ce598d607b0d1763a8d293f5`
- Entries: 32

Native 0.4.0 physically reached canonical Yellow extraction and exposed the missing LuaJIT global BitOp semantic. Native 0.4.1 installed the tested shim globally and removed that explicit error, but love.js then showed a generic pre-window alert while its underlying browser-console error remained invisible to Scripting. Native 0.4.2 preserves the BitOp fix and forwards bounded WebView console warnings/errors, Error stacks, and alerts through the native message bridge for exact attribution. It does not guess at the hidden failure.

The exact Native 0.4.2 ROM-free runtime reached ready event frame 18 in Chromium 149 with no page/request/HTTP errors. Chromium also proved forwarding for a console warning, console-error fixture, and alert fixture. This verifies diagnostic transport, not canonical extraction completion.

## Previous evidence packages

- [`Gen1Recomp-Native-041.scripting`](Gen1Recomp-Native-041.scripting) — removed the explicit global-BitOp error physically; generic hidden pre-window failure remained.
- [`Gen1Recomp-Native-040.scripting`](Gen1Recomp-Native-040.scripting) — physically proved canonical Yellow identification, pending registration/retry and upstream extractor entry.
- [`Gen1Recomp-Native-030.scripting`](Gen1Recomp-Native-030.scripting) — manual component and inactive mod package management; physical validation pending.
- [`Gen1Recomp-Native-020.scripting`](Gen1Recomp-Native-020.scripting) — Settings → runtime reached frame 21 on physical iPhone/iOS 18.7.
- [`Gen1Recomp-Preview-014.scripting`](Gen1Recomp-Preview-014.scripting) — physically validated ROM-free runtime preview.

All packages are ROM-free and contain no extracted game cache or saves. Verify `SHA256SUMS` before importing.
