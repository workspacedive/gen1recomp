# Gen1Recomp Native 030

Native Scripting product-shell iteration built on the physically validated Preview 0.1.4 runtime and Native 0.2.0 diagnostic path.

## Native control plane

- adaptive bottom navigation for Home, Games, Updates, Mods, and Settings;
- centralized German/English strings;
- explicit loading/content/working/success/error states;
- manual-only system and mod network checks;
- private App Group component and mod registries;
- ROM-free runtime diagnostic with rollback to known-good component generation.

The Games screen remains deliberately honest: the native persistent ROM transaction is not activated in this build. No web launcher is presented as native ROM management.

## System components

The system screen supports:

- separately versioned LÖVE/Lua runtime and Gen1Recomp core;
- manual catalog checks;
- individual or aggregate updates;
- manually selected package ZIPs whose exact size and SHA-256 already exist in the trusted catalog;
- catalog identity/domain/channel/source/sequence policy;
- dependency and API compatibility checks;
- archive allowlists, immutable version directories, activation journal, health check and rollback.

LÖVE and Lua are currently one physical love.js/WASM distribution and cannot truthfully be replaced independently without a new runtime ABI/package split. The UI therefore labels the replaceable unit `LÖVE / Lua Runtime` rather than pretending Lua is a standalone file.

## Mods

The Mods tab supports:

- manual `.zip` import through `DocumentPicker`;
- install from a public GitHub `owner/repo`;
- manual GitHub update checks;
- individual or aggregate update actions;
- deletion and previous-version metadata;
- private immutable package versions and recoverable registry generation;
- visible permissions, conflicts, source and inactive status.

GitHub installation accepts only a stable release with an unambiguous ZIP, positive bounded size, `uploaded` asset state and GitHub-provided SHA-256 digest. The selected release asset is then downloaded and its ZIP plus packaged `manifest.json` are independently validated. Repository, tag version, manifest version and manifest `github` source must agree.

Archive policy rejects traversal, invalid Unicode/path shape, case-insensitive and parent-file collisions, symlinks, expansion bombs, excessive entry/byte limits, ROMs, ROM patches, `baseroms`, native libraries and Lua bytecode. Installation always commits **inactive**: it grants no `network`, `engine_internals`, `steps`, `background` or legacy `filesystem` capability. Game-profile activation and explicit permission consent are separate future gates.

The community index remains a discovery source only. It is not installation evidence; the exact GitHub Release and packaged manifest are re-read because index metadata can be stale.

## Runtime boundary

`runtime-v030/` is the packaged ROM-free diagnostic fallback. `runtime-shell-v030/` materializes updated system component sets. Installed mods are not injected or enabled in the game plane yet; claiming installation as runtime compatibility would be incorrect.

The Preview 0.1.4 post-dismiss JavaScript call is not repeated. Save-bearing gameplay still needs a physically validated pre-dismiss close/flush handshake.

## Evidence status

- Native 0.2.0 physically reached ready frame 21 from its native Settings action on iPhone/iOS 18.7;
- Native 0.3.0 official APIs cross-checked: `Navigation`, legacy-compatible `TabView`, hooks, `DocumentPicker`, `FileManager`, `Archive`, `Crypto`, native `fetch`, `Data`, `Dialog`, and `WebViewController`;
- strict local declaration-subset typecheck and host-independent catalog/manifest/release/archive tests automated;
- deterministic package/runtime browser characterization automated;
- Native 0.3.0 Mods UI, GitHub API/redirect path, manual file access, App Group registry recovery and component import still require physical-device validation.
