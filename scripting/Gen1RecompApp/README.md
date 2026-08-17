# Gen1Recomp Native 048

Native Scripting product iteration built on the physically validated Preview 0.1.4 runtime and Native 0.2.0 diagnostic path. Native 0.4.0 added the first operational game-library vertical slice and physically reached canonical Yellow extraction; completed extraction and gameplay remain under iterative device validation.

Native 0.4.0–0.4.6 physically proved canonical Yellow extraction/play, full `440×956` geometry and major smoothing. Native 0.4.7 reached a best p95 of 20 ms with 601 frames per ten seconds and isolated named first-use effect stores while draw CPU remained negligible. It also exposed two non-fidelity defects: pixelated/dirty touch art from a sub-Retina backing and a complete freeze during an incoming call. Native 0.4.8 maps the canvas one-to-one to physical Retina pixels, supplies vector-only control drawing while retaining upstream input, and explicitly pauses/flushes/resumes/watchdog-verifies the Emscripten loop across host interruptions.

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

`runtime-v048/` is the packaged fallback. `runtime-shell-v048/` materializes updated system component sets. A strict one-use in-memory host session carries the game command through pre-presentation JavaScript evaluation; no ROM-bearing transfer file is written. The loader then waits until presentation provides a stable non-placeholder WebView geometry before loading LÖVE. The runtime validates game/size/digest metadata, stages bytes only after IDBFS population, clears the Base64 field immediately after decode, and signals native code when the upstream importer has consumed the transfer. A separate maintenance page removes a known game's cache prefix, including private rendered effects, while preserving saves.

Before LÖVE creates its window, a generated `conf.lua` host wrapper applies the visible WebView aspect. Native 048 multiplies CSS geometry by actual DPR, maps the canvas one-to-one to physical display pixels, and leaves upstream Renderer to select an integer GB-pixel scale. A visual adapter replaces only `TouchControls.draw`; layout, hit testing, ownership, press/release/reset and haptics remain upstream. A one-line fail-closed size seam lets that layout interpret the historical cap in physical pixels.

The no-worker audio adapter keeps ChipSynth's programs, 44.1 kHz sample rate and sequential engine state. Native 047 uses 512 samples × 256 buffers and at most two fills per update, retaining the same 1024-sample maximum update budget while distributing consumption across nearly every 60 Hz frame. First-use effects are written as PCM WAV plus a complete canonical signature under `<game>/audio-render-cache-gen1recomp-0.1.96-chip-v1`; a cache hit requires exact sidecar equality and successful decode. Existing periodic IDBFS flush persists it, and selective game-cache deletion removes it. No generated audio is packaged or uploaded. Music/effect and update/draw CPU remain independently logged.

The implementation does not emulate Game Boy hardware. The path remains ROM → upstream importer/extractor → private generated cache → Gen1Recomp Lua logic → LÖVE/love.js rendering, audio, and input.

## Components and mods

LÖVE/Lua runtime and Gen1Recomp core remain separately versioned, manually installable, verified, staged, recoverable, and rollback-capable. Mods remain a separate package-management domain with local ZIP/public GitHub release install and manual updates. Every mod is still installed inactive; game-profile capability consent and runtime injection remain gated.

## Evidence status

- Native 0.2.0 physically reached ready frame 21 on iPhone/iOS 18.7;
- Scripting `DocumentPicker`, `FileManager`, `Crypto.sha1`, `Data`, and `WebViewController.evaluateJavaScript` contracts were cross-checked against current official documentation;
- domain, package, runtime, updater, mod, and tooling tests are automated;
- Native 0.4.0–0.4.4 proved canonical Yellow identity, extraction, game/audio startup, visible upstream controls, and ordinary touch-controlled progress into Oak's Lab on Scripting 3.2.0/iOS 26.6;
- Native 0.4.5–0.4.7 physically progressed from exact viewport attribution to full portrait geometry and near-60 Hz steady motion. Native 0.4.8 requires Retina/vector quality, GPU-fill performance, warm-cache and incoming-call recovery evidence. Cache-ready UI, App Group durability, exact multitouch/release, saves, iPad adaptation, and component/mod evidence remain open.
