import assert from "node:assert/strict"
import test from "node:test"

import type { ComponentManifest } from "../../components/contracts/src/component-manifest.js"
import { evaluateCompatibility } from "../../components/updates/src/compatibility-evaluator.js"

function manifest(compatibility: Readonly<Record<string, string>>): ComponentManifest {
  return {
    schemaVersion: 1,
    id: "org.gen1recomp.core",
    kind: "core",
    version: "0.1.96",
    apiVersion: "1.0.0",
    artifact: {
      path: "core/game.love",
      size: 1,
      integrity: { algorithm: "sha256", digest: "0".repeat(64) },
    },
    dependencies: [],
    compatibility,
    capabilities: [],
    migrations: [],
    selfTests: [],
  }
}

test("compatibility evaluator accepts only matched semantic API ranges", () => {
  const report = evaluateCompatibility(
    [manifest({ hostProtocol: "^1.0.0", loveApi: "11.5.x", modApi: ">=2 <3" })],
    { hostProtocol: "1.3.0", loveApi: "11.5.0", modApi: "2.0.0" },
  )
  assert.equal(report.compatible, true)
  assert.ok(report.checks.every(({ status }) => status === "matched"))
})

test("compatibility evaluator attributes missing and unsatisfied APIs", () => {
  const report = evaluateCompatibility(
    [manifest({ hostProtocol: "^1.0.0", loveApi: "^11.5.0" })],
    { hostProtocol: "2.0.0" },
  )
  assert.equal(report.compatible, false)
  assert.deepEqual(report.checks.map(({ api, status }) => [api, status]), [
    ["hostProtocol", "unsatisfied"],
    ["loveApi", "missing"],
  ])
})

test("compatibility evaluator refuses malformed requirements and provided versions", () => {
  const report = evaluateCompatibility(
    [manifest({ badRequirement: "not a range", badProvider: "*" })],
    { badRequirement: "1.0.0", badProvider: "not a version" },
  )
  assert.equal(report.compatible, false)
  assert.deepEqual(report.checks.map(({ status }) => status), [
    "invalid_provided",
    "invalid_requirement",
  ])
})
