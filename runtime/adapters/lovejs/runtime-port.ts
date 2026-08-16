import {
  parseRuntimeBootRequest,
  type LuaRuntimePort,
  type RuntimeBootRequest,
  type RuntimeDescriptor,
  type RuntimeError,
  type RuntimeState,
} from "../../../components/contracts/src/runtime.js"
import { err, ok, type Result } from "../../../components/contracts/src/result.js"
import type { PersistenceError } from "./persistence.js"

export interface LoveJsPersistencePort {
  populate(reason?: string): Promise<Result<void, PersistenceError>>
  flush(reason: string): Promise<Result<void, PersistenceError>>
}

/**
 * Host-facing game surface below LuaRuntimePort.
 *
 * A concrete browser/WebView implementation owns the exact love.js loader and
 * transport. `quiesce` must pause game callbacks and settle Lua-side writes
 * before it reports success; `dispose` must release the surface and runtime.
 */
export interface LoveJsGameSurfacePort {
  start(request: RuntimeBootRequest): Promise<Result<void, RuntimeError>>
  quiesce(reason: string): Promise<Result<void, RuntimeError>>
  resume(): Promise<Result<void, RuntimeError>>
  dispose(): Promise<Result<void, RuntimeError>>
}

function failure(
  code: RuntimeError["code"],
  message: string,
  retryable: boolean,
): Result<never, RuntimeError> {
  return err({ code, message, retryable })
}

function persistenceFailure(
  error: PersistenceError,
  code: "startup" | "lifecycle",
): RuntimeError {
  return {
    code,
    message: `love.js ${error.operation} failed (${error.reason}): ${error.message}`,
    retryable: true,
  }
}

export class LoveJsRuntimePort implements LuaRuntimePort {
  readonly #descriptor: RuntimeDescriptor
  readonly #surface: LoveJsGameSurfacePort
  readonly #persistence: LoveJsPersistencePort
  #state: RuntimeState = { status: "idle" }
  #busy = false
  #surfaceMayBeActive = false
  #started = false
  #quiesced = false
  #persistenceReady = false
  #sessionId: string | null = null

  public constructor(
    descriptor: RuntimeDescriptor,
    surface: LoveJsGameSurfacePort,
    persistence: LoveJsPersistencePort,
  ) {
    this.#descriptor = {
      ...descriptor,
      capabilities: new Set(descriptor.capabilities),
    }
    this.#surface = surface
    this.#persistence = persistence
  }

  public async describe(): Promise<RuntimeDescriptor> {
    return {
      ...this.#descriptor,
      capabilities: new Set(this.#descriptor.capabilities),
    }
  }

  public state(): RuntimeState {
    return { ...this.#state }
  }

  public async boot(request: RuntimeBootRequest): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return failure("busy", "a love.js runtime operation is in progress", true)
    const parsedRequest = parseRuntimeBootRequest(request)
    if (!parsedRequest.ok) return failure("invalid_payload", parsedRequest.error, false)
    const validatedRequest = parsedRequest.value
    if (this.#state.status !== "idle" && this.#state.status !== "stopped") {
      return failure("invalid_state", `cannot start love.js from ${this.#state.status}`, false)
    }
    this.#busy = true
    this.#sessionId = validatedRequest.sessionId
    this.#state = { status: "preparing", componentId: this.#descriptor.id }
    try {
      const populated = await this.#persistence.populate("runtime-start")
      if (!populated.ok) {
        return this.#failed(persistenceFailure(populated.error, "startup"))
      }
      this.#persistenceReady = true
      this.#state = { status: "starting", componentId: this.#descriptor.id }
      this.#surfaceMayBeActive = true
      let started: Result<void, RuntimeError>
      try {
        started = await this.#surface.start(validatedRequest)
      } catch (cause: unknown) {
        return this.#failed({
          code: "startup",
          message: `love.js surface start threw: ${String(cause)}`,
          retryable: true,
        })
      }
      if (!started.ok) return this.#failed(started.error)
      this.#started = true
      this.#quiesced = false
      this.#state = { status: "running", sessionId: validatedRequest.sessionId }
      return ok(undefined)
    } catch (cause: unknown) {
      return this.#failed({
        code: "internal",
        message: `love.js runtime start failed: ${String(cause)}`,
        retryable: false,
      })
    } finally {
      this.#busy = false
    }
  }

  public async suspend(reason: string): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return failure("busy", "a love.js runtime operation is in progress", true)
    if (typeof reason !== "string" || reason.trim().length === 0) {
      return failure("invalid_payload", "suspend reason must not be empty", false)
    }
    if (this.#state.status === "suspended") return ok(undefined)
    if (this.#state.status !== "running" || this.#sessionId === null) {
      return failure("invalid_state", `cannot suspend love.js from ${this.#state.status}`, false)
    }
    const sessionId = this.#sessionId
    this.#busy = true
    try {
      const quiesced = await this.#quiesce(`lifecycle-suspend:${reason}`)
      if (!quiesced.ok) return quiesced
      const flushed = await this.#persistence.flush(`lifecycle-suspend:${reason}`)
      if (!flushed.ok) {
        return this.#failed(persistenceFailure(flushed.error, "lifecycle"))
      }
      this.#state = { status: "suspended", sessionId, reason }
      return ok(undefined)
    } catch (cause: unknown) {
      return this.#failed({
        code: "lifecycle",
        message: `love.js suspend failed: ${String(cause)}`,
        retryable: true,
      })
    } finally {
      this.#busy = false
    }
  }

  public async resume(): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return failure("busy", "a love.js runtime operation is in progress", true)
    if (this.#state.status === "running") return ok(undefined)
    if (this.#state.status !== "suspended" || this.#sessionId === null) {
      return failure("invalid_state", `cannot resume love.js from ${this.#state.status}`, false)
    }
    const sessionId = this.#sessionId
    this.#busy = true
    this.#quiesced = false
    try {
      const resumed = await this.#surface.resume()
      if (!resumed.ok) return this.#failed(resumed.error)
      this.#state = { status: "running", sessionId }
      return ok(undefined)
    } catch (cause: unknown) {
      return this.#failed({
        code: "lifecycle",
        message: `love.js resume failed: ${String(cause)}`,
        retryable: true,
      })
    } finally {
      this.#busy = false
    }
  }

  public async stop(): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return failure("busy", "a love.js runtime operation is in progress", true)
    if (!this.#surfaceMayBeActive && !this.#persistenceReady) {
      this.#resetStopped()
      return ok(undefined)
    }
    this.#busy = true
    this.#state = { status: "stopping", sessionId: this.#sessionId }
    try {
      if (this.#started && !this.#quiesced) {
        const quiesced = await this.#quiesce("runtime-stop")
        if (!quiesced.ok) return quiesced
      }
      if (this.#persistenceReady) {
        const flushed = await this.#persistence.flush("runtime-stop")
        if (!flushed.ok) {
          return this.#failed(persistenceFailure(flushed.error, "lifecycle"))
        }
      }
      if (this.#surfaceMayBeActive) {
        let disposed: Result<void, RuntimeError>
        try {
          disposed = await this.#surface.dispose()
        } catch (cause: unknown) {
          return this.#failed({
            code: "lifecycle",
            message: `love.js surface dispose threw: ${String(cause)}`,
            retryable: true,
          })
        }
        if (!disposed.ok) return this.#failed(disposed.error)
      }
      this.#resetStopped()
      return ok(undefined)
    } catch (cause: unknown) {
      return this.#failed({
        code: "lifecycle",
        message: `love.js stop failed: ${String(cause)}`,
        retryable: true,
      })
    } finally {
      this.#busy = false
    }
  }

  async #quiesce(reason: string): Promise<Result<void, RuntimeError>> {
    let result: Result<void, RuntimeError>
    try {
      result = await this.#surface.quiesce(reason)
    } catch (cause: unknown) {
      return this.#failed({
        code: "lifecycle",
        message: `love.js quiesce threw: ${String(cause)}`,
        retryable: true,
      })
    }
    if (!result.ok) return this.#failed(result.error)
    this.#quiesced = true
    return ok(undefined)
  }

  #resetStopped(): void {
    this.#surfaceMayBeActive = false
    this.#started = false
    this.#quiesced = false
    this.#persistenceReady = false
    this.#sessionId = null
    this.#state = { status: "stopped" }
  }

  #failed(error: RuntimeError): Result<never, RuntimeError> {
    this.#state = {
      status: "failed",
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    }
    return err(error)
  }
}
