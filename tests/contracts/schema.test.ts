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
const hostMessage = ajv.compile(
  schema("../../../../schemas/host-message.schema.json"),
)
const activationJournal = ajv.compile(
  schema("../../../../schemas/activation-journal.schema.json"),
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
