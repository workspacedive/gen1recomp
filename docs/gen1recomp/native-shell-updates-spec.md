# Native shell and manual system updates — implementation specification

**Status:** implementation baseline
**Date:** 2026-08-16
**Hosts:** Scripting native TSX page (control plane) plus the already validated local WebView game plane

## Goal

Deliver the first native product-shell slice and a manually triggered, recoverable update path for independently versioned Gen1Recomp system components. Preserve a stable extension point for a later App-Store-style Mods tab without coupling mod lifecycle to system updates.

## In scope

- Native bottom-level navigation for Home, Games, Updates, and Settings.
- A tab registry that can add a `mods` destination without changing root navigation.
- Explicit native states for initial load, content, empty, checking, update available, installing, success, and recoverable error.
- Manual update checking only; no automatic network request at launch and no background update.
- Independent update targets for:
  - `org.gen1recomp.runtime.lovejs` (the pinned love.js LÖVE/Lua runtime distribution);
  - `org.gen1recomp.core` (the pinned ROM-free Gen1Recomp core payload).
- Per-component or aggregate update planning.
- HTTPS catalog trust policy, strict catalog validation, rollback-sequence protection, dependency resolution, API compatibility evaluation, SHA-256 artifact verification, archive policy validation, staging, self-test, activation health check, commit, and rollback/recovery.
- Separate catalog domain and storage namespace for system updates. A future mod marketplace may reuse generic catalog primitives but must own its own install coordinator, consent, profiles, activation state, and rollback history.

## Explicit non-goals for this slice

- Automatic or silent installation.
- Updating the Scripting host project itself in place; no documented Scripting API proves programmatic project replacement.
- Claiming catalog authenticity beyond pinned HTTPS source policy and SHA-256 artifacts. A detached public-key signature layer remains a future hardening item because no supported signing-key distribution has been established.
- Shipping copyrighted ROM data or cover artwork.
- Presenting a placeholder Mods tab before discovery/install management is functional.
- Claiming filesystem writes are physically atomic before interruption testing on the target Scripting version/device.

## Data flow

```text
User taps Check for Updates
→ fetch pinned HTTPS system catalog
→ validate JSON, catalog identity/domain/channel/sequence and artifact URL policy
→ compare installed versions
→ show per-component availability
→ user selects one or all updates
→ dependency and API compatibility plan
→ create activation journal
→ download each package into transaction staging
→ verify response limits, exact size, SHA-256 and safe archive inventory
→ extract into immutable component/version directory
→ run component self-tests
→ replace active-set pointer at a safe non-running boundary
→ run activation health check
→ commit known-good/previous pointers or recover previous set
→ retain attributed status for UI and diagnostics
```

No system update operation runs while the game runtime is active. Repeated taps are rejected as `busy`; cancellation is honored before pointer activation.

## Trust and side effects

- Network destination: only configured HTTPS catalog URLs and matching artifact origin/path prefixes.
- Local writes: app-private App Group component, staging, journal, and update-state directories.
- No ROM, save, mod, device identifier, or diagnostic payload is uploaded.
- Catalog and packages are downloads only; redirects leaving the allowlist are refused.
- Package logs contain component IDs, versions, stages, byte counts, and public URLs only—never ROM/save bytes or user file paths.

## UX contract

- Update checking is always initiated by a visible user action.
- Existing component information remains visible during refresh.
- Each row names the installed and available version and exposes release notes in a detail view when available.
- “Update All” appears only when at least two compatible updates are available.
- Installation progress names the real stage; determinate byte progress is shown only when content length is known.
- Destructive rollback or component removal is confirmed.
- Errors are attributed to catalog, download, integrity, compatibility, staging, self-test, activation, or health check, with a retry/recovery action.
- Status uses text and SF Symbols in addition to color; controls retain 44 pt targets and Dynamic Type.
- German and English strings are centralized.

## Native 0.3.0 manual-package extension

- System components may also be selected through `DocumentPicker`; a package is accepted only when exact byte size and SHA-256 match a release in the already trusted system catalog. Manual selection cannot bypass catalog trust or install an unknown component.
- LÖVE and Lua remain one physical love.js/WASM runtime component until an independently replaceable Lua ABI/artifact exists.
- The Mods peer tab supports manual ZIP and public GitHub Release installation, manual update checks, individual/aggregate updates and deletion.
- GitHub installation binds stable tag, asset ID/state/name/size/URL/GitHub digest, downloaded bytes and packaged manifest. Index data is discovery only.
- Installed mods are private and inactive. Runtime injection, capability consent, dependency auto-install, game profiles/load order and mod health rollback are explicitly not implied by package installation.

## Mod-store extension contract

The future `mods` tab is a peer product destination, not a subsection of system updates. It will own:

- Featured/discovery, categories, search, mod detail, installed, updates, and profiles;
- individual and aggregate manual mod updates;
- dependency/conflict resolution and least-privilege capability consent;
- per-profile load order and rollback;
- publisher/source/checksum and compatibility presentation;
- an application-level isolation disclosure.

Shared infrastructure is limited to immutable catalog records, semver/dependency primitives, download/integrity helpers, and common visual tokens. System and mod catalogs cannot mix component kinds, activation journals, or “Update All” operations.

## Done contract for this slice

- Catalog parser/trust policy, planner, and system orchestrator are strict TypeScript modules with tests for malformed, rollback, downgrade, dependency, cancellation, integrity/staging failure, failed health check, and successful commit.
- Native shell source follows `src/config`, `src/domain`, `src/data`, `src/ui`, and `src/i18n` boundaries.
- A deterministic ROM-free `.scripting` package can be generated without replacing Preview 0.1.4.
- Existing runtime and contract tests still pass.
- Scripting-specific symbols are cross-checked against current official documentation and a temporary strict declaration harness.
- Physical native-page rendering, network permission behavior, interruption durability, and update activation remain explicitly open until tested in the installed Scripting app.
