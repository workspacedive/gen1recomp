import assert from "node:assert/strict"
import test from "node:test"

import type {
  RuntimeBootRequest,
  RuntimeDescriptor,
  RuntimeError,
} from "../../components/contracts/src/runtime.js"
import { err, ok, type Result } from "../../components/contracts/src/result.js"
import type { PersistenceError } from "../../runtime/adapters/lovejs/persistence.js"
import {
  LoveJsRuntimePort,
  type LoveJsGameSurfacePort,
  type LoveJsPersistencePort,
} from "../../runtime/adapters/lovejs/runtime-port.js"

const descriptor: RuntimeDescriptor = {
  id: "org.gen1recomp.runtime.lovejs",
  version: "0.1.0",
  apiVersion: "1.0.0",
  luaVersion: "5.1",
  loveVersion: "11.5.0",
  capabilities: new Set(["lua51", "webAssembly", "persistentStorage"]),
}

const request: RuntimeBootRequest = {
  sessionId: "runtime-session-1",
  payloadVirtualPath: "components/core/0.1.96/game.love",
  storageNamespace: "red-save",
  query: {},
}

class FakePersistence implements LoveJsPersistencePort {
  readonly events: string[]
  populateResult: Result<void, PersistenceError> = ok(undefined)
  flushResults: Result<void, PersistenceError>[] = []

  constructor(events: string[]) {
    this.events = events
  }

  async populate(reason = "runtime-start"): Promise<Result<void, PersistenceError>> {
    this.events.push(`populate:${reason}`)
    return this.populateResult
  }

  async flush(reason: string): Promise<Result<void, PersistenceError>> {
    this.events.push(`flush:${reason}`)
    return this.flushResults.shift() ?? ok(undefined)
  }
}

class FakeSurface implements LoveJsGameSurfacePort {
  readonly events: string[]
  startResult: Promise<Result<void, RuntimeError>> = Promise.resolve(ok(undefined))
  quiesceResults: Result<void, RuntimeError>[] = []
  resumeResult: Result<void, RuntimeError> = ok(undefined)
  disposeResult: Result<void, RuntimeError> = ok(undefined)

  constructor(events: string[]) {
    this.events = events
  }

  async start(value: RuntimeBootRequest): Promise<Result<void, RuntimeError>> {
    this.events.push(`start:${value.sessionId}`)
    return this.startResult
  }

  async quiesce(reason: string): Promise<Result<void, RuntimeError>> {
    this.events.push(`quiesce:${reason}`)
    return this.quiesceResults.shift() ?? ok(undefined)
  }

  async resume(): Promise<Result<void, RuntimeError>> {
    this.events.push("resume")
    return this.resumeResult
  }

  async dispose(): Promise<Result<void, RuntimeError>> {
    this.events.push("dispose")
    return this.disposeResult
  }
}

function fixture(
  startupPersistence: "surface" | "port" = "port",
): {
  events: string[]
  persistence: FakePersistence
  surface: FakeSurface
  runtime: LoveJsRuntimePort
} {
  const events: string[] = []
  const persistence = new FakePersistence(events)
  const surface = new FakeSurface(events)
  return {
    events,
    persistence,
    surface,
    runtime: new LoveJsRuntimePort(
      descriptor,
      surface,
      persistence,
      { startupPersistence },
    ),
  }
}

function persistenceError(operation: "populate" | "flush", reason: string): PersistenceError {
  return {
    code: "sync_failed",
    operation,
    reason,
    message: "IndexedDB unavailable",
  }
}

test("love.js runtime orders population, lifecycle barriers, and disposal", async () => {
  const { events, runtime } = fixture()
  assert.equal((await runtime.boot(request)).ok, true)
  assert.deepEqual(runtime.state(), {
    status: "running",
    sessionId: "runtime-session-1",
  })
  assert.equal((await runtime.suspend("background")).ok, true)
  assert.deepEqual(runtime.state(), {
    status: "suspended",
    sessionId: "runtime-session-1",
    reason: "background",
  })
  assert.equal((await runtime.suspend("duplicate")).ok, true)
  assert.equal((await runtime.resume()).ok, true)
  assert.equal((await runtime.resume()).ok, true)
  assert.equal((await runtime.stop()).ok, true)
  assert.deepEqual(runtime.state(), { status: "stopped" })
  assert.deepEqual(events, [
    "populate:runtime-start",
    "start:runtime-session-1",
    "quiesce:lifecycle-suspend:background",
    "flush:lifecycle-suspend:background",
    "resume",
    "quiesce:runtime-stop",
    "flush:runtime-stop",
    "dispose",
  ])
})

test("pinned player surface owns startup population before the port takes over flushes", async () => {
  const { events, runtime } = fixture("surface")
  assert.equal((await runtime.boot(request)).ok, true)
  assert.equal((await runtime.stop()).ok, true)
  assert.deepEqual(events, [
    "start:runtime-session-1",
    "quiesce:runtime-stop",
    "flush:runtime-stop",
    "dispose",
  ])
})

test("love.js runtime rejects malformed requests before persistence or surface work", async () => {
  const { events, runtime } = fixture()
  const result = await runtime.boot({
    ...request,
    payloadVirtualPath: "../game.love",
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, "invalid_payload")
  assert.deepEqual(events, [])
})

test("love.js runtime never starts the surface when population fails", async () => {
  const { events, persistence, runtime } = fixture()
  persistence.populateResult = err(persistenceError("populate", "runtime-start"))
  const result = await runtime.boot(request)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.error.code, "startup")
    assert.match(result.error.message, /IndexedDB unavailable/)
  }
  assert.deepEqual(events, ["populate:runtime-start"])
  assert.equal((await runtime.stop()).ok, true)
  assert.deepEqual(runtime.state(), { status: "stopped" })
})

test("love.js runtime cleans up a partially failed surface start", async () => {
  const { events, surface, runtime } = fixture()
  surface.startResult = Promise.resolve(err({
    code: "startup",
    message: "WASM instantiation failed",
    retryable: true,
  }))
  assert.equal((await runtime.boot(request)).ok, false)
  assert.equal((await runtime.stop()).ok, true)
  assert.deepEqual(events, [
    "populate:runtime-start",
    "start:runtime-session-1",
    "flush:runtime-stop",
    "dispose",
  ])
})

test("surface-owned startup does not flush an unavailable FS after start failure", async () => {
  const { events, surface, runtime } = fixture("surface")
  surface.startResult = Promise.resolve(err({
    code: "startup",
    message: "love.js failed before FS initialization",
    retryable: true,
  }))
  assert.equal((await runtime.boot(request)).ok, false)
  assert.equal((await runtime.stop()).ok, true)
  assert.deepEqual(events, ["start:runtime-session-1", "dispose"])
})

test("love.js runtime retains a quiesced surface when flush fails and retries safely", async () => {
  const { events, persistence, runtime } = fixture()
  assert.equal((await runtime.boot(request)).ok, true)
  persistence.flushResults.push(
    err(persistenceError("flush", "lifecycle-suspend:background")),
    ok(undefined),
  )
  const suspended = await runtime.suspend("background")
  assert.equal(suspended.ok, false)
  assert.equal(runtime.state().status, "failed")
  assert.equal((await runtime.stop()).ok, true)
  assert.deepEqual(events, [
    "populate:runtime-start",
    "start:runtime-session-1",
    "quiesce:lifecycle-suspend:background",
    "flush:lifecycle-suspend:background",
    "flush:runtime-stop",
    "dispose",
  ])
})

test("love.js runtime refuses overlap while surface startup is pending", async () => {
  const { surface, runtime } = fixture()
  let release: ((result: Result<void, RuntimeError>) => void) | undefined
  surface.startResult = new Promise((resolve) => { release = resolve })
  const boot = runtime.boot(request)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const concurrent = await runtime.stop()
  assert.equal(concurrent.ok, false)
  if (!concurrent.ok) assert.equal(concurrent.error.code, "busy")
  release?.(ok(undefined))
  assert.equal((await boot).ok, true)
})

test("love.js runtime snapshots descriptors and isolates capability sets", async () => {
  const { runtime } = fixture()
  const first = await runtime.describe()
  const mutableCapabilities = first.capabilities as Set<string>
  mutableCapabilities.add("threads")
  const second = await runtime.describe()
  assert.equal(second.capabilities.has("threads"), false)
  assert.equal(second.capabilities.has("persistentStorage"), true)
})
