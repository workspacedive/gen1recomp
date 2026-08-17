import assert from "node:assert/strict"
import test from "node:test"

import type { ComponentKind, ComponentManifest } from "../../components/contracts/src/component-manifest.js"
import {
  listSystemUpdateAvailability,
  planSystemUpdate,
} from "../../components/updates/src/system-update-planner.js"
import type { CatalogRelease, UpdateCatalog } from "../../components/updates/src/update-catalog.js"

function release(
  id: string,
  version: string,
  kind: ComponentKind,
  dependencies: ComponentManifest["dependencies"] = [],
  compatibility: ComponentManifest["compatibility"] = {},
): CatalogRelease {
  return {
    manifest: {
      schemaVersion: 1,
      id,
      kind,
      version,
      apiVersion: "1.0.0",
      artifact: {
        path: `${id}-${version}.zip`,
        size: 10,
        integrity: { algorithm: "sha256", digest: "b".repeat(64) },
      },
      dependencies,
      compatibility,
      capabilities: [],
      migrations: [],
      selfTests: [],
    },
    publishedAt: "2026-08-16T12:00:00.000Z",
    notes: { en: `${id} ${version}` },
  }
}

const runtimeId = "org.gen1recomp.runtime.lovejs"
const coreId = "org.gen1recomp.core"

function catalog(releases: readonly CatalogRelease[]): UpdateCatalog {
  return {
    schemaVersion: 1,
    catalogId: "org.gen1recomp.system",
    domain: "system",
    channel: "stable",
    sequence: 2,
    generatedAt: "2026-08-16T12:00:00.000Z",
    artifactBaseURL: "https://updates.example/system/",
    releases,
  }
}

const installed = { [runtimeId]: "0.1.0", [coreId]: "0.1.96" }
const releases = [
  release(runtimeId, "0.1.0", "runtime", [], { hostProtocol: "^1.0.0" }),
  release(runtimeId, "0.2.0", "runtime", [], { hostProtocol: "^1.0.0" }),
  release(coreId, "0.1.96", "core", [{ id: runtimeId, range: "^0.1.0" }], { kernelApi: "^1.0.0" }),
  release(coreId, "0.1.97", "core", [{ id: runtimeId, range: "^0.2.0" }], { kernelApi: "^1.0.0" }),
]

const apis = { hostProtocol: "1.0.0", kernelApi: "1.0.0" }

test("inventory reports installed and available versions without treating uninstalled entries as updates", () => {
  const result = listSystemUpdateAvailability(catalog([
    ...releases,
    release("org.gen1recomp.renderer.webgl", "1.0.0", "renderer"),
  ]), installed)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.value.map(({ componentId, status }) => [componentId, status]), [
    [coreId, "update_available"],
    ["org.gen1recomp.renderer.webgl", "not_installed"],
    [runtimeId, "update_available"],
  ])
})

test("requesting a core update includes its newer runtime dependency in dependency-first order", () => {
  const result = planSystemUpdate(catalog(releases), installed, [coreId], apis)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.value.packages.map(({ manifest }) => `${manifest.id}@${manifest.version}`), [
    `${runtimeId}@0.2.0`,
    `${coreId}@0.1.97`,
  ])
  assert.deepEqual(result.value.candidate, { [runtimeId]: "0.2.0", [coreId]: "0.1.97" })
  assert.equal(result.value.compatibility.compatible, true)
})

test("planner supports one or all explicit update roots and deduplicates requests", () => {
  const one = planSystemUpdate(catalog(releases), installed, [runtimeId], apis)
  assert.equal(one.ok, true)
  if (one.ok) assert.deepEqual(one.value.packages.map(({ manifest }) => manifest.id), [runtimeId])

  const all = planSystemUpdate(catalog(releases), installed, [coreId, runtimeId, coreId], apis)
  assert.equal(all.ok, true)
  if (all.ok) {
    assert.deepEqual(all.value.requestedComponentIds, [coreId, runtimeId])
    assert.equal(all.value.packages.length, 2)
  }
})

test("planner fails closed for no-op, missing API, dependency failure, and downgrade", () => {
  const noUpdate = planSystemUpdate(catalog(releases), installed, ["org.gen1recomp.unknown"], apis)
  assert.equal(noUpdate.ok, false)
  if (!noUpdate.ok) assert.equal(noUpdate.error.code, "not_found")

  const currentOnly = planSystemUpdate(catalog([release(runtimeId, "0.1.0", "runtime")]), installed, [runtimeId], apis)
  assert.equal(currentOnly.ok, false)
  if (!currentOnly.ok) assert.equal(currentOnly.error.code, "no_update")

  const incompatible = planSystemUpdate(catalog(releases), installed, [coreId], { hostProtocol: "1.0.0" })
  assert.equal(incompatible.ok, false)
  if (!incompatible.ok) assert.equal(incompatible.error.code, "incompatible")

  const downgrade = planSystemUpdate(
    catalog([
      release(runtimeId, "0.2.0", "runtime"),
      release(coreId, "0.1.97", "core", [{ id: runtimeId, range: "0.2.0" }]),
    ]),
    { [runtimeId]: "0.3.0", [coreId]: "0.1.96" },
    [coreId],
    {},
  )
  assert.equal(downgrade.ok, false)
  if (!downgrade.ok) assert.equal(downgrade.error.code, "downgrade")
})

test("mod catalogs cannot be consumed by the system planner", () => {
  const modCatalog: UpdateCatalog = { ...catalog(releases), domain: "mods" }
  const result = planSystemUpdate(modCatalog, installed, [runtimeId], apis)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, "wrong_domain")
})
