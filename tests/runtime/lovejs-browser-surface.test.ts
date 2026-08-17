import assert from "node:assert/strict"
import test from "node:test"

import type { RuntimeBootRequest } from "../../components/contracts/src/runtime.js"
import { ok } from "../../components/contracts/src/result.js"
import {
  BrowserLoveJsGameSurface,
  type LoveJsBrowserBindings,
  type LoveJsBrowserMainLoopApi,
  type LoveJsBrowserModuleApi,
  type LoveJsBrowserSnapshot,
  type LoveJsPlayerApi,
} from "../../runtime/adapters/lovejs/browser-surface.js"

const request: RuntimeBootRequest = {
  sessionId: "browser-surface-1",
  payloadVirtualPath: "components/core/0.1.96/game.love",
  storageNamespace: "red-save",
  query: {},
}

class FakeMainLoop implements LoveJsBrowserMainLoopApi {
  currentFrameNumber = 10
  func: unknown = {}
  paused = false
  ignorePause = false

  pause(): void {
    if (!this.ignorePause) this.paused = true
  }

  resume(): void {
    this.paused = false
  }
}

class FakeBindings implements LoveJsBrowserBindings {
  time = 0
  spinnerClass: string | null = "pending"
  canvasVisible = false
  player: LoveJsPlayerApi | null = null
  module: LoveJsBrowserModuleApi | null = null
  readonly mainLoop = new FakeMainLoop()

  snapshot(): LoveJsBrowserSnapshot {
    return {
      player: this.player,
      module: this.module,
      spinnerClass: this.spinnerClass,
      canvasVisible: this.canvasVisible,
    }
  }

  now(): number {
    return this.time
  }

  async delay(milliseconds: number): Promise<void> {
    this.time += milliseconds
    if (this.module !== null && !this.mainLoop.paused) {
      this.mainLoop.currentFrameNumber += 1
    }
  }

  installSuccessfulPlayer(capture: { uri?: string; args?: string[] } = {}): void {
    let currentUri = "nogame.love"
    this.player = {
      get uri(): string { return currentUri },
      start: (uri: string, args: string[]): void => {
        currentUri = uri
        capture.uri = uri
        capture.args = args
        this.spinnerClass = ""
        this.canvasVisible = true
        this.module = {
          Browser: { mainLoop: this.mainLoop },
          FS: { syncfs: (_populate, callback) => callback() },
          done: false,
          exit: (_status: number): void => {
            if (this.module !== null) {
              this.module.done = true
              this.module.onexit?.(0)
            }
          },
        }
      },
    }
  }
}

const timings = {
  startupTimeoutMs: 100,
  shutdownTimeoutMs: 100,
  pollIntervalMs: 5,
  pauseVerificationMs: 10,
  resumeVerificationMs: 10,
}

function surface(bindings: FakeBindings): BrowserLoveJsGameSurface {
  return new BrowserLoveJsGameSurface(
    bindings,
    () => ok({ uri: "gen1recomp.love", args: ["--probe"] }),
    timings,
  )
}

test("browser surface starts, functionally pauses/resumes, and exits pinned love.js", async () => {
  const bindings = new FakeBindings()
  const captured: { uri?: string; args?: string[] } = {}
  bindings.installSuccessfulPlayer(captured)
  const runtimeSurface = surface(bindings)

  assert.equal((await runtimeSurface.start(request)).ok, true)
  assert.equal(runtimeSurface.state(), "running")
  assert.deepEqual(captured, { uri: "gen1recomp.love", args: ["--probe"] })

  const beforePause = bindings.mainLoop.currentFrameNumber
  assert.equal((await runtimeSurface.quiesce("background")).ok, true)
  assert.equal(bindings.mainLoop.currentFrameNumber, beforePause)
  assert.equal(runtimeSurface.state(), "quiesced")

  assert.equal((await runtimeSurface.resume()).ok, true)
  assert.ok(bindings.mainLoop.currentFrameNumber > beforePause)
  assert.equal(runtimeSurface.state(), "running")

  assert.equal((await runtimeSurface.dispose()).ok, true)
  assert.equal(runtimeSurface.state(), "disposed")
  assert.equal(bindings.module?.done, true)
})

test("browser surface fails closed when Player is unavailable", async () => {
  const bindings = new FakeBindings()
  const result = await surface(bindings).start(request)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, "unsupported")
})

test("browser surface attributes player error and startup timeout", async () => {
  const failed = new FakeBindings()
  failed.player = {
    uri: "gen1recomp.love",
    start: () => { failed.spinnerClass = "error" },
  }
  const failedResult = await surface(failed).start(request)
  assert.equal(failedResult.ok, false)
  if (!failedResult.ok) assert.match(failedResult.error.message, /error state/)

  const timedOut = new FakeBindings()
  timedOut.player = { uri: "gen1recomp.love", start: () => undefined }
  const timeoutResult = await surface(timedOut).start(request)
  assert.equal(timeoutResult.ok, false)
  if (!timeoutResult.ok) assert.match(timeoutResult.error.message, /100 ms/)
})

test("browser surface rejects player fallback substitution", async () => {
  const bindings = new FakeBindings()
  bindings.player = {
    uri: "nogame.love",
    start: () => undefined,
  }
  const result = await surface(bindings).start(request)
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error.message, /substituted nogame\.love/)
})

test("browser surface detects a main loop that advances after pause", async () => {
  const bindings = new FakeBindings()
  bindings.installSuccessfulPlayer()
  const runtimeSurface = surface(bindings)
  assert.equal((await runtimeSurface.start(request)).ok, true)
  bindings.mainLoop.ignorePause = true
  const result = await runtimeSurface.quiesce("background")
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error.message, /advanced after pause/)
})

test("browser surface reports an exit callback timeout", async () => {
  const bindings = new FakeBindings()
  bindings.installSuccessfulPlayer()
  const runtimeSurface = surface(bindings)
  assert.equal((await runtimeSurface.start(request)).ok, true)
  if (bindings.module !== null) bindings.module.exit = () => undefined
  const result = await runtimeSurface.dispose()
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error.message, /100 ms/)
})

test("browser surface rejects invalid timing policy", () => {
  const bindings = new FakeBindings()
  assert.throws(() => new BrowserLoveJsGameSurface(
    bindings,
    () => ok({ uri: "game.love", args: [] }),
    { pollIntervalMs: 0 },
  ), RangeError)
})
