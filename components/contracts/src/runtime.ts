import type { JsonValue } from "./json.js"
import type { Result } from "./result.js"

export type RuntimeCapability =
  | "lua51"
  | "luaJitInterpreter"
  | "luaJitCompiler"
  | "coroutines"
  | "bitLibrary"
  | "ffi"
  | "threads"
  | "filesystem"
  | "networkBroker"
  | "pcmOutput"
  | "webgl1"
  | "webgl2"
  | "shaders"
  | "renderTargets"
  | "gameController"
  | "rawMultiTouch"

export type RuntimeState =
  | { readonly status: "idle" }
  | { readonly status: "resolving"; readonly componentId: string }
  | { readonly status: "verifying"; readonly componentId: string; readonly progress?: number }
  | { readonly status: "preparing"; readonly componentId: string }
  | { readonly status: "starting"; readonly componentId: string }
  | { readonly status: "running"; readonly sessionId: string }
  | { readonly status: "suspended"; readonly sessionId: string; readonly reason: string }
  | { readonly status: "stopping"; readonly sessionId: string }
  | { readonly status: "stopped" }
  | { readonly status: "recovering"; readonly failedVersion: string; readonly fallbackVersion: string }
  | { readonly status: "failed"; readonly code: string; readonly message: string; readonly retryable: boolean }

export type RuntimeDescriptor = {
  readonly id: string
  readonly version: string
  readonly apiVersion: string
  readonly luaVersion: string
  readonly loveVersion: string | null
  readonly capabilities: ReadonlySet<RuntimeCapability>
}

export type RuntimeBootRequest = {
  readonly sessionId: string
  readonly payloadVirtualPath: string
  readonly storageNamespace: string
  readonly query: Readonly<Record<string, JsonValue>>
}

export type RuntimeError = {
  readonly code: "unsupported" | "invalid_payload" | "integrity" | "startup" | "lifecycle" | "internal"
  readonly message: string
  readonly retryable: boolean
}

export interface LuaRuntimePort {
  describe(): Promise<RuntimeDescriptor>
  boot(request: RuntimeBootRequest): Promise<Result<void, RuntimeError>>
  suspend(reason: string): Promise<Result<void, RuntimeError>>
  resume(): Promise<Result<void, RuntimeError>>
  stop(): Promise<Result<void, RuntimeError>>
  state(): RuntimeState
}
