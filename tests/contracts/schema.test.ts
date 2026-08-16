import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import type { AnySchema } from "ajv"
import Ajv2020 from "ajv/dist/2020.js"

const ajv = new Ajv2020({ allErrors: true, strict: true })

function schema(path: string): AnySchema {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as AnySchema
}

const componentManifest = ajv.compile(
  schema("../../../../schemas/component-manifest.schema.json"),
)
const updateCatalog = ajv.compile(
  schema("../../../../schemas/update-catalog.schema.json"),
)
const modRegistry = ajv.compile(
  schema("../../../../schemas/mod-registry.schema.json"),
)
const hostMessage = ajv.compile(
  schema("../../../../schemas/host-message.schema.json"),
)
const activationJournal = ajv.compile(
  schema("../../../../schemas/activation-journal.schema.json"),
)
const runtimeCapabilityReport = ajv.compile(
  schema("../../../../schemas/runtime-capability-report.schema.json"),
)

const validManifest = {
  schemaVersion: 1,
  id: "org.gen1recomp.core",
  kind: "core",
  version: "0.1.96",
  apiVersion: "1.0.0",
  artifact: {
    path: "core/game.love",
    size: 42,
    integrity: { algorithm: "sha256", digest: "b".repeat(64) },
  },
  dependencies: [{ id: "org.gen1recomp.kernel", range: "^1.0.0" }],
  compatibility: { modApi: "1 || 2" },
  capabilities: [],
  migrations: [],
  selfTests: [],
}

test("JSON Schema 2020-12 accepts a complete component manifest", () => {
  assert.equal(componentManifest(validManifest), true, JSON.stringify(componentManifest.errors))
})

test("published system update catalog matches the closed catalog and component schemas", () => {
  const catalog = JSON.parse(readFileSync(new URL(
    "../../../../updates/catalog/stable.json",
    import.meta.url,
  ), "utf8")) as unknown
  assert.equal(updateCatalog(catalog), true, JSON.stringify(updateCatalog.errors))
  assert.equal(updateCatalog({ ...(catalog as Record<string, unknown>), surprise: true }), false)
})

test("mod registry schema accepts inactive immutable packages and rejects implicit enablement", () => {
  const registry = {
    schemaVersion: 1,
    updatedAt: "2026-08-16T22:36:04.000Z",
    mods: [{
      id: "potato_voxel",
      name: "PotatoVoxel",
      version: "1.7.4",
      api: 2,
      entry: "main.lua",
      category: "GRAPHICS",
      profile: "content",
      description: "External test record only",
      github: "ShaneMcGovernIE/potato_voxel",
      permissions: ["engine_internals", "network"],
      conflicts: ["DRAMATIC_SHAPE"],
      dependencies: [],
      packagePath: "/private/mods/potato_voxel/1.7.4",
      packageSha256: "d".repeat(64),
      source: "github",
      releaseTag: "v1.7.4",
      previousVersion: null,
      enabled: false,
      installedAt: "2026-08-16T22:36:04.000Z",
      updatedAt: "2026-08-16T22:36:04.000Z",
    }],
  }
  assert.equal(modRegistry(registry), true, JSON.stringify(modRegistry.errors))
  assert.equal(modRegistry({ ...registry, mods: [{ ...registry.mods[0], enabled: true }] }), false)
})

test("component schema rejects unknown fields and non-SHA-256 integrity", () => {
  const invalid = {
    ...validManifest,
    undocumented: true,
    artifact: {
      ...validManifest.artifact,
      integrity: { algorithm: "sha256", digest: "bad" },
    },
  }
  assert.equal(componentManifest(invalid), false)
  assert.ok((componentManifest.errors?.length ?? 0) >= 2)
})

test("component schema requires canonical three-part API versions", () => {
  assert.equal(componentManifest({ ...validManifest, apiVersion: "1.0" }), false)
  assert.equal(componentManifest({ ...validManifest, apiVersion: "01.0.0" }), false)
})

test("activation journal schema closes phases, component IDs, and versions", () => {
  assert.equal(activationJournal({
    schemaVersion: 1,
    transactionId: "update-1",
    phase: "tested",
    previous: { "org.gen1recomp.core": "0.1.95" },
    candidate: { "org.gen1recomp.core": "0.1.96" },
  }), true, JSON.stringify(activationJournal.errors))
  assert.equal(activationJournal({
    schemaVersion: 1,
    transactionId: "update-1",
    phase: "committed",
    previous: {},
    candidate: { core: "latest" },
  }), false)
})

test("runtime capability schema accepts functional evidence and rejects invented checks", () => {
  const canonical = JSON.parse(readFileSync(new URL(
    "../../../../docs/gen1recomp/runtime-capability-report.outside-browser.json",
    import.meta.url,
  ), "utf8")) as unknown
  assert.equal(
    runtimeCapabilityReport(canonical),
    true,
    JSON.stringify(runtimeCapabilityReport.errors),
  )
  const valid = {
    schemaVersion: 1,
    purpose: "live-activation",
    sessionId: "capability-session-1",
    runtimeRevision: "9355186de22db13bd88bf2a0db75d2925647d036",
    observedAt: "2026-08-16T11:22:42.019Z",
    environment: {
      host: "outside-browser",
      hostVersion: "149.0.7827.0",
      osVersion: null,
      renderer: "SwiftShader",
    },
    checks: {
      "web.wasm": { status: "pass", observed: true },
      "thread.workerRoundtrip": {
        status: "unavailable",
        observed: "worker construction failed",
      },
    },
  }
  assert.equal(runtimeCapabilityReport(valid), true, JSON.stringify(runtimeCapabilityReport.errors))
  assert.equal(runtimeCapabilityReport({
    ...valid,
    checks: { "graphics.metal": { status: "pass", observed: true } },
  }), false)
  assert.equal(runtimeCapabilityReport({ ...valid, sessionId: "../stale" }), false)
  assert.equal(runtimeCapabilityReport({ ...valid, runtimeRevision: "main" }), false)
  assert.equal(runtimeCapabilityReport({ ...valid, observedAt: "2026-08-16 11:22" }), false)
})

test("host schema distinguishes success and failure responses", () => {
  assert.equal(hostMessage({
    kind: "response",
    protocol: 1,
    requestId: "req-1",
    ok: true,
    payload: { available: true },
  }), true, JSON.stringify(hostMessage.errors))

  assert.equal(hostMessage({
    kind: "response",
    protocol: 1,
    requestId: "req-1",
    ok: false,
    payload: null,
    error: { code: "unavailable", message: "No runtime", retryable: true },
  }), false)
})

test("host schema rejects unknown methods and message fields", () => {
  assert.equal(hostMessage({
    kind: "request",
    protocol: 1,
    requestId: "req-2",
    method: "render.frame",
    payload: {},
    frame: 1,
  }), false)
})
