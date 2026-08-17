# Gen1Recomp Native 046

Native Scripting product iteration built on the physically validated Preview 0.1.4 runtime and Native 0.2.0 diagnostic path. Native 0.4.0 added the first operational game-library vertical slice and physically reached canonical Yellow extraction; completed extraction and gameplay remain under iterative device validation.

Native 0.4.0 physically accepted and registered canonical Yellow on Scripting 3.2.0/iOS 26.6, retained it across retries, and reached love.js. Extraction then exposed a PUC-Lua compatibility defect: upstream `Rom.lua` expects LuaJIT's global `bit`, while the adapter had provided only `require("bit")`. Native 0.4.1 installs the parity-tested BitOp shim as both module and global before upstream main loads. Native 0.4.2 exposed the next hidden cause after Yellow generated 223 maps/151 species/165 moves and loaded the game/display: LÖVE rejected a queueable source looping request. Native 0.4.3 guarded only that invalid queue operation and physically reached Yellow title/intro with immediate music. Native 0.4.4 activated upstream controls with documented `POKEPORT_TOUCH=1`; physical ordinary touch play reached Oak's Lab. Its stable-tree experiment did not eliminate the independent non-blocking Scripting `t.__type__` event. Native 0.4.5 added adaptive geometry and raw frame telemetry, which exposed that Scripting evaluates the runtime while its unpresented WebView still reports `1×1`; the resulting square `640×640` surface explained why the game remained a centered `440×440` square. It also measured repeated 50–105 ms frame gaps at approximately the 8192-sample synchronous music-buffer cadence. Native 0.4.6 waits for a stable visible viewport before loading LÖVE and divides unchanged 44.1 kHz PCM synthesis into bounded 1024-sample slices, with exact synthesis CPU telemetry.

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

`runtime-v046/` is the packaged fallback. `runtime-shell-v046/` materializes updated system component sets. A strict one-use in-memory host session carries the game command through pre-presentation JavaScript evaluation; no ROM-bearing transfer file is written. The loader then waits until presentation provides a stable non-placeholder WebView geometry before loading LÖVE. The runtime validates game/size/digest metadata, stages bytes only after IDBFS population, clears the Base64 field immediately after decode, and signals native code when the upstream importer has consumed the transfer. A separate maintenance page removes only a known game's cache-prefix records from love.js IDBFS.

Before LÖVE creates its window, a generated `conf.lua` host wrapper applies the now-visible WebView aspect through environment values. The constrained game edge remains an integer 4× phone or 5× tablet surface; CSS uniformly contains that complete surface. Retina DPR is diagnostic rather than a backing-size multiplier. Upstream Renderer, PixelCanvas, Camera and TouchControls remain unchanged.

The no-worker audio adapter keeps ChipSynth's programs, 44.1 kHz sample rate and exact sequential engine state, but changes queue hand-off from 8192 samples × 32 buffers to 1024 samples × 128 buffers. A two-line integration seam lets the host reduce synchronous fill from three buffers to one per update. Total queue duration stays close to three seconds while worst-case work per hand-off is bounded to one eighth of the prior slice. Music and one-shot synthesis CPU time is logged for physical attribution; no fidelity reduction is claimed or introduced.

The implementation does not emulate Game Boy hardware. The path remains ROM → upstream importer/extractor → private generated cache → Gen1Recomp Lua logic → LÖVE/love.js rendering, audio, and input.

## Components and mods

LÖVE/Lua runtime and Gen1Recomp core remain separately versioned, manually installable, verified, staged, recoverable, and rollback-capable. Mods remain a separate package-management domain with local ZIP/public GitHub release install and manual updates. Every mod is still installed inactive; game-profile capability consent and runtime injection remain gated.

## Evidence status

- Native 0.2.0 physically reached ready frame 21 on iPhone/iOS 18.7;
- Scripting `DocumentPicker`, `FileManager`, `Crypto.sha1`, `Data`, and `WebViewController.evaluateJavaScript` contracts were cross-checked against current official documentation;
- domain, package, runtime, updater, mod, and tooling tests are automated;
- Native 0.4.0–0.4.4 proved canonical Yellow identity, extraction, game/audio startup, visible upstream controls, and ordinary touch-controlled progress into Oak's Lab on Scripting 3.2.0/iOS 26.6;
- Native 0.4.5 physically exposed the pre-presentation `1×1` geometry bug and severe repeated frame gaps; Native 0.4.6 requires physical full-viewport and bounded-audio regression evidence. Cache-ready confirmation, App Group relaunch durability, IDBFS persistence/deletion, direct boot, exact multi-touch/release behavior, saves, lifecycle, remaining one-shot audio stalls, iPad adaptation, and component/mod evidence remain open.
