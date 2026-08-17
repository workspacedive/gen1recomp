import type {
  RuntimeBootRequest,
  RuntimeError,
} from "../../../components/contracts/src/runtime.js"
import { err, ok, type Result } from "../../../components/contracts/src/result.js"
import type { LoveJsGameSurfacePort } from "./runtime-port.js"

export type LoveJsBrowserLaunch = {
  readonly uri: string
  readonly args: readonly string[]
}

export type LoveJsBrowserLaunchResolver = (
  request: RuntimeBootRequest,
) => Result<LoveJsBrowserLaunch, RuntimeError>

export interface LoveJsPlayerApi {
  readonly uri: string
  start(uri: string, args: string[]): void
}

export interface LoveJsBrowserMainLoopApi {
  readonly currentFrameNumber: number
  readonly func: unknown
  pause(): void
  resume(): void
}

export interface LoveJsBrowserModuleApi {
  readonly Browser?: { readonly mainLoop?: LoveJsBrowserMainLoopApi }
  readonly FS?: { syncfs(populate: boolean, callback: (error?: unknown) => void): void }
  done?: boolean
  exit?(status: number): void
  onexit?: (status: number) => void
}

export type LoveJsBrowserSnapshot = {
  readonly player: LoveJsPlayerApi | null
  readonly module: LoveJsBrowserModuleApi | null
  readonly spinnerClass: string | null
  readonly canvasVisible: boolean
}

export interface LoveJsBrowserBindings {
  snapshot(): LoveJsBrowserSnapshot
  now(): number
  delay(milliseconds: number): Promise<void>
}

export type BrowserLoveJsSurfaceOptions = {
  readonly startupTimeoutMs: number
  readonly shutdownTimeoutMs: number
  readonly pollIntervalMs: number
  readonly pauseVerificationMs: number
  readonly resumeVerificationMs: number
}

export type BrowserLoveJsSurfaceState =
  | "idle"
  | "starting"
  | "running"
  | "quiesced"
  | "disposing"
  | "disposed"
  | "failed"

const DEFAULT_OPTIONS: BrowserLoveJsSurfaceOptions = {
  startupTimeoutMs: 30_000,
  shutdownTimeoutMs: 5_000,
  pollIntervalMs: 25,
  pauseVerificationMs: 50,
  resumeVerificationMs: 100,
}

function runtimeFailure(
  code: RuntimeError["code"],
  message: string,
  retryable: boolean,
): Result<never, RuntimeError> {
  return err({ code, message, retryable })
}

function validOptions(options: BrowserLoveJsSurfaceOptions): boolean {
  return Object.values(options).every((value) => Number.isSafeInteger(value) && value > 0)
}

export class BrowserLoveJsGameSurface implements LoveJsGameSurfacePort {
  readonly #bindings: LoveJsBrowserBindings
  readonly #resolveLaunch: LoveJsBrowserLaunchResolver
  readonly #options: BrowserLoveJsSurfaceOptions
  #state: BrowserLoveJsSurfaceState = "idle"
  #busy = false

  public constructor(
    bindings: LoveJsBrowserBindings,
    resolveLaunch: LoveJsBrowserLaunchResolver,
    options: Partial<BrowserLoveJsSurfaceOptions> = {},
  ) {
    this.#bindings = bindings
    this.#resolveLaunch = resolveLaunch
    this.#options = { ...DEFAULT_OPTIONS, ...options }
    if (!validOptions(this.#options)) {
      throw new RangeError("browser surface timing options must be positive safe integers")
    }
  }

  public state(): BrowserLoveJsSurfaceState {
    return this.#state
  }

  public async start(request: RuntimeBootRequest): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return runtimeFailure("busy", "a browser surface operation is in progress", true)
    if (this.#state !== "idle") {
      return runtimeFailure("invalid_state", `cannot start browser surface from ${this.#state}`, false)
    }
    let launch: Result<LoveJsBrowserLaunch, RuntimeError>
    try {
      launch = this.#resolveLaunch(request)
    } catch (cause: unknown) {
      return this.#fail("internal", `love.js launch resolver threw: ${String(cause)}`, false)
    }
    if (!launch.ok) return this.#failResult(launch.error)
    if (
      launch.value.uri.length === 0 ||
      !launch.value.args.every((argument) => typeof argument === "string")
    ) {
      return this.#fail("invalid_payload", "love.js launch resolution is invalid", false)
    }
    const initial = this.#bindings.snapshot()
    if (initial.player === null || typeof initial.player.uri !== "string") {
      return this.#fail("unsupported", "pinned love.js Player API is unavailable", false)
    }

    this.#busy = true
    this.#state = "starting"
    try {
      initial.player.start(launch.value.uri, [...launch.value.args])
      const deadline = this.#bindings.now() + this.#options.startupTimeoutMs
      while (this.#bindings.now() < deadline) {
        const snapshot = this.#bindings.snapshot()
        if (snapshot.spinnerClass === "error") {
          return this.#fail("startup", "love.js player entered its error state", true)
        }
        if (snapshot.module?.done === true) {
          return this.#fail("startup", "love.js exited before startup completed", true)
        }
        if (snapshot.player === null || snapshot.player.uri !== launch.value.uri) {
          return this.#fail(
            "startup",
            `love.js substituted ${snapshot.player?.uri ?? "no player"} for ${launch.value.uri}`,
            false,
          )
        }
        const mainLoop = snapshot.module?.Browser?.mainLoop
        if (
          snapshot.spinnerClass === "" &&
          snapshot.canvasVisible &&
          typeof snapshot.module?.FS?.syncfs === "function" &&
          mainLoop !== undefined &&
          typeof mainLoop.func !== "undefined" &&
          mainLoop.func !== null
        ) {
          this.#state = "running"
          return ok(undefined)
        }
        await this.#bindings.delay(this.#options.pollIntervalMs)
      }
      return this.#fail(
        "startup",
        `love.js did not become ready within ${this.#options.startupTimeoutMs} ms`,
        true,
      )
    } catch (cause: unknown) {
      return this.#fail("startup", `love.js surface start failed: ${String(cause)}`, true)
    } finally {
      this.#busy = false
    }
  }

  public async quiesce(reason: string): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return runtimeFailure("busy", "a browser surface operation is in progress", true)
    if (typeof reason !== "string" || reason.trim().length === 0) {
      return runtimeFailure("invalid_payload", "quiesce reason must not be empty", false)
    }
    if (this.#state === "quiesced") return ok(undefined)
    if (this.#state !== "running") {
      return runtimeFailure("invalid_state", `cannot quiesce browser surface from ${this.#state}`, false)
    }
    this.#busy = true
    try {
      const mainLoop = this.#bindings.snapshot().module?.Browser?.mainLoop
      if (mainLoop === undefined) {
        return this.#fail("unsupported", "love.js main-loop controls are unavailable", false)
      }
      mainLoop.pause()
      const pausedAt = mainLoop.currentFrameNumber
      await this.#bindings.delay(this.#options.pauseVerificationMs)
      const verified = this.#bindings.snapshot().module?.Browser?.mainLoop
      if (verified === undefined || verified.currentFrameNumber !== pausedAt) {
        return this.#fail("lifecycle", "love.js frame loop advanced after pause", true)
      }
      this.#state = "quiesced"
      return ok(undefined)
    } catch (cause: unknown) {
      return this.#fail("lifecycle", `love.js pause failed: ${String(cause)}`, true)
    } finally {
      this.#busy = false
    }
  }

  public async resume(): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return runtimeFailure("busy", "a browser surface operation is in progress", true)
    if (this.#state === "running") return ok(undefined)
    if (this.#state !== "quiesced") {
      return runtimeFailure("invalid_state", `cannot resume browser surface from ${this.#state}`, false)
    }
    this.#busy = true
    try {
      const mainLoop = this.#bindings.snapshot().module?.Browser?.mainLoop
      if (mainLoop === undefined) {
        return this.#fail("unsupported", "love.js main-loop controls are unavailable", false)
      }
      const resumedAt = mainLoop.currentFrameNumber
      mainLoop.resume()
      await this.#bindings.delay(this.#options.resumeVerificationMs)
      const verified = this.#bindings.snapshot().module?.Browser?.mainLoop
      if (verified === undefined || verified.currentFrameNumber <= resumedAt) {
        return this.#fail("lifecycle", "love.js frame loop did not advance after resume", true)
      }
      this.#state = "running"
      return ok(undefined)
    } catch (cause: unknown) {
      return this.#fail("lifecycle", `love.js resume failed: ${String(cause)}`, true)
    } finally {
      this.#busy = false
    }
  }

  public async dispose(): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return runtimeFailure("busy", "a browser surface operation is in progress", true)
    if (this.#state === "disposed") return ok(undefined)
    this.#busy = true
    this.#state = "disposing"
    try {
      const module = this.#bindings.snapshot().module
      if (module === null || module.done === true) {
        this.#state = "disposed"
        return ok(undefined)
      }
      if (typeof module.exit !== "function") {
        return this.#fail("unsupported", "love.js exit control is unavailable", false)
      }
      const previousOnExit = module.onexit
      let exited = false
      module.onexit = (status: number): void => {
        exited = true
        previousOnExit?.(status)
      }
      module.exit(0)
      const deadline = this.#bindings.now() + this.#options.shutdownTimeoutMs
      while (!exited && this.#bindings.now() < deadline) {
        await this.#bindings.delay(this.#options.pollIntervalMs)
      }
      if (!exited) {
        return this.#fail(
          "lifecycle",
          `love.js did not exit within ${this.#options.shutdownTimeoutMs} ms`,
          true,
        )
      }
      this.#state = "disposed"
      return ok(undefined)
    } catch (cause: unknown) {
      return this.#fail("lifecycle", `love.js dispose failed: ${String(cause)}`, true)
    } finally {
      this.#busy = false
    }
  }

  #failResult(error: RuntimeError): Result<never, RuntimeError> {
    this.#state = "failed"
    return err(error)
  }

  #fail(
    code: RuntimeError["code"],
    message: string,
    retryable: boolean,
  ): Result<never, RuntimeError> {
    this.#state = "failed"
    return runtimeFailure(code, message, retryable)
  }
}

export class DomLoveJsBrowserBindings implements LoveJsBrowserBindings {
  readonly #window: Window
  readonly #document: Document
  readonly #canvasId: string
  readonly #spinnerId: string

  public constructor(
    windowObject: Window,
    documentObject: Document,
    canvasId = "canvas",
    spinnerId = "spinner",
  ) {
    this.#window = windowObject
    this.#document = documentObject
    this.#canvasId = canvasId
    this.#spinnerId = spinnerId
  }

  public snapshot(): LoveJsBrowserSnapshot {
    const globals = this.#window as Window & {
      readonly Player?: LoveJsPlayerApi
      readonly Module?: LoveJsBrowserModuleApi
    }
    const canvas = this.#document.getElementById(this.#canvasId)
    const spinner = this.#document.getElementById(this.#spinnerId)
    return {
      player: globals.Player ?? null,
      module: globals.Module ?? null,
      spinnerClass: spinner?.className ?? null,
      canvasVisible: canvas !== null && this.#window.getComputedStyle(canvas).display !== "none",
    }
  }

  public now(): number {
    return Date.now()
  }

  public delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => this.#window.setTimeout(resolve, milliseconds))
  }
}
