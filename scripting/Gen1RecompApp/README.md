# Gen1Recomp Native 052

Native Scripting product iteration built on the physically validated Preview 0.1.4 runtime and the operational Native 0.4.x game path. Native 0.4.0–0.4.8 physically proved canonical Yellow play, Retina `1320×2868`/scale 8 and near-60 Hz motion. Native 0.5.0 moved animated game chrome behind runtime readiness and corrected the root TabView descriptor tree. Native 0.5.1 added native save-slot launch plus lossless, integrity-bound backup, restore, refresh and delete operations. Native 0.5.2 migrates the root navigation to the current documented iOS-18+ `TabView` + native `Tab` + observable-selection API after physical evidence disproved the flattened legacy tree as the complete `t.__type__` correction.

## Native control plane

- adaptive Home, Games, Updates, Mods, and Settings tabs;
- centralized German/English strings and explicit loading/working/error states;
- persistent private game, component, and mod registries with recovery copies;
- manual-only system and mod network checks;
- non-ephemeral WebView used only for the LÖVE/Lua game plane, private IDBFS maintenance and ROM-free diagnostic.

Native 052's root is five explicit native `Tab` descriptors under `TabView selection={...}`. Selection is a typed `Observable<ProductTabId>` and Home → Games uses `setValue("games")`. Each Tab owns one `NavigationStack`. The legacy `tag`/`tabItem`/callback path is absent. This matches the current official App Store documentation but remains a physical `t.__type__` hypothesis until a device run proves non-recurrence.

## Verified game import

The Games tab:

1. obtains one user-selected file through `DocumentPicker`;
2. rejects every size except exact 1 MiB Red/Blue/Yellow or exact 2 MiB Gold;
3. computes SHA-1 with Scripting's native `Crypto.sha1` and accepts only the canonical identities in `src/domain/games.ts`;
4. writes and re-verifies a fixed-name private staging/source copy without persisting the external path;
5. records only canonical identity metadata in a strict registry;
6. injects a one-use ROM into love.js before Lua starts, using upstream's `POKEPORT_IMPORT_ROM` boundary;
7. lets upstream Gen1Recomp verify the hash again and extract its versioned cache;
8. flushes IDBFS, reports the completion marker to native code, and deletes both transient runtime transfer and retained native ROM copy.

Interrupted imports retain the verified private source for retry. Startup removes stale transfer sessions and orphaned sources. No ROM bytes, ROM-derived generated cache, user save, or external path are packaged, logged, committed, or uploaded.

Ready cards launch with upstream `--game=<id>` and skip the LÖVE launcher. A selected numbered save adds the existing upstream `--slot=<id>` launch option; legacy saves retain the default migration path. Cards show stable/beta support, cache state, canonical digest prefix and discovered save metadata. Removing a game clears its versioned extracted cache and registration while deliberately preserving saves.

## Save backup and recovery

Save contents remain owned by Gen1Recomp in love.js IDBFS. The native plane only performs strict, user-initiated maintenance through `runtime-v052/maintenance.js`:

- **Refresh** enumerates only canonical flat/numbered save paths and exports size/timestamp metadata.
- **Play slot** sends the canonical slot ID through upstream's existing launch option.
- **Backup** reads the first physically available record in main → `.tmp` → `.bak` order, verifies browser and native SHA-256, wraps it in a closed `org.gen1recomp.save-backup` JSON envelope and invokes `DocumentPicker.exportFiles`. This proves transport integrity, not Lua-save semantics.
- **Restore** validates game, slot, size, UTF-8 JSON, Base64 and SHA-256 natively and again in WebKit. One IndexedDB transaction preserves an existing `.bak`; only when none exists does it copy current main to `.bak`. It then replaces main and clears stale `.tmp`; readback must match before the registry summary changes.
- **Delete** requires explicit confirmation and removes only the selected main/`.bak`/`.tmp` family. The core's slot registry is retained so the empty slot can be reused or restored.

The host never parses, edits or claims semantic knowledge of the Lua save table. On the next launch, Gen1Recomp's restricted serializer/validator and recovery order remain authoritative. Raw cartridge `.sav` conversion remains a separately versioned core capability and is not imitated in TypeScript.

## Runtime boundary

`runtime-v052/` is the packaged fallback. `runtime-shell-v052/` materializes updated system component sets. A strict one-use in-memory host session carries game/slot command and, only during first import, verified ROM bytes. The loader waits for stable non-placeholder WebView geometry before loading LÖVE. A separate maintenance page operates only on allowlisted IDBFS records and never presents game UI.

Before LÖVE creates its window, the host wrapper applies visible WebView aspect and DPR-native framebuffer. A visual adapter replaces only `TouchControls.draw`; input remains upstream. The game WebView has no persistent native title. A semantic in-WebView header appears after runtime readiness, holds 5.5 seconds, fades over 0.9 seconds, can be revealed from the top edge, and dismisses through a native script-message handler.

The no-worker audio adapter keeps ChipSynth programs, 44.1 kHz sample rate and sequential engine state. Private first-use PCM cache remains under the per-game cache prefix and is excluded from packages and Git.

The implementation does not emulate Game Boy hardware. The path remains ROM → upstream importer/extractor → private generated cache → Gen1Recomp Lua logic → LÖVE/love.js rendering, audio, and input.

## Components and mods

LÖVE/Lua runtime and Gen1Recomp core remain separately versioned, manually installable, verified, staged, recoverable and rollback-capable. Native 0.5.2 intentionally leaves the packaged core at integration component 0.5.0; the upstream 0.1.99 release detected on 2026-08-17 is evaluated as a separate component update, not silently folded into this host release. Mods remain a separate inactive-by-default package-management domain.

## Evidence status

- Scripting `DocumentPicker.pickFiles/exportFiles`, `Data.fromBase64String/fromRawString/toRawString`, `Crypto.sha256` and `WebViewController` contracts were checked against current official documentation;
- fake IndexedDB tests execute list/read/restore/delete behavior against love.js schema 21 and prove numeric ordering, digest binding, `.bak` preservation and cache/save scope separation;
- domain, package, runtime, updater, mod and tooling checks are automated;
- Native 0.5.1 physically passed runtime identity, readiness-bound title reveal, frame 8, Yellow game load and Retina geometry; `t.__type__` still recurred once;
- Native 0.5.2 modern tabs and Files picker, backup round trip, selected slot launch and deletion require real Scripting 3.2.0/iOS device evidence. No static test is reported as host E2E proof.
