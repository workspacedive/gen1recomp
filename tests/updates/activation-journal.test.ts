import assert from "node:assert/strict"
import test from "node:test"

import {
  ActivationCoordinator,
  type ActivationJournal,
  type ActivationStore,
  type ActivationStoreKey,
} from "../../components/updates/src/activation-journal.js"

class MemoryStore implements ActivationStore {
  readonly values = new Map<ActivationStoreKey, unknown>()
  failWhen: ((operation: "read" | "write" | "remove", key: ActivationStoreKey, value?: unknown) => boolean) | null = null

  public async read(key: ActivationStoreKey): Promise<unknown | null> {
    if (this.failWhen?.("read", key) === true) throw new Error(`injected read failure: ${key}`)
    return this.values.get(key) ?? null
  }

  public async write(key: ActivationStoreKey, value: unknown): Promise<void> {
    if (this.failWhen?.("write", key, value) === true) throw new Error(`injected write failure: ${key}`)
    this.values.set(key, structuredClone(value))
  }

  public async remove(key: ActivationStoreKey): Promise<void> {
    if (this.failWhen?.("remove", key) === true) throw new Error(`injected remove failure: ${key}`)
    this.values.delete(key)
  }
}

const previous = { "org.gen1recomp.core": "0.1.95" }
const candidate = { "org.gen1recomp.core": "0.1.96" }

function journal(phase: ActivationJournal["phase"]): ActivationJournal {
  return {
    schemaVersion: 1,
    transactionId: "update-1",
    phase,
    previous,
    candidate,
  }
}

test("activation follows prepare, verify, test, activate, and commit phases", async () => {
  const store = new MemoryStore()
  store.values.set("active", previous)
  store.values.set("knownGood", previous)
  const coordinator = new ActivationCoordinator(store)

  assert.equal((await coordinator.prepare("update-1", candidate)).ok, true)
  assert.equal((await coordinator.markVerified()).ok, true)
  assert.equal((await coordinator.markTested()).ok, true)
  assert.equal((await coordinator.activate()).ok, true)
  assert.deepEqual(store.values.get("active"), candidate)
  assert.equal((store.values.get("journal") as ActivationJournal).phase, "activated")
  assert.equal((await coordinator.commit()).ok, true)

  assert.equal(store.values.has("journal"), false)
  assert.deepEqual(store.values.get("active"), candidate)
  assert.deepEqual(store.values.get("knownGood"), candidate)
  assert.deepEqual(store.values.get("previous"), previous)
})

test("failure after pointer replacement leaves a journal that recovery can roll back", async () => {
  const store = new MemoryStore()
  store.values.set("active", previous)
  store.values.set("knownGood", previous)
  const coordinator = new ActivationCoordinator(store)
  assert.equal((await coordinator.prepare("update-1", candidate)).ok, true)
  assert.equal((await coordinator.markVerified()).ok, true)
  assert.equal((await coordinator.markTested()).ok, true)

  store.failWhen = (operation, key, value) =>
    operation === "write" &&
    key === "journal" &&
    (value as Partial<ActivationJournal>).phase === "activated"
  const interrupted = await coordinator.activate()
  assert.equal(interrupted.ok, false)
  assert.deepEqual(store.values.get("active"), candidate)
  assert.equal((store.values.get("journal") as ActivationJournal).phase, "activating")

  store.failWhen = null
  const recovered = await coordinator.recover()
  assert.equal(recovered.ok, true)
  assert.deepEqual(store.values.get("active"), previous)
  assert.deepEqual(store.values.get("knownGood"), previous)
  assert.equal(store.values.has("journal"), false)
})

test("failure during commit remains conservatively recoverable", async () => {
  const store = new MemoryStore()
  store.values.set("active", previous)
  store.values.set("knownGood", previous)
  const coordinator = new ActivationCoordinator(store)
  await coordinator.prepare("update-1", candidate)
  await coordinator.markVerified()
  await coordinator.markTested()
  await coordinator.activate()

  store.failWhen = (operation, key) => operation === "remove" && key === "journal"
  const interrupted = await coordinator.commit()
  assert.equal(interrupted.ok, false)
  assert.deepEqual(store.values.get("active"), candidate)
  assert.deepEqual(store.values.get("knownGood"), candidate)
  assert.equal((store.values.get("journal") as ActivationJournal).phase, "activated")

  store.failWhen = null
  const recovered = await coordinator.recover()
  assert.equal(recovered.ok, true)
  assert.deepEqual(store.values.get("active"), previous)
  assert.deepEqual(store.values.get("knownGood"), previous)
  assert.equal(store.values.has("journal"), false)
})

test("recovery discards staging that never changed the active pointer", async () => {
  for (const phase of ["prepared", "verified", "tested"] as const) {
    const store = new MemoryStore()
    store.values.set("active", previous)
    store.values.set("journal", journal(phase))
    const result = await new ActivationCoordinator(store).recover()
    assert.deepEqual(result, {
      ok: true,
      value: { action: "discarded_staging", transactionId: "update-1", active: previous },
    })
    assert.deepEqual(store.values.get("active"), previous)
    assert.equal(store.values.has("journal"), false)
  }
})

test("recovery restores the previous set from every pointer-changing phase", async () => {
  for (const phase of ["activating", "activated", "rollingBack"] as const) {
    const store = new MemoryStore()
    store.values.set("active", candidate)
    store.values.set("knownGood", candidate)
    store.values.set("journal", journal(phase))
    const result = await new ActivationCoordinator(store).recover()
    assert.deepEqual(result, {
      ok: true,
      value: { action: "rolled_back", transactionId: "update-1", active: previous },
    })
    assert.deepEqual(store.values.get("active"), previous)
    assert.deepEqual(store.values.get("knownGood"), previous)
    assert.equal(store.values.has("journal"), false)
  }
})

test("recovery refuses a malformed journal without overwriting activation", async () => {
  const store = new MemoryStore()
  store.values.set("active", candidate)
  store.values.set("journal", { schemaVersion: 1, phase: "activated" })
  const result = await new ActivationCoordinator(store).recover()
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, "invalid_journal")
  assert.deepEqual(store.values.get("active"), candidate)
  assert.equal(store.values.has("journal"), true)
})

test("coordinator rejects non-canonical component IDs and versions", async () => {
  const store = new MemoryStore()
  store.values.set("active", previous)
  const coordinator = new ActivationCoordinator(store)
  const invalidId = await coordinator.prepare("bad-id", { core: "0.1.96" })
  assert.equal(invalidId.ok, false)
  if (!invalidId.ok) assert.equal(invalidId.error.code, "invalid_journal")
  const invalidVersion = await coordinator.prepare("bad-version", {
    "org.gen1recomp.core": "latest",
  })
  assert.equal(invalidVersion.ok, false)
  if (!invalidVersion.ok) assert.equal(invalidVersion.error.code, "invalid_journal")
  assert.equal(store.values.has("journal"), false)
})

test("coordinator rejects overlapping activation transactions", async () => {
  const store = new MemoryStore()
  store.values.set("active", previous)
  const coordinator = new ActivationCoordinator(store)
  assert.equal((await coordinator.prepare("first", candidate)).ok, true)
  const overlapping = await coordinator.prepare("second", previous)
  assert.equal(overlapping.ok, false)
  if (!overlapping.ok) assert.equal(overlapping.error.code, "busy")
})
