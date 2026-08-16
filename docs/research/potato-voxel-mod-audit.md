# PotatoVoxel external mod audit

**Date:** 2026-08-16
**Purpose:** implementation reference for Gen1Recomp mod packaging, GitHub updates, permissions, storage and UI. No PotatoVoxel source or asset is integrated into this repository.

## Acquisition and identity

- Repository: <https://github.com/ShaneMcGovernIE/potato_voxel>
- Local ignored research checkout: `research/downloads/mods/potato_voxel/`
- Machine-readable evidence lock: [`research/potato-voxel-lock.json`](../../research/potato-voxel-lock.json)
- Audited release: `v1.7.4`, published `2026-08-16T22:17:02Z`
- Release target/source revision: `d4785fff9b443eb9db2541b58638e1cac4a5af51`
- Source checkout: 108 tracked files.
- Locally generated source-archive characterization only: 2,019,383 uncompressed bytes / 118 ZIP entries including directory records, SHA-256 `6a28775a4963fe801cb0f85a9172bb6b332ce06a0610d8f777f6e617512daeeb`. This is not the official release asset.
- Official release asset: `potato_voxel-1.7.4.zip`, asset ID `517277663`, 641,004 bytes, GitHub API digest `sha256:261b070bed81516e3f0f468130b4561ee90267ca3d3e15f5d120f4a1fd849450`.
- GitHub exposes the uploaded asset digest directly. GitHub documents release-asset digests as upload-time immutable SHA-256 values and the asset endpoint as either a direct 200 response or redirect.
- The sandbox could clone/fetch the complete source and query release metadata, but `release-assets.githubusercontent.com` terminated both `gh release download` and direct asset-API transfer before bytes arrived. No official release ZIP is claimed as locally inspected. The zero-byte partial was removed.

## Licensing finding

GitHub reports no repository license and the checkout contains no LICENSE/COPYING file. `mod.card` says PotatoVoxel derives from Dramatic Shape and that the upstream code carries no license. Therefore:

- source was downloaded only into the ignored research tree for architecture analysis;
- no source, asset, shader or data table is copied into Gen1Recomp Scripting product code, fixtures or artifacts;
- the mod store must display missing/unknown license metadata rather than infer permission to redistribute;
- direct installation can download from the publisher's release, but the application must not mirror the package as its own artifact.

## Manifest at v1.7.4

```text
id             potato_voxel
name           PotatoVoxel
version        1.7.4
api            2
entry          main.lua
profile        content
category       GRAPHICS
game_version   0.0.0-dev || >=0.1.37 <2.0.0
github         ShaneMcGovernIE/potato_voxel
affects_link   false
permissions    engine_internals, network
```

Declared conflicts:

- `DRAMATIC_SHAPE`
- `ds_fp_ceiling`
- `dramatic_shape_brick`
- `BATTLE_ART_VOXEL_FORK`
- `DRAMALESS_SHAPE`

No hard or optional dependencies are currently declared. The mod uses scoped `mod.storage` for mesh caches and extensively requires private engine modules, matching the `engine_internals` disclosure. The network permission is associated with an HTTPS `log_url` and explicit diagnostic-log send paths. Installation must not silently consent to either permission, and network permission must expose the destination before activation.

The implemented host-independent API-1/API-2 parser accepted the exact ignored v1.7.4 `manifest.json` and returned the expected ID/version, two permissions, five conflicts and GitHub binding. This validates parser shape only, not Lua execution or mod compatibility.

## Runtime implications

PotatoVoxel is a high-value stress/reference mod rather than a minimal compatibility sample:

- large Lua render architecture with shaders, depth canvases, voxel geometry, water, shadows and optional 3D battles;
- cooperative mesh construction and persistent scoped caches;
- quality presets including 75%, 50% and 33% render scales;
- private-engine access, so it is intentionally high-risk and sensitive to Gen1Recomp internals;
- cache lifecycle is save/profile relevant and can be substantially larger than the downloadable package;
- it requires shader/depth-canvas behavior that Preview startup alone has not validated on iOS;
- release 1.7.4 specifically fixes a platform filesystem naming issue and adjusts work slicing, demonstrating why platform capability/error attribution and version rollback matter.

The application must not describe successful package installation as proof that the mod can render or meet frame/memory budgets in the Scripting WebView.

## Discovery-index discrepancy

The official community index checkout at revision `8b58e316d55c034c7495a9dc5322d9861c142b69` lists PotatoVoxel as version 1.2.0 and permissions `engine_internals, filesystem`, while the publisher's v1.7.4 release manifest says `engine_internals, network` and has additional conflicts. The index README explicitly says listing is not vetting.

Consequences:

1. Index metadata is discovery/cache content only.
2. The GitHub release API is re-read on a manual install/update check.
3. The exact downloaded release asset is bound by asset ID, size and GitHub SHA-256.
4. The packaged `manifest.json` is parsed again after download.
5. Repository, release tag/version, ZIP identity, manifest ID/version, permissions, dependencies and conflicts must agree before registry commit.
6. Any permission change pauses activation for fresh consent; bulk update cannot grant it.
7. A moving `latest` response is never used after planning: update execution retains the selected tag, asset URL/ID, size and digest.

The research session itself observed the latest release move from v1.7.3 to v1.7.4 while analysis was in progress, confirming this race is practical rather than theoretical.

## Upstream package/update behavior

Primary Gen1Recomp sources establish:

- accepted ZIP shape is `manifest.json` at archive root or inside exactly one top-level mod folder;
- preferred GitHub asset is `<id>-<version>.zip`, then an ID-prefixed ZIP, then the sole/first ZIP;
- `github: owner/repo` enables Update and Versions;
- dependencies may carry ranges, game scopes and GitHub repository hints;
- user-owned required imports are separately picked, validated and copied under the mod's scoped `baseroms/` directory;
- distributed archives must contain no ROM-derived data, ROMs, or patch files;
- `filesystem` is legacy disclosure, not raw host filesystem access;
- mod isolation is an application-level Lua sandbox, not an iOS process sandbox.

## Resulting native architecture decisions

- Mods use a registry/storage/journal independent of system-component updates.
- New ZIP/GitHub installations commit disabled; no capabilities are granted by installation.
- Manual ZIP import computes and records SHA-256 even when no publisher digest exists.
- GitHub installation requires a stable release, unambiguous ZIP, exact positive size and GitHub-provided SHA-256.
- Archive policy rejects traversal, Unicode/path collisions, symlinks, excessive entries/depth/size/ratio, ROMs, patches, baseroms, native libraries and Lua bytecode.
- The package manifest is the authority for runtime permissions/conflicts, not stale index metadata.
- Installed immutable versions retain a previous pointer for rollback; mod activation and game-profile integration remain a separate gate.
- PotatoVoxel must remain disabled until physical iOS shader/depth-canvas, touch, memory, cache persistence and performance evidence exists.

## Primary sources

- PotatoVoxel repository and v1.7.4 GitHub Release/API.
- Gen1Recomp wiki: `Guide-Publishing`, `Reference-Manifest`.
- Gen1Recomp source: `src/mods/Manifest.lua`, `ModUpdate.lua`, `LauncherMods.lua`, `Sandbox.lua`.
- Gen1Recomp mod index repository: README, `schema/mod.schema.json`, PotatoVoxel entry.
- GitHub REST documentation: release assets and SHA-256 asset digests.
