import { gt, lt, valid } from "semver"

import { COMPONENT_ID_PATTERN, type ComponentManifest } from "../../contracts/src/component-manifest.js"
import { err, ok, type Result } from "../../contracts/src/result.js"
import { evaluateCompatibility, type CompatibilityReport } from "./compatibility-evaluator.js"
import { resolveComponents } from "./dependency-resolver.js"
import type { ActivationSet } from "./activation-journal.js"
import type { CatalogRelease, UpdateCatalog } from "./update-catalog.js"

export type UpdateAvailability = {
  readonly componentId: string
  readonly kind: ComponentManifest["kind"]
  readonly installedVersion: string | null
  readonly availableVersion: string
  readonly status: "current" | "update_available" | "not_installed"
  readonly release: CatalogRelease
}

export type SystemUpdatePlan = {
  readonly catalogId: string
  readonly catalogSequence: number
  readonly requestedComponentIds: readonly string[]
  readonly candidate: ActivationSet
  readonly packages: readonly CatalogRelease[]
  readonly activationOrder: readonly ComponentManifest[]
  readonly compatibility: CompatibilityReport
}

export type UpdatePlanError = {
  readonly code:
    | "wrong_domain"
    | "invalid_installed"
    | "invalid_request"
    | "not_found"
    | "no_update"
    | "dependency"
    | "downgrade"
    | "incompatible"
  readonly componentId: string | null
  readonly message: string
}

function planError(
  code: UpdatePlanError["code"],
  message: string,
  componentId: string | null = null,
): Result<never, UpdatePlanError> {
  return err({ code, componentId, message })
}

function validateInstalled(installed: ActivationSet): Result<void, UpdatePlanError> {
  for (const [id, version] of Object.entries(installed)) {
    if (!COMPONENT_ID_PATTERN.test(id) || valid(version) === null) {
      return planError("invalid_installed", "installed component IDs and versions must be canonical", id)
    }
  }
  return ok(undefined)
}

function latestReleases(catalog: UpdateCatalog): ReadonlyMap<string, CatalogRelease> {
  const latest = new Map<string, CatalogRelease>()
  for (const release of catalog.releases) {
    const current = latest.get(release.manifest.id)
    if (current === undefined || gt(release.manifest.version, current.manifest.version)) {
      latest.set(release.manifest.id, release)
    }
  }
  return latest
}

export function listSystemUpdateAvailability(
  catalog: UpdateCatalog,
  installed: ActivationSet,
): Result<readonly UpdateAvailability[], UpdatePlanError> {
  if (catalog.domain !== "system") return planError("wrong_domain", "system updater requires a system catalog")
  const validInstalled = validateInstalled(installed)
  if (!validInstalled.ok) return validInstalled

  const inventory: UpdateAvailability[] = []
  for (const release of latestReleases(catalog).values()) {
    const installedVersion = installed[release.manifest.id] ?? null
    inventory.push({
      componentId: release.manifest.id,
      kind: release.manifest.kind,
      installedVersion,
      availableVersion: release.manifest.version,
      status: installedVersion === null
        ? "not_installed"
        : gt(release.manifest.version, installedVersion) ? "update_available" : "current",
      release,
    })
  }
  inventory.sort((left, right) => left.componentId.localeCompare(right.componentId))
  return ok(inventory)
}

export function planSystemUpdate(
  catalog: UpdateCatalog,
  installed: ActivationSet,
  requestedComponentIds: readonly string[],
  providedApis: Readonly<Record<string, string>>,
): Result<SystemUpdatePlan, UpdatePlanError> {
  if (catalog.domain !== "system") return planError("wrong_domain", "system updater requires a system catalog")
  const validInstalled = validateInstalled(installed)
  if (!validInstalled.ok) return validInstalled
  if (requestedComponentIds.length === 0) {
    return planError("invalid_request", "at least one component update must be requested")
  }

  const requested = [...new Set(requestedComponentIds)].sort()
  if (requested.some((id) => !COMPONENT_ID_PATTERN.test(id))) {
    return planError("invalid_request", "requested component IDs must be canonical")
  }
  const latest = latestReleases(catalog)
  const roots: { id: string; range: string }[] = []
  for (const id of requested) {
    const release = latest.get(id)
    if (release === undefined) return planError("not_found", `component ${id} is not in this catalog`, id)
    const installedVersion = installed[id]
    if (installedVersion === undefined || !gt(release.manifest.version, installedVersion)) {
      return planError("no_update", `no newer version of ${id} is available`, id)
    }
    roots.push({ id, range: release.manifest.version })
  }

  const resolution = resolveComponents(catalog.releases.map(({ manifest }) => manifest), roots)
  if (!resolution.ok) {
    return planError("dependency", resolution.error.message, resolution.error.componentId)
  }

  const releaseByIdentity = new Map(
    catalog.releases.map((release) => [`${release.manifest.id}\0${release.manifest.version}`, release] as const),
  )
  const packages: CatalogRelease[] = []
  const candidate: Record<string, string> = { ...installed }
  for (const manifest of resolution.value.activationOrder) {
    const installedVersion = installed[manifest.id]
    if (installedVersion !== undefined && lt(manifest.version, installedVersion)) {
      return planError(
        "downgrade",
        `dependency resolution would downgrade ${manifest.id} from ${installedVersion} to ${manifest.version}`,
        manifest.id,
      )
    }
    candidate[manifest.id] = manifest.version
    if (installedVersion !== manifest.version) {
      const release = releaseByIdentity.get(`${manifest.id}\0${manifest.version}`)
      if (release === undefined) {
        return planError("not_found", `release metadata is missing for ${manifest.id}@${manifest.version}`, manifest.id)
      }
      packages.push(release)
    }
  }

  const compatibility = evaluateCompatibility(resolution.value.activationOrder, providedApis)
  if (!compatibility.compatible) {
    const failed = compatibility.checks.find(({ status }) => status !== "matched")
    return planError(
      "incompatible",
      failed === undefined
        ? "the selected component set is incompatible"
        : `${failed.componentId} requires ${failed.api} ${failed.required}; provided ${failed.provided ?? "nothing"}`,
      failed?.componentId ?? null,
    )
  }

  return ok({
    catalogId: catalog.catalogId,
    catalogSequence: catalog.sequence,
    requestedComponentIds: requested,
    candidate,
    packages,
    activationOrder: resolution.value.activationOrder,
    compatibility,
  })
}
