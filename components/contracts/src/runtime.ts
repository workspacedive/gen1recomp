import {
  cloneJsonValue,
  hasOnlyKeys,
  isJsonValue,
  isRecord,
  type JsonValue,
} from "./json.js"
import { err, ok, type Result } from "./result.js"

export type RuntimeCapability =
  | "lua51"
  | "luaJitInterpreter"
  | "luaJitCompiler"
  | "coroutines"
  | "bitLibrary"
  | "ffi"
  | "threads"
  | "threadChannels"
  | "filesystem"
  | "persistentStorage"
  | "networkBroker"
  | "pcmOutput"
  | "queueableAudio"
  | "webAssembly"
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
  | { readonly status: "stopping"; readonly sessionId: string | null }
  | { readonly status: "stopped" }
  | { readonly status: "recovering"; readonly failedVersion: string; readonly fallbackVersion: string }
  | {
      readonly status: "failed"
      readonly code: RuntimeError["code"]
      readonly message: string
      readonly retryable: boolean
    }

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

const RUNTIME_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const RUNTIME_NAMESPACE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const VIRTUAL_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const MAXIMUM_QUERY_ENTRIES = 64
const MAXIMUM_VIRTUAL_PATH_LENGTH = 1024

function parseRuntimeBootRequestInner(value: unknown): Result<RuntimeBootRequest, string> {
  if (!isRecord(value)) return err("runtime boot request must be an object")
  if (!hasOnlyKeys(value, new Set([
    "sessionId",
    "payloadVirtualPath",
    "storageNamespace",
    "query",
  ]))) {
    return err("runtime boot request has unknown fields")
  }
  if (typeof value["sessionId"] !== "string" || !RUNTIME_IDENTIFIER.test(value["sessionId"])) {
    return err("sessionId is not canonical")
  }
  if (
    typeof value["payloadVirtualPath"] !== "string" ||
    value["payloadVirtualPath"].length === 0 ||
    value["payloadVirtualPath"].length > MAXIMUM_VIRTUAL_PATH_LENGTH
  ) {
    return err("payloadVirtualPath must be a bounded relative path")
  }
  const segments = value["payloadVirtualPath"].split("/")
  if (segments.some((segment) =>
    segment === "." || segment === ".." || !VIRTUAL_PATH_SEGMENT.test(segment)
  )) {
    return err("payloadVirtualPath is not a canonical relative path")
  }
  if (
    typeof value["storageNamespace"] !== "string" ||
    !RUNTIME_NAMESPACE.test(value["storageNamespace"])
  ) {
    return err("storageNamespace is not canonical")
  }
  const query = value["query"]
  if (!isRecord(query)) return err("query must be an object")
  const entries = Object.entries(query)
  if (entries.length > MAXIMUM_QUERY_ENTRIES) {
    return err(`query exceeds ${MAXIMUM_QUERY_ENTRIES} entries`)
  }
  const parsedQuery = Object.create(null) as Record<string, JsonValue>
  for (const [key, candidate] of entries) {
    if (!RUNTIME_NAMESPACE.test(key)) return err(`query key is not canonical: ${key}`)
    if (!isJsonValue(candidate)) return err(`query value is not JSON: ${key}`)
    parsedQuery[key] = cloneJsonValue(candidate)
  }
  return ok({
    sessionId: value["sessionId"],
    payloadVirtualPath: value["payloadVirtualPath"],
    storageNamespace: value["storageNamespace"],
    query: parsedQuery,
  })
}

export function parseRuntimeBootRequest(value: unknown): Result<RuntimeBootRequest, string> {
  try {
    return parseRuntimeBootRequestInner(value)
  } catch {
    return err("runtime boot request could not be inspected safely")
  }
}

export type RuntimeError = {
  readonly code:
    | "unsupported"
    | "invalid_payload"
    | "integrity"
    | "capability"
    | "incompatible"
    | "busy"
    | "invalid_state"
    | "startup"
    | "lifecycle"
    | "internal"
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
