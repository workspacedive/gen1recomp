import { rcompare, satisfies, valid, validRange } from "semver"

import type { ComponentManifest } from "../../contracts/src/component-manifest.js"
import { err, ok, type Result } from "../../contracts/src/result.js"

export type ComponentRequirement = {
  readonly id: string
  readonly range: string
}

export type ResolutionError = {
  readonly code: "invalid_version" | "invalid_range" | "duplicate" | "unsatisfied" | "cycle"
  readonly componentId: string
  readonly message: string
}

export type ResolutionPlan = {
  readonly selected: ReadonlyMap<string, ComponentManifest>
  readonly activationOrder: readonly ComponentManifest[]
}

type Constraint = {
  readonly range: string
  readonly requestedBy: string
}

type SearchState = {
  readonly selected: Map<string, ComponentManifest>
  readonly constraints: Map<string, Constraint[]>
  readonly pending: Set<string>
}

function cloneState(state: SearchState): SearchState {
  return {
    selected: new Map(state.selected),
    constraints: new Map(
      [...state.constraints].map(([id, constraints]) => [id, [...constraints]]),
    ),
    pending: new Set(state.pending),
  }
}

function resolutionError(
  code: ResolutionError["code"],
  componentId: string,
  message: string,
): Result<never, ResolutionError> {
  return err({ code, componentId, message })
}

function candidatesFor(
  id: string,
  state: SearchState,
  available: ReadonlyMap<string, readonly ComponentManifest[]>,
): readonly ComponentManifest[] {
  const constraints = state.constraints.get(id) ?? []
  return (available.get(id) ?? []).filter((manifest) =>
    constraints.every((constraint) => satisfies(manifest.version, constraint.range)),
  )
}

function addConstraint(
  state: SearchState,
  id: string,
  constraint: Constraint,
): Result<void, ResolutionError> {
  if (validRange(constraint.range) === null) {
    return resolutionError(
      "invalid_range",
      id,
      `${constraint.requestedBy} requested invalid range ${constraint.range}`,
    )
  }
  state.constraints.set(id, [...(state.constraints.get(id) ?? []), constraint])
  const selected = state.selected.get(id)
  if (selected !== undefined && !satisfies(selected.version, constraint.range)) {
    return resolutionError(
      "unsatisfied",
      id,
      `${selected.version} does not satisfy ${constraint.range} requested by ${constraint.requestedBy}`,
    )
  }
  return ok(undefined)
}

function search(
  state: SearchState,
  available: ReadonlyMap<string, readonly ComponentManifest[]>,
): Result<Map<string, ComponentManifest>, ResolutionError> {
  const pending = [...state.pending].filter((id) => !state.selected.has(id))
  if (pending.length === 0) return ok(state.selected)

  pending.sort((left, right) =>
    candidatesFor(left, state, available).length - candidatesFor(right, state, available).length ||
    left.localeCompare(right),
  )
  const id = pending[0]
  if (id === undefined) return ok(state.selected)
  const candidates = candidatesFor(id, state, available)
  if (candidates.length === 0) {
    const requested = (state.constraints.get(id) ?? [])
      .map(({ range, requestedBy }) => `${range} from ${requestedBy}`)
      .join(", ")
    return resolutionError("unsatisfied", id, `no available version satisfies ${requested || "the requirement"}`)
  }

  let lastError: ResolutionError | null = null
  for (const candidate of candidates) {
    const branch = cloneState(state)
    branch.selected.set(id, candidate)
    branch.pending.delete(id)
    let rejected = false
    for (const dependency of candidate.dependencies) {
      const added = addConstraint(branch, dependency.id, {
        range: dependency.range,
        requestedBy: `${candidate.id}@${candidate.version}${dependency.optional === true ? " (optional)" : ""}`,
      })
      if (!added.ok) {
        lastError = added.error
        rejected = true
        break
      }
      if (dependency.optional !== true) branch.pending.add(dependency.id)
    }
    if (rejected) continue
    const resolved = search(branch, available)
    if (resolved.ok) return resolved
    lastError = resolved.error
  }
  return err(lastError ?? {
    code: "unsatisfied",
    componentId: id,
    message: "dependency resolution failed",
  })
}

function activationOrder(
  selected: ReadonlyMap<string, ComponentManifest>,
): Result<ComponentManifest[], ResolutionError> {
  const output: ComponentManifest[] = []
  const active = new Set<string>()
  const visited = new Set<string>()

  const visit = (manifest: ComponentManifest): Result<void, ResolutionError> => {
    if (visited.has(manifest.id)) return ok(undefined)
    if (active.has(manifest.id)) {
      return resolutionError("cycle", manifest.id, `dependency cycle includes ${manifest.id}`)
    }
    active.add(manifest.id)
    for (const dependency of manifest.dependencies) {
      const target = selected.get(dependency.id)
      if (target === undefined) {
        if (dependency.optional === true) continue
        return resolutionError("unsatisfied", dependency.id, `${manifest.id} has an unresolved dependency`)
      }
      const result = visit(target)
      if (!result.ok) return result
    }
    active.delete(manifest.id)
    visited.add(manifest.id)
    output.push(manifest)
    return ok(undefined)
  }

  for (const manifest of [...selected.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const result = visit(manifest)
    if (!result.ok) return result
  }
  return ok(output)
}

export function resolveComponents(
  manifests: readonly ComponentManifest[],
  roots: readonly ComponentRequirement[],
): Result<ResolutionPlan, ResolutionError> {
  const available = new Map<string, ComponentManifest[]>()
  const versions = new Set<string>()
  for (const manifest of manifests) {
    if (valid(manifest.version) === null) {
      return resolutionError("invalid_version", manifest.id, `${manifest.version} is not semantic versioning`)
    }
    const key = `${manifest.id}\0${manifest.version}`
    if (versions.has(key)) {
      return resolutionError("duplicate", manifest.id, `duplicate version ${manifest.version}`)
    }
    versions.add(key)
    available.set(manifest.id, [...(available.get(manifest.id) ?? []), manifest])
  }
  for (const candidates of available.values()) {
    candidates.sort((left, right) => rcompare(left.version, right.version))
  }

  const initial: SearchState = {
    selected: new Map(),
    constraints: new Map(),
    pending: new Set(),
  }
  for (const root of roots) {
    const added = addConstraint(initial, root.id, {
      range: root.range,
      requestedBy: "activation root",
    })
    if (!added.ok) return added
    initial.pending.add(root.id)
  }

  const selected = search(initial, available)
  if (!selected.ok) return selected
  const order = activationOrder(selected.value)
  if (!order.ok) return order
  return ok({ selected: selected.value, activationOrder: order.value })
}
