# Gen1Recomp Native 043

Native Scripting product iteration built on the physically validated Preview 0.1.4 runtime and Native 0.2.0 diagnostic path. Native 0.4.0 added the first operational game-library vertical slice and physically reached canonical Yellow extraction; completed extraction and gameplay remain under iterative device validation.

Native 0.4.0 physically accepted and registered canonical Yellow on Scripting 3.2.0/iOS 26.6, retained it across retries, and reached love.js. Extraction then exposed a PUC-Lua compatibility defect: upstream `Rom.lua` expects LuaJIT's global `bit`, while the adapter had provided only `require("bit")`. Native 0.4.1 installs the parity-tested BitOp shim as both module and global before upstream main loads. It removed the prior explicit BitOp failure, but the device then showed love.js' generic pre-window alert without forwarding its browser-console cause. Native 0.4.2 preserved that correction and forwarded the hidden cause: Yellow generated 223 maps/151 species/165 moves, loaded the game/display, then LÖVE rejected a queueable source looping request. Native 0.4.3 guards only that invalid/redundant queue operation, preserves static looping, retains bounded diagnostics, and suppresses only the already-logged generic modal.

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

`runtime-v043/` is the packaged fallback. `runtime-shell-v043/` materializes updated system component sets. A strict one-use in-memory host session carries the game command through pre-presentation JavaScript evaluation; no ROM-bearing transfer file is written. The runtime validates game/size/digest metadata, stages bytes only after IDBFS population, clears the Base64 field immediately after decode, and signals native code when the upstream importer has consumed the transfer. A separate maintenance page removes only a known game's cache-prefix records from love.js IDBFS.

The implementation does not emulate Game Boy hardware. The path remains ROM → upstream importer/extractor → private generated cache → Gen1Recomp Lua logic → LÖVE/love.js rendering, audio, and input.

## Components and mods

LÖVE/Lua runtime and Gen1Recomp core remain separately versioned, manually installable, verified, staged, recoverable, and rollback-capable. Mods remain a separate package-management domain with local ZIP/public GitHub release install and manual updates. Every mod is still installed inactive; game-profile capability consent and runtime injection remain gated.

## Evidence status

- Native 0.2.0 physically reached ready frame 21 on iPhone/iOS 18.7;
- Scripting `DocumentPicker`, `FileManager`, `Crypto.sha1`, `Data`, and `WebViewController.evaluateJavaScript` contracts were cross-checked against current official documentation;
- domain, package, runtime, updater, mod, and tooling tests are automated;
- Native 0.4.0 proved DocumentPicker, canonical Yellow identity, pending registration/retry, ROM transfer and upstream extractor entry on Scripting 3.2.0/iOS 26.6; Native 0.4.3 still requires completed game-window initialization, App Group relaunch durability, IDBFS persistence/deletion, direct game boot, saves, lifecycle/input/audio, iPad adaptation, and component/mod evidence.
