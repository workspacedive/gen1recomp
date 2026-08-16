# Component update system

Host-independent update safety and orchestration for Gen1Recomp system components.

## Modules

### `update-catalog.ts`

Strictly parses sequence-numbered `system` or `mods` catalogs and validates catalog identity, domain, channel, exact trusted HTTPS source, artifact base path, monotonic sequence, duplicate releases, and component-kind separation. `system` and `mods` catalogs cannot mix.

HTTPS and SHA-256 provide transport and catalog-to-artifact binding; they are not described as publisher signatures. A detached public-key catalog-signature policy remains a separate future hardening layer.

### `system-update-planner.ts`

Builds installed/available inventory and creates an explicit per-component or aggregate system-update plan. It resolves dependencies through pinned `semver`, rejects missing/no-op roots and dependency downgrades, evaluates named API compatibility, and returns dependency-first packages plus the complete candidate activation set.

### `system-update-orchestrator.ts`

Runs a manual transaction through:

```text
plan → prepare journal → stage packages → verify → self-test
→ activate pointer → health check → commit
```

Cancellation is honored before pointer activation. Package, activation, and health-check failures recover the previous set and discard staging. Concurrent update operations return `busy`. UI progress is stage-attributed and may carry real byte totals from a host adapter.

### `archive-policy.ts`

Validates an extractor-provided entry inventory before extraction. It rejects unsafe/non-normalized paths, path collisions, symlinks, invalid sizes, file/aggregate limits and excessive expansion ratios. Limits are caller-supplied policy, not hidden constants.

It does not parse ZIP bytes, choose a component-specific file allowlist, inspect copyrighted content or prove the eventual extractor cannot follow links. A host adapter must expose entry metadata and enforce destination containment while extracting.

### `dependency-resolver.ts`

Uses pinned `semver` to select the newest satisfiable component set with backtracking. Required dependencies are included, optional dependencies constrain a component only if something else selects it, and activation order is dependency-first. Invalid versions/ranges, duplicate versions, missing candidates and cycles fail closed.

### `compatibility-evaluator.ts`

Evaluates each selected manifest's named API ranges against canonical semantic versions and returns attributed checks for matched, missing, malformed and unsatisfied APIs. It does not guess versions from package names or turn unknown into compatible.

### `activation-journal.ts`

Defines a logical `ActivationStore`, persistent schema `schemas/activation-journal.schema.json`, and phases:

```text
prepared → verified → tested → activating → activated → commit
```

Only `activate` changes the active pointer. Recovery discards pre-pointer staging and restores `previous` from `activating`, `activated` or `rollingBack`. Commit records both the new known-good set and the previous fallback before removing the journal. Failure-injection tests cover interruption after pointer replacement and during commit.

## Host adapter

`scripting/Gen1RecompApp/src/data/system-update-service.ts` is the native Scripting adapter and UI-facing repository. It pins the production feed, applies native `fetch`/`Crypto`/`Archive`/`FileManager`, uses an App Group private store, materializes a complete versioned runtime, and restores the previous generation if the updated runtime does not reach ready on first diagnostic boot.

The catalog and deterministic current component packages live under `updates/`. The adapter's physical filesystem durability, interruption behavior, network redirects, memory use while materializing embedded packages, and first updated-runtime launch remain device validation requirements. Logical recovery tests are not a claim of physically atomic host writes.
