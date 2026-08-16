# Component update primitives

Host-independent update safety logic. These modules are a prerequisite for an updater, not a complete updater.

## `archive-policy.ts`

Validates an extractor-provided entry inventory before extraction. It rejects unsafe/non-normalized paths, path collisions, symlinks, invalid sizes, file/aggregate limits and excessive expansion ratios. Limits are caller-supplied policy, not hidden constants.

It does not parse ZIP bytes, choose a component-specific file allowlist, inspect copyrighted content or prove the eventual extractor cannot follow links. A Scripting adapter must expose entry metadata and enforce destination containment while extracting.

## `dependency-resolver.ts`

Uses pinned `semver` to select the newest satisfiable component set with backtracking. Required dependencies are included, optional dependencies constrain a component only if something else selects it, and activation order is dependency-first. Invalid versions/ranges, duplicate versions, missing candidates and cycles fail closed.

The resolver handles manifest dependency ranges. Runtime feature probes, API-major adapters, save migrations and capability consent are separate activation gates.

## `compatibility-evaluator.ts`

Evaluates each selected manifest's named API ranges against canonical semantic versions and returns attributed checks for matched, missing, malformed and unsatisfied APIs. It does not guess versions from package names or turn unknown into compatible.

## `activation-journal.ts`

Defines a logical `ActivationStore`, persistent schema `schemas/activation-journal.schema.json`, and phases:

```text
prepared → verified → tested → activating → activated → commit
```

Only `activate` changes the active pointer. Recovery discards pre-pointer staging and restores `previous` from `activating`, `activated` or `rollingBack`. Commit records both the new known-good set and the previous fallback before removing the journal. Failure-injection tests cover interruption after pointer replacement and during commit.

The store is abstract because Scripting durable/atomic filesystem semantics are not yet proven. An adapter must be tested on-device for torn writes, relaunch and storage loss before this protocol can be called durable.
