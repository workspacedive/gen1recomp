import type {
  LuaRuntimePort,
  RuntimeBootRequest,
  RuntimeDescriptor,
  RuntimeError,
  RuntimeState,
} from "../../components/contracts/src/runtime.js"
import { isJsonValue, isRecord } from "../../components/contracts/src/json.js"
import { err, ok, type Result } from "../../components/contracts/src/result.js"

export type RuntimeEvidenceVerifier<Evidence> = (
  evidence: Evidence,
  request: RuntimeBootRequest,
) => Result<RuntimeDescriptor, RuntimeError>

function runtimeError(
  code: RuntimeError["code"],
  message: string,
  retryable: boolean,
): Result<never, RuntimeError> {
  return err({ code, message, retryable })
}

function validateBootRequest(request: RuntimeBootRequest): Result<void, RuntimeError> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(request.sessionId)) {
    return runtimeError("invalid_payload", "sessionId is not canonical", false)
  }
  const pathSegments = request.payloadVirtualPath.split("/")
  if (
    pathSegments.length === 0 ||
    pathSegments.some((segment) =>
      segment === "." ||
      segment === ".." ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment)
    )
  ) {
    return runtimeError("invalid_payload", "payloadVirtualPath is not a canonical relative path", false)
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(request.storageNamespace)) {
    return runtimeError("invalid_payload", "storageNamespace is not canonical", false)
  }
  if (
    !isRecord(request.query) ||
    !Object.values(request.query).every((value) => isJsonValue(value))
  ) {
    return runtimeError("invalid_payload", "query must contain only JSON values", false)
  }
  return ok(undefined)
}

function descriptorsMatch(
  expected: RuntimeDescriptor,
  actual: RuntimeDescriptor,
): Result<void, RuntimeError> {
  for (const [name, left, right] of [
    ["id", expected.id, actual.id],
    ["version", expected.version, actual.version],
    ["apiVersion", expected.apiVersion, actual.apiVersion],
    ["luaVersion", expected.luaVersion, actual.luaVersion],
    ["loveVersion", expected.loveVersion, actual.loveVersion],
  ] as const) {
    if (left !== right) {
      return runtimeError(
        "incompatible",
        `runtime descriptor ${name} mismatch: evidence=${String(left)} backend=${String(right)}`,
        false,
      )
    }
  }
  for (const capability of expected.capabilities) {
    if (!actual.capabilities.has(capability)) {
      return runtimeError(
        "incompatible",
        `backend did not confirm evidenced capability ${capability}`,
        false,
      )
    }
  }
  return ok(undefined)
}

export class RuntimeManager<Evidence> {
  readonly #runtime: LuaRuntimePort
  readonly #verifyEvidence: RuntimeEvidenceVerifier<Evidence>
  readonly #componentId: string
  #state: RuntimeState = { status: "idle" }
  #busy = false
  #backendMayBeActive = false
  #sessionId: string | null = null

  public constructor(
    componentId: string,
    runtime: LuaRuntimePort,
    verifyEvidence: RuntimeEvidenceVerifier<Evidence>,
  ) {
    this.#componentId = componentId
    this.#runtime = runtime
    this.#verifyEvidence = verifyEvidence
  }

  public state(): RuntimeState {
    return { ...this.#state }
  }

  public async boot(
    request: RuntimeBootRequest,
    evidence: Evidence,
  ): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return runtimeError("busy", "a runtime operation is in progress", true)
    const validRequest = validateBootRequest(request)
    if (!validRequest.ok) return validRequest
    if (!["idle", "stopped", "failed"].includes(this.#state.status)) {
      return runtimeError("invalid_state", `cannot boot from ${this.#state.status}`, false)
    }
    if (this.#backendMayBeActive) {
      return runtimeError(
        "invalid_state",
        "the previous runtime session must be stopped before boot can retry",
        false,
      )
    }
    this.#busy = true
    this.#state = { status: "resolving", componentId: this.#componentId }
    try {
      const expected = this.#verifyEvidence(evidence, request)
      if (!expected.ok) return this.#failed(expected.error)
      if (expected.value.id !== this.#componentId) {
        return this.#failed({
          code: "incompatible",
          message: `evidence describes ${expected.value.id}, expected ${this.#componentId}`,
          retryable: false,
        })
      }
      this.#state = {
        status: "verifying",
        componentId: expected.value.id,
        progress: 1,
      }
      let actual: RuntimeDescriptor
      try {
        actual = await this.#runtime.describe()
      } catch (cause: unknown) {
        return this.#failed({
          code: "startup",
          message: `runtime describe failed: ${String(cause)}`,
          retryable: true,
        })
      }
      const matched = descriptorsMatch(expected.value, actual)
      if (!matched.ok) return this.#failed(matched.error)
      this.#state = { status: "preparing", componentId: actual.id }
      this.#state = { status: "starting", componentId: actual.id }
      this.#backendMayBeActive = true
      this.#sessionId = request.sessionId
      let started: Result<void, RuntimeError>
      try {
        started = await this.#runtime.boot(request)
      } catch (cause: unknown) {
        return await this.#failedStart({
          code: "startup",
          message: `runtime boot threw: ${String(cause)}`,
          retryable: true,
        })
      }
      if (!started.ok) return await this.#failedStart(started.error)
      this.#state = { status: "running", sessionId: request.sessionId }
      return ok(undefined)
    } catch (cause: unknown) {
      const error: RuntimeError = {
        code: "internal",
        message: `runtime manager boot failed: ${String(cause)}`,
        retryable: false,
      }
      return this.#backendMayBeActive
        ? await this.#failedStart(error)
        : this.#failed(error)
    } finally {
      this.#busy = false
    }
  }

  public async suspend(reason: string): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return runtimeError("busy", "a runtime operation is in progress", true)
    if (typeof reason !== "string" || reason.trim().length === 0) {
      return runtimeError("invalid_payload", "suspend reason must not be empty", false)
    }
    if (this.#state.status === "suspended") return ok(undefined)
    if (this.#state.status !== "running") {
      return runtimeError("invalid_state", `cannot suspend from ${this.#state.status}`, false)
    }
    const sessionId = this.#state.sessionId
    this.#busy = true
    try {
      const result = await this.#runtime.suspend(reason)
      if (!result.ok) return this.#failed(result.error)
      this.#state = { status: "suspended", sessionId, reason }
      return ok(undefined)
    } catch (cause: unknown) {
      return this.#failed({
        code: "lifecycle",
        message: `runtime suspend threw: ${String(cause)}`,
        retryable: true,
      })
    } finally {
      this.#busy = false
    }
  }

  public async resume(): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return runtimeError("busy", "a runtime operation is in progress", true)
    if (this.#state.status === "running") return ok(undefined)
    if (this.#state.status !== "suspended") {
      return runtimeError("invalid_state", `cannot resume from ${this.#state.status}`, false)
    }
    const sessionId = this.#state.sessionId
    this.#busy = true
    try {
      const result = await this.#runtime.resume()
      if (!result.ok) return this.#failed(result.error)
      this.#state = { status: "running", sessionId }
      return ok(undefined)
    } catch (cause: unknown) {
      return this.#failed({
        code: "lifecycle",
        message: `runtime resume threw: ${String(cause)}`,
        retryable: true,
      })
    } finally {
      this.#busy = false
    }
  }

  public async stop(): Promise<Result<void, RuntimeError>> {
    if (this.#busy) return runtimeError("busy", "a runtime operation is in progress", true)
    if (
      this.#state.status === "idle" ||
      this.#state.status === "stopped" ||
      !this.#backendMayBeActive
    ) {
      this.#sessionId = null
      this.#state = { status: "stopped" }
      return ok(undefined)
    }
    this.#busy = true
    this.#state = { status: "stopping", sessionId: this.#sessionId }
    try {
      const result = await this.#runtime.stop()
      if (!result.ok) return this.#failed(result.error)
      this.#backendMayBeActive = false
      this.#sessionId = null
      this.#state = { status: "stopped" }
      return ok(undefined)
    } catch (cause: unknown) {
      return this.#failed({
        code: "lifecycle",
        message: `runtime stop threw: ${String(cause)}`,
        retryable: true,
      })
    } finally {
      this.#busy = false
    }
  }

  async #failedStart(error: RuntimeError): Promise<Result<never, RuntimeError>> {
    this.#state = { status: "stopping", sessionId: this.#sessionId }
    try {
      const cleanup = await this.#runtime.stop()
      if (cleanup.ok) {
        this.#backendMayBeActive = false
        this.#sessionId = null
        return this.#failed(error)
      }
      return this.#failed({
        ...error,
        message: `${error.message}; startup cleanup failed: ${cleanup.error.message}`,
      })
    } catch (cause: unknown) {
      return this.#failed({
        ...error,
        message: `${error.message}; startup cleanup threw: ${String(cause)}`,
      })
    }
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
