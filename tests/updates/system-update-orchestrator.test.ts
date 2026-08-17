import assert from "node:assert/strict"
import test from "node:test"

import type { ComponentKind, ComponentManifest } from "../../components/contracts/src/component-manifest.js"
import { err, ok, type Result } from "../../components/contracts/src/result.js"
import type {
  ActivationSet,
  ActivationStore,
  ActivationStoreKey,
} from "../../components/updates/src/activation-journal.js"
import {
  SystemUpdateOrchestrator,
  type PackagePortError,
  type SystemUpdatePackagePort,
  type SystemUpdateProgress,
} from "../../components/updates/src/system-update-orchestrator.js"
import type { CatalogRelease, UpdateCatalog } from "../../components/updates/src/update-catalog.js"

class MemoryStore implements ActivationStore {
  readonly values = new Map<ActivationStoreKey, unknown>()

  public async read(key: ActivationStoreKey): Promise<unknown | null> {
    return this.values.get(key) ?? null
  }

  public async write(key: ActivationStoreKey, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value))
  }

  public async remove(key: ActivationStoreKey): Promise<void> {
    this.values.delete(key)
  }
}

class FakePackages implements SystemUpdatePackagePort {
  readonly staged: string[] = []
  readonly tested: string[] = []
  readonly cleanups: { transactionId: string; outcome: "committed" | "discarded" }[] = []
  health: Result<void, PackagePortError> = ok(undefined)
  stageFailure: PackagePortError | null = null
  afterStage: (() => void) | null = null
  stageBarrier: Promise<void> | null = null

  public async stagePackage(
    _transactionId: string,
    _catalog: UpdateCatalog,
    release: CatalogRelease,
    progress: Parameters<SystemUpdatePackagePort["stagePackage"]>[3],
  ): Promise<Result<void, PackagePortError>> {
    progress({ stage: "package", operation: "download", completedBytes: 5, totalBytes: 10 })
    if (this.stageBarrier !== null) await this.stageBarrier
    if (this.stageFailure !== null) return err(this.stageFailure)
    this.staged.push(release.manifest.id)
    this.afterStage?.()
    return ok(undefined)
  }

  public async testPackage(
    _transactionId: string,
    release: CatalogRelease,
  ): Promise<Result<void, PackagePortError>> {
    this.tested.push(release.manifest.id)
    return ok(undefined)
  }

  public async healthCheck(_candidate: ActivationSet): Promise<Result<void, PackagePortError>> {
    return this.health
  }

  public async cleanup(transactionId: string, outcome: "committed" | "discarded"): Promise<void> {
    this.cleanups.push({ transactionId, outcome })
  }
}

function release(
  id: string,
  version: string,
  kind: ComponentKind,
  dependencies: ComponentManifest["dependencies"] = [],
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
        integrity: { algorithm: "sha256", digest: "c".repeat(64) },
      },
      dependencies,
      compatibility: {},
      capabilities: [],
      migrations: [],
      selfTests: [],
    },
    publishedAt: "2026-08-16T12:00:00.000Z",
    notes: { en: "Update" },
  }
}

const runtimeId = "org.gen1recomp.runtime.lovejs"
const coreId = "org.gen1recomp.core"
const previous = { [runtimeId]: "0.1.0", [coreId]: "0.1.96" }
const candidate = { [runtimeId]: "0.2.0", [coreId]: "0.1.97" }
const catalog: UpdateCatalog = {
  schemaVersion: 1,
  catalogId: "org.gen1recomp.system",
  domain: "system",
  channel: "stable",
  sequence: 2,
  generatedAt: "2026-08-16T12:00:00.000Z",
  artifactBaseURL: "https://updates.example/system/",
  releases: [
    release(runtimeId, "0.1.0", "runtime"),
    release(runtimeId, "0.2.0", "runtime"),
    release(coreId, "0.1.96", "core", [{ id: runtimeId, range: "^0.1.0" }]),
    release(coreId, "0.1.97", "core", [{ id: runtimeId, range: "^0.2.0" }]),
  ],
}

function setup() {
  const store = new MemoryStore()
  store.values.set("active", previous)
  store.values.set("knownGood", previous)
  const packages = new FakePackages()
  return { store, packages, orchestrator: new SystemUpdateOrchestrator(store, packages) }
}

test("manual system update stages, tests, activates, health-checks, and commits dependency-first", async () => {
  const { store, packages, orchestrator } = setup()
  const progress: SystemUpdateProgress[] = []
  const result = await orchestrator.execute({
    transactionId: "manual-1",
    catalog,
    installed: previous,
    requestedComponentIds: [coreId],
    providedApis: {},
  }, (event) => progress.push(event))

  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value.active, candidate)
  assert.deepEqual(packages.staged, [runtimeId, coreId])
  assert.deepEqual(packages.tested, [runtimeId, coreId])
  assert.deepEqual(packages.cleanups, [{ transactionId: "manual-1", outcome: "committed" }])
  assert.deepEqual(store.values.get("active"), candidate)
  assert.deepEqual(store.values.get("knownGood"), candidate)
  assert.deepEqual(store.values.get("previous"), previous)
  assert.equal(store.values.has("journal"), false)
  assert.equal(progress.at(-1)?.stage, "completed")
})

test("failed activation health check restores the previous known-good set", async () => {
  const { store, packages, orchestrator } = setup()
  packages.health = err({
    code: "health_check",
    componentId: runtimeId,
    message: "runtime boot probe failed",
    retryable: false,
  })
  const result = await orchestrator.execute({
    transactionId: "manual-health-failure",
    catalog,
    installed: previous,
    requestedComponentIds: [runtimeId],
    providedApis: {},
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.error.code, "package")
    assert.equal(result.error.stage, "health_check")
  }
  assert.deepEqual(store.values.get("active"), previous)
  assert.deepEqual(store.values.get("knownGood"), previous)
  assert.equal(store.values.has("journal"), false)
  assert.deepEqual(packages.cleanups, [{ transactionId: "manual-health-failure", outcome: "discarded" }])
})

test("cancellation after staging is honored before pointer activation", async () => {
  const { store, packages, orchestrator } = setup()
  let cancelled = false
  packages.afterStage = () => { cancelled = true }
  const result = await orchestrator.execute({
    transactionId: "manual-cancel",
    catalog,
    installed: previous,
    requestedComponentIds: [runtimeId],
    providedApis: {},
    cancellation: { isCancelled: () => cancelled },
  })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, "cancelled")
  assert.deepEqual(store.values.get("active"), previous)
  assert.equal(store.values.has("journal"), false)
  assert.deepEqual(packages.cleanups, [{ transactionId: "manual-cancel", outcome: "discarded" }])
})

test("package failure is attributed and staging is recovered", async () => {
  const { store, packages, orchestrator } = setup()
  packages.stageFailure = {
    code: "integrity",
    componentId: runtimeId,
    message: "SHA-256 mismatch",
    retryable: false,
  }
  const result = await orchestrator.execute({
    transactionId: "manual-integrity-failure",
    catalog,
    installed: previous,
    requestedComponentIds: [runtimeId],
    providedApis: {},
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.error.code, "package")
    assert.equal(result.error.componentId, runtimeId)
    assert.match(result.error.message, /SHA-256/)
  }
  assert.deepEqual(store.values.get("active"), previous)
  assert.equal(store.values.has("journal"), false)
})

test("overlapping manual updates are rejected as busy", async () => {
  const { packages, orchestrator } = setup()
  const barrier: { release: (() => void) | null } = { release: null }
  packages.stageBarrier = new Promise<void>((resolve) => { barrier.release = resolve })
  const first = orchestrator.execute({
    transactionId: "manual-long",
    catalog,
    installed: previous,
    requestedComponentIds: [runtimeId],
    providedApis: {},
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  const second = await orchestrator.execute({
    transactionId: "manual-overlap",
    catalog,
    installed: previous,
    requestedComponentIds: [runtimeId],
    providedApis: {},
  })
  assert.equal(second.ok, false)
  if (!second.ok) assert.equal(second.error.code, "busy")
  assert.notEqual(barrier.release, null)
  barrier.release?.()
  assert.equal((await first).ok, true)
})
