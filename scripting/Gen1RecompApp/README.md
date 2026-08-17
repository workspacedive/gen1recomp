# Gen1Recomp Native 050

Native Scripting product iteration built on the physically validated Preview 0.1.4 runtime and Native 0.2.0 diagnostic path. Native 0.4.0 added the first operational game-library vertical slice and physically reached canonical Yellow extraction; completed extraction and gameplay remain under iterative device validation.

Native 0.4.0–0.4.8 physically proved canonical Yellow play, Retina `1320×2868`/scale 8 and near-60 Hz motion. Native 0.4.9 removed native title chrome but faded its replacement during startup and did not eliminate `t.__type__`. Native 0.5.0 reveals animated chrome only after runtime readiness and makes five native tagged NavigationStacks the direct TabView descriptor children, with custom screen content nested beneath them.

## Native control plane

- adaptive Home, Games, Updates, Mods, and Settings tabs;
- centralized German/English strings and explicit loading/working/error states;
- persistent private game, component, and mod registries with recovery copies;
- manual-only system and mod network checks;
- non-ephemeral WebView used only for the LÖVE/Lua game plane and ROM-free diagnostic.

## Verified game import

The Games tab now:

1. obtains one user-selected file through `DocumentPicker`;
2. rejects every size except exact 1 MiB Red/Blue/Yellow or exact 2 MiB Gold;
3. computes SHA-1 with Scripting's native `Crypto.sha1` and accepts only the canonical identities in `src/domain/games.ts`;
4. writes and re-verifies a fixed-name private staging/source copy without persisting the external path;
5. records only canonical identity metadata in a strict registry;
6. injects a one-use ROM into love.js before Lua starts, using the upstream `POKEPORT_IMPORT_ROM` boundary;
7. lets upstream Gen1Recomp verify the hash again and extract its versioned cache;
8. flushes IDBFS, reports the completion marker to native code, and deletes both transient runtime transfer and retained native ROM copy.

Interrupted imports retain the verified private source for retry. Startup removes stale transfer sessions and orphaned sources. No ROM bytes, ROM-derived generated cache, user save, or external path are packaged, logged, committed, or uploaded.

Ready cards launch with upstream `--game <id>` and skip the LÖVE launcher. Cards show stable/beta support, cache state, canonical digest prefix, and discovered save-file count. Save discovery exports metadata only; save contents remain in private IDBFS. Removing a game clears its versioned extracted cache and registration while deliberately preserving saves.

## Runtime boundary

`runtime-v050/` is the packaged fallback. `runtime-shell-v050/` materializes updated system component sets. A strict one-use in-memory host session carries the game command through pre-presentation JavaScript evaluation; no ROM-bearing transfer file is written. The loader then waits until presentation provides a stable non-placeholder WebView geometry before loading LÖVE. The runtime validates game/size/digest metadata, stages bytes only after IDBFS population, clears the Base64 field immediately after decode, and signals native code when the upstream importer has consumed the transfer. A separate maintenance page removes a known game's cache prefix, including private rendered effects, while preserving saves.

Before LÖVE creates its window, a generated `conf.lua` host wrapper applies the visible WebView aspect and DPR-native framebuffer. A visual adapter replaces only `TouchControls.draw`; input remains upstream. The game WebView is presented without Scripting's persistent native `navigationTitle`. A semantic in-WebView header appears after runtime readiness, holds 5.5 seconds, fades over 0.9 seconds, can be revealed from the top edge, and dismisses through a native script-message handler.

The no-worker audio adapter keeps ChipSynth's programs, 44.1 kHz sample rate and sequential engine state. Native 047 uses 512 samples × 256 buffers and at most two fills per update, retaining the same 1024-sample maximum update budget while distributing consumption across nearly every 60 Hz frame. First-use effects are written as PCM WAV plus a complete canonical signature under `<game>/audio-render-cache-gen1recomp-0.1.96-chip-v1`; a cache hit requires exact sidecar equality and successful decode. Existing periodic IDBFS flush persists it, and selective game-cache deletion removes it. No generated audio is packaged or uploaded. Music/effect and update/draw CPU remain independently logged.

The implementation does not emulate Game Boy hardware. The path remains ROM → upstream importer/extractor → private generated cache → Gen1Recomp Lua logic → LÖVE/love.js rendering, audio, and input.

## Components and mods

LÖVE/Lua runtime and Gen1Recomp core remain separately versioned, manually installable, verified, staged, recoverable, and rollback-capable. Mods remain a separate package-management domain with local ZIP/public GitHub release install and manual updates. Every mod is still installed inactive; game-profile capability consent and runtime injection remain gated.

## Evidence status

- Native 0.2.0 physically reached ready frame 21 on iPhone/iOS 18.7;
- Scripting `DocumentPicker`, `FileManager`, `Crypto.sha1`, `Data`, and `WebViewController.evaluateJavaScript` contracts were cross-checked against current official documentation;
- domain, package, runtime, updater, mod, and tooling tests are automated;
- Native 0.4.0–0.4.4 proved canonical Yellow identity, extraction, game/audio startup, visible upstream controls, and ordinary touch-controlled progress into Oak's Lab on Scripting 3.2.0/iOS 26.6;
- Native 0.4.5–0.4.9 physically progressed from viewport attribution to Retina/near-60 Hz and narrowed title/component-tree defects. Native 0.5.0 requires post-ready fade and native TabView-tree regression evidence. Warm cache, phone recovery, cache-ready UI, saves, multitouch, wider devices, components and mods remain open.
