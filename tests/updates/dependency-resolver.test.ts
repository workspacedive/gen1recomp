import assert from "node:assert/strict"
import test from "node:test"

import type {
  ComponentDependency,
  ComponentManifest,
} from "../../components/contracts/src/component-manifest.js"
import { resolveComponents } from "../../components/updates/src/dependency-resolver.js"

function manifest(
  id: string,
  version: string,
  dependencies: readonly ComponentDependency[] = [],
): ComponentManifest {
  return {
    schemaVersion: 1,
    id,
    kind: "runtime",
    version,
    apiVersion: "1.0.0",
    artifact: {
      path: `${id}/${version}.zip`,
      size: 0,
      integrity: { algorithm: "sha256", digest: "0".repeat(64) },
    },
    dependencies,
    compatibility: {},
    capabilities: [],
    migrations: [],
    selfTests: [],
  }
}

test("resolver chooses the newest compatible dependency and orders it first", () => {
  const kernel = manifest("org.gen1recomp.kernel", "1.0.0", [
    { id: "org.gen1recomp.love", range: "^11.5.0" },
  ])
  const love115 = manifest("org.gen1recomp.love", "11.5.0")
  const love116 = manifest("org.gen1recomp.love", "11.6.0")
  const love12 = manifest("org.gen1recomp.love", "12.0.0")

  const resolved = resolveComponents(
    [kernel, love115, love116, love12],
    [{ id: kernel.id, range: "1.x" }],
  )
  assert.equal(resolved.ok, true)
  if (!resolved.ok) return
  assert.equal(resolved.value.selected.get(love115.id)?.version, "11.6.0")
  assert.deepEqual(
    resolved.value.activationOrder.map(({ id, version }) => `${id}@${version}`),
    ["org.gen1recomp.love@11.6.0", "org.gen1recomp.kernel@1.0.0"],
  )
})

test("resolver backtracks when the newest component has unavailable dependencies", () => {
  const app1 = manifest("org.gen1recomp.app", "1.0.0", [
    { id: "org.gen1recomp.runtime", range: "^1.0.0" },
  ])
  const app2 = manifest("org.gen1recomp.app", "2.0.0", [
    { id: "org.gen1recomp.runtime", range: "^2.0.0" },
  ])
  const runtime = manifest("org.gen1recomp.runtime", "1.5.0")

  const resolved = resolveComponents(
    [app1, app2, runtime],
    [{ id: app1.id, range: ">=1" }],
  )
  assert.equal(resolved.ok, true)
  if (resolved.ok) assert.equal(resolved.value.selected.get(app1.id)?.version, "1.0.0")
})

test("optional dependencies constrain a component only when another root selects it", () => {
  const app = manifest("org.gen1recomp.app", "1.0.0", [
    { id: "org.gen1recomp.diagnostics", range: "^1.0.0", optional: true },
  ])
  const diagnostics = manifest("org.gen1recomp.diagnostics", "2.0.0")

  const withoutOptional = resolveComponents([app], [{ id: app.id, range: "*" }])
  assert.equal(withoutOptional.ok, true)
  if (withoutOptional.ok) assert.equal(withoutOptional.value.selected.size, 1)

  const incompatibleRoot = resolveComponents(
    [app, diagnostics],
    [{ id: app.id, range: "*" }, { id: diagnostics.id, range: "*" }],
  )
  assert.equal(incompatibleRoot.ok, false)
  if (!incompatibleRoot.ok) assert.equal(incompatibleRoot.error.code, "unsatisfied")
})

test("resolver reports dependency cycles", () => {
  const left = manifest("org.gen1recomp.left", "1.0.0", [
    { id: "org.gen1recomp.right", range: "1.0.0" },
  ])
  const right = manifest("org.gen1recomp.right", "1.0.0", [
    { id: "org.gen1recomp.left", range: "1.0.0" },
  ])
  const resolved = resolveComponents([left, right], [{ id: left.id, range: "*" }])
  assert.equal(resolved.ok, false)
  if (!resolved.ok) assert.equal(resolved.error.code, "cycle")
})

test("resolver rejects malformed ranges before activation", () => {
  const runtime = manifest("org.gen1recomp.runtime", "1.0.0")
  const resolved = resolveComponents([runtime], [{ id: runtime.id, range: "not a range !" }])
  assert.equal(resolved.ok, false)
  if (!resolved.ok) assert.equal(resolved.error.code, "invalid_range")
})
