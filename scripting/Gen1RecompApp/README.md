# Gen1Recomp Native 020

First native Scripting product-shell slice. This project is intentionally separate from the physically validated `Gen1Recomp Preview 014` fallback.

## Native control plane

- adaptive bottom navigation for Home, Games, Updates, and Settings;
- a disabled-by-policy `mods` destination in the tab registry, ready to become a peer tab when discovery/install is functional;
- centralized German/English strings;
- explicit update loading/content/checking/installing/success/error states;
- manually initiated system-catalog checks only;
- independent LÖVE/Lua runtime and Gen1Recomp core rows;
- per-component and aggregate update actions;
- private App Group component storage, interruption journal, previous/known-good generations, and runtime rollback after a failed first boot.

The Games screen is deliberately honest: it provides the native empty state, but the ROM picker/import transaction is not activated in this build. No web launcher is presented as native ROM management.

## Update path

The device adapter pins:

- catalog ID `org.gen1recomp.system`;
- `stable` system domain;
- exact HTTPS catalog and artifact roots on `main`;
- monotonic catalog sequence;
- supported component IDs/kinds and archive file allowlists.

A manual install resolves the supported component dependency subset, checks host API compatibility, downloads all component generations required for a complete runtime, verifies exact size and SHA-256, rejects unsafe/unexpected archive entries and expansion ratios, stages immutable component files, materializes a private runtime, writes the activation pointer under a recovery journal, checks runtime completeness, and commits or restores the previous state.

The generic, fully tested update semantics remain in `components/updates/`; this file adapter is the narrow Scripting implementation. The catalog currently contains only the versions shipped by this package, so the initial expected result is “Up to Date.” New versions must be published under new immutable artifact names and a higher catalog sequence.

## Runtime boundary

`runtime-v020/` is the packaged ROM-free diagnostic fallback. `runtime-shell-v020/` is a host-owned scaffold used to materialize updated private component sets. The native Settings action starts the diagnostic explicitly. It does not execute ROM data and is not an emulator.

The Preview 0.1.4 post-dismiss JavaScript call is not repeated: Scripting resolves `WebViewController.present()` after the view is gone on the affected physical path. A production game session still needs a pre-dismiss close/flush handshake before save-bearing gameplay is enabled.

## Evidence status

- official APIs cross-checked: `Navigation`, `NavigationStack`, legacy-compatible `TabView`, hooks, `FileManager`, `Archive`, `Crypto`, native `fetch`, `Data`, `Dialog`, and `WebViewController`;
- strict local declaration-subset typecheck: automated;
- deterministic package/integrity tests: automated;
- exact native Scripting compilation, rendering, network behavior, private-store durability, interruption recovery, and updated-runtime launch: physical device verification pending.
