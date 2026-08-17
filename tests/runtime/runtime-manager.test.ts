import assert from "node:assert/strict"
import test from "node:test"

import type {
  LuaRuntimePort,
  RuntimeBootRequest,
  RuntimeDescriptor,
  RuntimeError,
  RuntimeState,
} from "../../components/contracts/src/runtime.js"
import { err, ok, type Result } from "../../components/contracts/src/result.js"
import { RuntimeManager } from "../../runtime/manager/runtime-manager.js"

const descriptor: RuntimeDescriptor = {
  id: "org.gen1recomp.runtime.lovejs",
  version: "0.1.0",
  apiVersion: "1.0.0",
  luaVersion: "5.1",
  loveVersion: "11.5.0",
  capabilities: new Set(["lua51", "bitLibrary", "webAssembly", "webgl2"]),
}

const request: RuntimeBootRequest = {
  sessionId: "session-1",
  payloadVirtualPath: "component/core/0.1.96/game.love",
  storageNamespace: "game-red",
  query: {},
}

class FakeRuntime implements LuaRuntimePort {
  descriptor: RuntimeDescriptor = descriptor
  bootResult: Promise<Result<void, RuntimeError>> = Promise.resolve(ok(undefined))
  suspendResult: Result<void, RuntimeError> = ok(undefined)
  suspendCalls = 0
  resumeCalls = 0
  stopCalls = 0
  bootCalls = 0

  public async describe(): Promise<RuntimeDescriptor> {
    return this.descriptor
  }

  public async boot(_request: RuntimeBootRequest): Promise<Result<void, RuntimeError>> {
    this.bootCalls += 1
    return this.bootResult
  }

  public async suspend(_reason: string): Promise<Result<void, RuntimeError>> {
    this.suspendCalls += 1
    return this.suspendResult
  }

  public async resume(): Promise<Result<void, RuntimeError>> {
    this.resumeCalls += 1
    return ok(undefined)
  }

  public async stop(): Promise<Result<void, RuntimeError>> {
    this.stopCalls += 1
    return ok(undefined)
  }

  public state(): RuntimeState {
    return { status: "idle" }
  }
}

const verify = (_evidence: unknown): Result<RuntimeDescriptor, RuntimeError> => ok(descriptor)

test("runtime manager boots, suspends, resumes, and stops through valid states", async () => {
  const backend = new FakeRuntime()
  const manager = new RuntimeManager("org.gen1recomp.runtime.lovejs", backend, verify)
  assert.equal((await manager.boot(request, {})).ok, true)
  assert.deepEqual(manager.state(), { status: "running", sessionId: "session-1" })
  assert.equal((await manager.suspend("background")).ok, true)
  assert.deepEqual(manager.state(), {
    status: "suspended",
    sessionId: "session-1",
    reason: "background",
  })
  assert.equal((await manager.suspend("duplicate")).ok, true)
  assert.equal(backend.suspendCalls, 1)
  assert.equal((await manager.resume()).ok, true)
  assert.equal((await manager.resume()).ok, true)
  assert.equal(backend.resumeCalls, 1)
  assert.equal((await manager.stop()).ok, true)
  assert.deepEqual(manager.state(), { status: "stopped" })
  assert.equal(backend.stopCalls, 1)
})

test("runtime manager rejects malformed boot requests before evidence or backend use", async () => {
  const backend = new FakeRuntime()
  let verifierCalls = 0
  const manager = new RuntimeManager("org.gen1recomp.runtime.lovejs", backend, () => {
    verifierCalls += 1
    return ok(descriptor)
  })
  const result = await manager.boot({
    ...request,
    payloadVirtualPath: "../game.love",
  }, {})
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, "invalid_payload")
  assert.equal(verifierCalls, 0)
  assert.equal(backend.bootCalls, 0)
})

test("runtime manager refuses evidence and backend descriptor mismatches", async () => {
  const backend = new FakeRuntime()
  const denied = new RuntimeManager("org.gen1recomp.runtime.lovejs", backend, () => err({
    code: "capability",
    message: "Scripting device evidence missing",
    retryable: true,
  }))
  const deniedResult = await denied.boot(request, {})
  assert.equal(deniedResult.ok, false)
  assert.equal(backend.bootCalls, 0)
  assert.equal(denied.state().status, "failed")

  backend.descriptor = { ...descriptor, loveVersion: "12.0.0" }
  const mismatch = new RuntimeManager("org.gen1recomp.runtime.lovejs", backend, verify)
  const mismatchResult = await mismatch.boot(request, {})
  assert.equal(mismatchResult.ok, false)
  if (!mismatchResult.ok) assert.equal(mismatchResult.error.code, "incompatible")
  assert.equal(backend.bootCalls, 0)
})

test("runtime manager contains verifier exceptions as internal failures", async () => {
  const backend = new FakeRuntime()
  const manager = new RuntimeManager("org.gen1recomp.runtime.lovejs", backend, () => {
    throw new Error("verifier defect")
  })
  const result = await manager.boot(request, {})
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.error.code, "internal")
    assert.match(result.error.message, /verifier defect/)
  }
  assert.equal(manager.state().status, "failed")
  assert.equal(backend.bootCalls, 0)
})

test("runtime manager reports concurrent operations as busy", async () => {
  const backend = new FakeRuntime()
  let release: ((result: Result<void, RuntimeError>) => void) | undefined
  backend.bootResult = new Promise((resolve) => { release = resolve })
  const manager = new RuntimeManager("org.gen1recomp.runtime.lovejs", backend, verify)
  const boot = manager.boot(request, {})
  await new Promise((resolve) => setTimeout(resolve, 0))
  const concurrent = await manager.stop()
  assert.equal(concurrent.ok, false)
  if (!concurrent.ok) assert.equal(concurrent.error.code, "busy")
  release?.(ok(undefined))
  assert.equal((await boot).ok, true)
})

test("runtime manager converts backend errors to failed state", async () => {
  const backend = new FakeRuntime()
  backend.bootResult = Promise.resolve(err({
    code: "startup",
    message: "WASM trap",
    retryable: true,
  }))
  const manager = new RuntimeManager("org.gen1recomp.runtime.lovejs", backend, verify)
  const result = await manager.boot(request, {})
  assert.equal(result.ok, false)
  assert.deepEqual(manager.state(), {
    status: "failed",
    code: "startup",
    message: "WASM trap",
    retryable: true,
  })
  assert.equal(backend.stopCalls, 1)
  assert.equal((await manager.suspend("background")).ok, false)
})

test("runtime manager requires cleanup after a lifecycle failure", async () => {
  const backend = new FakeRuntime()
  backend.suspendResult = err({
    code: "lifecycle",
    message: "flush deadline exceeded",
    retryable: true,
  })
  const manager = new RuntimeManager("org.gen1recomp.runtime.lovejs", backend, verify)
  assert.equal((await manager.boot(request, {})).ok, true)
  assert.equal((await manager.suspend("background")).ok, false)
  const prematureRetry = await manager.boot(request, {})
  assert.equal(prematureRetry.ok, false)
  if (!prematureRetry.ok) assert.equal(prematureRetry.error.code, "invalid_state")
  assert.equal((await manager.stop()).ok, true)
  backend.suspendResult = ok(undefined)
  assert.equal((await manager.boot(request, {})).ok, true)
})
