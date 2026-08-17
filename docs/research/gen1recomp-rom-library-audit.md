# Upstream ROM/library extraction audit for Native 0.4.0

**Audited source:** ignored pinned Gen1Recomp v0.1.96 checkout at `73fbaaa25093338585923b8b9809f2fea7fc59dc`
**Date:** 2026-08-17
**Purpose:** identify the smallest faithful Scripting adapter boundary without copying ROM data or implementing emulation

## Canonical identities

`src/core/GameVersion.lua` is the upstream source of truth:

| ID | Bytes | SHA-1 | Support reflected by native UI |
|---|---:|---|---|
| red | 1,048,576 | `ea9bcae617fdf159b045185467ae58b2e4a48b9a` | Generation 1 stable |
| blue | 1,048,576 | `d7037c83e1ae5b39bde3c30787637ba1d4c48ce2` | Generation 1 stable |
| yellow | 1,048,576 | `cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1` | Generation 1 stable |
| gold | 2,097,152 | `d8b8a3600a465308c9953dfa04f0081c05bdcb94` | Generation 2 beta |

`GameVersion.forSha1` routes by content identity, not filename or selected tab. Native 0.4.0 follows the same rule and prefilters by exact size before native SHA-1.

## Import ownership and transaction boundary

`src/import/RomImporter.lua`:

- rejects every size except exact 1 MiB Gen 1 or exact 2 MiB Gold;
- hashes the full bytes again with `love.data.hash("sha1", data)`;
- routes by `GameVersion.forSha1`;
- clears only that version's prior generated cache and marker;
- runs `RomExtractor`/`RomExtractorGen2` through a thread when available or a coroutine fallback;
- retains ROM data only while extraction is active and clears it before completion;
- writes `rom-cache.complete` last;
- leaves interactive launcher imports on the launcher, but scripted imports hand off directly.

`main.lua` treats `POKEPORT_IMPORT_ROM` as scripted import and automatically boots the extracted version. `POKEPORT_GAME` and reachable `--game=<id>` launch a ready game without the launcher. Native 0.4.0 uses these existing seams; it does not patch `main.lua`, `RomImporter`, extractors, Kernel, or LÖVE.

## Cache readiness

The audited importer uses `rom-cache-v10:<canonical-sha1>`, not the older v5 value recorded in earlier architecture notes. Readiness requires both the exact marker and a closed required-file list. Red/Blue use the common Gen 1 list; Yellow adds Jessie/James, Oak-back and pikapic markers; Gold replaces the list with its Phase-specific set.

The browser adapter mirrors these paths only to decide when it may tell native code to delete the retained source. This duplication is intentionally pinned to core 0.1.96/cache v10 and must update with any core package that changes importer readiness. Upstream remains authoritative and independently checks readiness before direct boot.

## love.js persistence findings

Pinned love.js mounts `IDBFS` at `/home/web_user`; the game identity resolves below:

```text
/home/web_user/.local/share/love/pokemon-love2d/
```

Native 0.4.0 installs the verified ROM transfer only after pinned love.js finishes its initial `FS.syncfs(true)`. This ordering prevents populate reconciliation from deleting or shadowing the transfer. `Module.env` supplies `POKEPORT_IMPORT_ROM`, `POKEPORT_GAME`, and `POKEPORT_VERSION` before Lua starts.

Once the browser surface reports a live main loop, `love.load` has synchronously read the transfer. The adapter unlinks it immediately, before periodic/background/exit flush can persist ROM bytes. The native verified source remains until the v10 marker plus all required files exist and an explicit `syncfs(false)` succeeds. Interrupted/failed extraction therefore retries from native private storage without reselecting the external file.

## Saves

`src/core/SaveData.lua` owns save semantics:

- legacy files: `save.lua`, `save_blue.lua`, `save_yellow.lua`, `save_gold.lua` plus backup/temp witnesses;
- slots: `saves/<game>/slotN.lua`;
- shared slot registry/options: `options.lua`;
- serialization is deterministic Lua data parsed through the upstream data-only parser.

Native 0.4.0 enumerates only main save filenames, byte counts, and timestamps after cache readiness. It does not parse, execute, rewrite, export, rename, activate, or delete save content. Selected-game cache deletion deliberately excludes both slot/legacy saves and shared options. Full native save-slot mutation needs an explicit upstream-owned command/API rather than direct options rewriting.

## Extraction boundary selected

```text
native picker/hash/registry
  → one-use in-memory host session
    → post-populate Emscripten transfer
      → existing scripted importer/extractor
        → existing per-game IDBFS cache
          → existing Gen1Recomp game logic
```

This is not a Game Boy emulator: no instruction decoder, CPU, bus, PPU, memory mapper, timing loop, or emulator ROM execution is introduced. The ROM is input to upstream data extraction; gameplay remains recompiled/interpreted Gen1Recomp Lua logic on LÖVE/love.js.

## Physical extraction correction

Native 0.4.0's first canonical Yellow run reached `Rom.decompressPic` and failed at `src/import/Rom.lua:198` because that upstream file uses LuaJIT's global `bit.bxor`. The web overlay's `bit.lua` already matched BitOp through 9,492 differential comparisons, but was only available through `require("bit")`. Native 0.4.1 corrects the host bootstrap to assign that same module to `_G.bit` before upstream main loads. This reproduces a LuaJIT host semantic in the adapter instead of editing `Rom.lua` or any other core file.

## Physical audio-host correction

After the BitOp correction, Native 0.4.2 physically completed Yellow generated-data loading and entered game/display setup, then LÖVE raised `Queueable Sources can not be looped.` LÖVE's OpenAL `Source::setLooping` rejects every queue source. Upstream chip music already implements loop behavior in `ChipSynth`, but the generic music/source path still attempts Source looping. Native 0.4.3 therefore installs a lazy adapter guard on the shared Source method table when the first queue source is constructed: queue `setLooping` becomes a no-op, while static/stream calls delegate unchanged. A pinned love.js probe verified both branches. No upstream or LÖVE source is patched.

## Evidence limits

Chromium 149 proves the ROM-free session, the transfer/unlink ordering with a noncopyrighted all-zero fixture, and selective IDBFS maintenance. It cannot prove native Scripting file access, WebKit IDBFS durability, canonical extraction, title fidelity, saves, input, audio, or physical lifecycle behavior. Those remain the Native 0.4.0 device plan.
