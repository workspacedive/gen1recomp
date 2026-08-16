import assert from "node:assert/strict"
import test from "node:test"

import type { ComponentKind } from "../../components/contracts/src/component-manifest.js"
import {
  catalogArtifactURL,
  parseUpdateCatalog,
  verifyCatalogTrust,
  type CatalogTrustPolicy,
  type UpdateCatalog,
} from "../../components/updates/src/update-catalog.js"

function manifest(id: string, version: string, kind: ComponentKind = "core") {
  return {
    schemaVersion: 1,
    id,
    kind,
    version,
    apiVersion: "1.0.0",
    artifact: {
      path: `${id}-${version}.zip`,
      size: 42,
      integrity: { algorithm: "sha256", digest: "a".repeat(64) },
    },
    dependencies: [],
    compatibility: {},
    capabilities: [],
    migrations: [],
    selfTests: [],
  }
}

function rawCatalog() {
  return {
    schemaVersion: 1,
    catalogId: "org.gen1recomp.system",
    domain: "system",
    channel: "stable",
    sequence: 4,
    generatedAt: "2026-08-16T12:00:00.000Z",
    artifactBaseURL: "https://raw.githubusercontent.com/workspacedive/gen1recomp/main/updates/artifacts/",
    releases: [
      {
        manifest: manifest("org.gen1recomp.core", "0.1.96"),
        publishedAt: "2026-08-01T10:00:00.000Z",
        notes: { en: "Current core", de: "Aktueller Core" },
      },
      {
        manifest: manifest("org.gen1recomp.core", "0.1.97"),
        publishedAt: "2026-08-16T10:00:00.000Z",
        notes: { en: "New core" },
      },
    ],
  }
}

const sourceURL = "https://raw.githubusercontent.com/workspacedive/gen1recomp/main/updates/catalog/stable.json"
const policy: CatalogTrustPolicy = {
  catalogId: "org.gen1recomp.system",
  domain: "system",
  channel: "stable",
  sourceURLs: [sourceURL],
  artifactBaseURLs: ["https://raw.githubusercontent.com/workspacedive/gen1recomp/main/updates/artifacts/"],
}

test("catalog parser validates and deterministically sorts newest releases first", () => {
  const result = parseUpdateCatalog(rawCatalog())
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.value.releases.map(({ manifest: value }) => value.version), ["0.1.97", "0.1.96"])
  assert.equal(
    catalogArtifactURL(result.value, result.value.releases[0]!),
    "https://raw.githubusercontent.com/workspacedive/gen1recomp/main/updates/artifacts/org.gen1recomp.core-0.1.97.zip",
  )
})

test("catalog parser rejects unknown fields, duplicate releases, and non-canonical timestamps", () => {
  assert.equal(parseUpdateCatalog({ ...rawCatalog(), surprise: true }).ok, false)
  const duplicated = rawCatalog()
  duplicated.releases.push(structuredClone(duplicated.releases[0]!))
  const duplicateResult = parseUpdateCatalog(duplicated)
  assert.equal(duplicateResult.ok, false)
  if (!duplicateResult.ok) assert.equal(duplicateResult.error.code, "duplicate")
  assert.equal(parseUpdateCatalog({ ...rawCatalog(), generatedAt: "2026-08-16" }).ok, false)
})

test("trust policy pins catalog identity, source, artifact path, and rollback sequence", () => {
  const parsed = parseUpdateCatalog(rawCatalog())
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(verifyCatalogTrust(parsed.value, sourceURL, policy, 4).ok, true)

  const wrongSource = verifyCatalogTrust(parsed.value, "https://example.com/stable.json", policy, 4)
  assert.equal(wrongSource.ok, false)
  if (!wrongSource.ok) assert.equal(wrongSource.error.code, "source")

  const rollback = verifyCatalogTrust(parsed.value, sourceURL, policy, 5)
  assert.equal(rollback.ok, false)
  if (!rollback.ok) assert.equal(rollback.error.code, "rollback")

  const escaped: UpdateCatalog = {
    ...parsed.value,
    releases: [{
      ...parsed.value.releases[0]!,
      manifest: {
        ...parsed.value.releases[0]!.manifest,
        artifact: {
          ...parsed.value.releases[0]!.manifest.artifact,
          path: "https://evil.example/package.zip",
        },
      },
    }],
  }
  const escapedResult = verifyCatalogTrust(escaped, sourceURL, policy, 4)
  assert.equal(escapedResult.ok, false)
  if (!escapedResult.ok) assert.equal(escapedResult.error.code, "artifact_source")
})

test("system and mod catalog domains cannot mix component kinds", () => {
  const parsed = parseUpdateCatalog(rawCatalog())
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const mixed: UpdateCatalog = {
    ...parsed.value,
    releases: [{
      ...parsed.value.releases[0]!,
      manifest: { ...parsed.value.releases[0]!.manifest, kind: "mod" },
    }],
  }
  const result = verifyCatalogTrust(mixed, sourceURL, policy, 4)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, "mixed_domain")
})
