# Native 0.5.1 / Build 051 — Save backup and slot launch specification

**Status:** implementation specification, 2026-08-17.

## Goal

Add a native, lossless save-management slice without moving game state into the Scripting control plane or changing the Gen1Recomp core. A player can launch a discovered slot explicitly, export a private integrity-bound backup through the iOS Files picker, restore that backup transactionally, and delete only one save after an explicit confirmation.

## Non-goals

- No Game Boy CPU, bus, PPU, cartridge hardware or emulator implementation.
- No parsing or editing of save gameplay state in TypeScript/JavaScript.
- No silent background export, iCloud upload or network transfer.
- No raw cartridge `.sav` conversion in the host. That remains Gen1Recomp core behavior and requires a separately versioned integration path.
- No core, LÖVE, payload, mod or component-catalog update in this host release.

## Host and data flow

Target host: the existing finite native Scripting page, with hidden non-ephemeral `WebViewController` maintenance documents for access to love.js IDBFS.

```text
private IDBFS save record
→ strict maintenance operation and game/slot path allowlist
→ byte count + SHA-256 + base64 result
→ native strict backup envelope
→ user-initiated DocumentPicker.exportFiles
```

Restore runs the reverse validation twice (native and maintenance document), preserves an existing `.bak` (or copies current main there only when no recovery copy exists), writes the requested bytes as new main, removes stale `.tmp`, and completes in one IndexedDB transaction. Gen1Recomp's existing restricted decoder and main → `.tmp` → `.bak` semantic recovery remain authoritative on next load.

Delete removes only the selected main/`.bak`/`.tmp` save records after native confirmation. It does not delete ROM-derived cache, other slots, options, mods or game registration. The core slot registry remains intact so an empty slot can be reused and a matching backup can be restored.

## UI states

- existing loading/content/empty/error states;
- `refreshing`, `exporting`, `restoring`, and `deleting-save` mutation stages;
- in-place cards remain mounted while maintenance runs;
- every discovered save exposes explicit Play, Backup and Delete actions;
- each game card exposes Restore Backup and Refresh Saves actions.

## Validation and limits

- game IDs: `red|blue|yellow|gold` only;
- save IDs: `legacy` or `slot[1-9][0-9]*` only;
- maximum 128 discovered saves per game;
- backup schema is closed and versioned;
- backup SHA-256 proves byte transport integrity; only Gen1Recomp can prove semantic save validity on load;
- decoded save payload must be 1..8 MiB;
- lowercase SHA-256 must match in native code and again in the maintenance document;
- backup game and slot identity cannot be overridden by UI state;
- no path from the backup is used directly;
- backup filename is generated from canonical game/slot IDs and UTC time.

## Permissions and side effects

- Reading/restoring/deleting touches only Scripting's private non-ephemeral WebView IDBFS.
- Export presents the system Files exporter only after an explicit tap.
- Restore presents the system Files picker only after an explicit tap and releases security-scoped access in `finally`.
- No network, Photos, Contacts, location, microphone, clipboard or background permission is added.

## Done contract

1. Slot-specific launch emits `--slot=<canonical id>` and legacy launch preserves the existing path.
2. Maintenance protocol rejects unknown operations, game IDs, save IDs, oversized data, digest mismatches and unsafe paths.
3. Exported envelopes are strict, integrity-bound, ROM-free and contain only one selected save.
4. Restore is a single read/write transaction with `.bak` preservation and verified readback metadata.
5. Delete is explicitly confirmed and scoped to one save family.
6. Save summaries sort numerically (`slot2` before `slot10`) and reject malformed timestamps.
7. Both TypeScript targets, Node/Python suites, package structure, deterministic rebuild, ZIP integrity and exclusion checks pass.
8. Real Scripting 3.2.0 / iOS device behavior remains explicitly pending until the 051 artifact is imported and run.

## Evidence sources

- Exact packaged Gen1Recomp `src/core/SaveData.lua` and `src/core/LaunchOptions.lua`: numbered slot paths, `--slot`, active selection, crash recovery and `.bak` semantics.
- Exact pinned love.js 11.5 `IDBFS`: database `/home/web_user`, schema version 21, store `FILE_DATA`, records with `timestamp`, `mode`, and `contents`.
- Scripting official `DocumentPicker`: `pickFiles`, `exportFiles({ files: [{ data, name }] })`, and security-scoped release.
- Scripting official `Data`: `fromBase64String`, `fromRawString`, `toRawString`, byte size and SHA conversion.
- Apple HIG File management: use familiar system file interfaces and preserve work unless the user explicitly deletes it.
