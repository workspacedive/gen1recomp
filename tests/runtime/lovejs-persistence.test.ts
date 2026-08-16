import assert from "node:assert/strict"
import test from "node:test"

import {
  LoveJsPersistenceAdapter,
  type EmscriptenFileSystem,
} from "../../runtime/adapters/lovejs/persistence.js"

class ControlledFileSystem implements EmscriptenFileSystem {
  readonly calls: boolean[] = []
  readonly callbacks: Array<(error?: unknown) => void> = []

  public syncfs(populate: boolean, callback: (error?: unknown) => void): void {
    this.calls.push(populate)
    this.callbacks.push(callback)
  }
}

test("persistence adapter serializes populate and flush operations", async () => {
  const fs = new ControlledFileSystem()
  const adapter = new LoveJsPersistenceAdapter(fs, { timeoutMs: 1000 })
  const populate = adapter.populate()
  const flush = adapter.flush("lifecycle-suspend")

  await Promise.resolve()
  assert.deepEqual(fs.calls, [true])
  assert.deepEqual(adapter.state(), {
    status: "syncing",
    operation: "populate",
    reason: "runtime-start",
  })

  fs.callbacks[0]?.()
  assert.equal((await populate).ok, true)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(fs.calls, [true, false])
  fs.callbacks[1]?.()
  assert.equal((await flush).ok, true)
  assert.deepEqual(adapter.state(), { status: "idle" })
})

test("persistence adapter attributes callback failures", async () => {
  const fs = new ControlledFileSystem()
  const adapter = new LoveJsPersistenceAdapter(fs, { timeoutMs: 1000 })
  const operation = adapter.flush("save-commit")
  await Promise.resolve()
  fs.callbacks[0]?.(new Error("IndexedDB unavailable"))
  const result = await operation
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.error.code, "sync_failed")
    assert.equal(result.error.operation, "flush")
    assert.match(result.error.message, /IndexedDB unavailable/)
  }
  assert.equal(adapter.state().status, "failed")
})

test("persistence adapter converts synchronous throws and timeouts to results", async () => {
  const throwing: EmscriptenFileSystem = {
    syncfs: () => { throw new Error("missing mount") },
  }
  const thrown = await new LoveJsPersistenceAdapter(throwing, { timeoutMs: 100 }).populate()
  assert.equal(thrown.ok, false)
  if (!thrown.ok) assert.equal(thrown.error.code, "sync_failed")

  const stalled: EmscriptenFileSystem = { syncfs: () => undefined }
  const timedOut = await new LoveJsPersistenceAdapter(stalled, { timeoutMs: 5 }).flush("test")
  assert.equal(timedOut.ok, false)
  if (!timedOut.ok) assert.equal(timedOut.error.code, "timeout")
})

test("persistence adapter rejects invalid policy and empty flush reasons", async () => {
  const fs = new ControlledFileSystem()
  assert.throws(() => new LoveJsPersistenceAdapter(fs, { timeoutMs: 0 }), RangeError)
  const adapter = new LoveJsPersistenceAdapter(fs, { timeoutMs: 100 })
  const result = await adapter.flush("  ")
  assert.equal(result.ok, false)
  assert.deepEqual(fs.calls, [])
})
