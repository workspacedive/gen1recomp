import type { JsonValue } from "./json.js"
import type { Result } from "./result.js"

export type PlatformCapability =
  | "binaryFiles"
  | "filePicker"
  | "fileBookmarks"
  | "zip"
  | "sha1"
  | "sha256"
  | "https"
  | "haptics"
  | "orientation"
  | "wakeLock"
  | "webView"
  | "timelineCanvas"
  | "webAssemblyMainRuntime"
  | "webAssemblyWebView"
  | "webgl1"
  | "webgl2"
  | "audioContext"
  | "rawMultiTouch"
  | "gameController"

export type CapabilityEvidence = {
  readonly capability: PlatformCapability
  readonly available: boolean
  readonly evidence: "documentation" | "runtime-main" | "runtime-webview" | "device-e2e"
  readonly observed: JsonValue
}

export type VirtualPath = {
  readonly namespace: "component" | "cache" | "save" | "mod" | "temporary"
  readonly owner: string
  readonly relativePath: string
}

export type PlatformError = {
  readonly code: "invalid_path" | "not_found" | "denied" | "integrity" | "cancelled" | "unavailable" | "io" | "internal"
  readonly message: string
  readonly retryable: boolean
}

export interface PlatformPort {
  capabilities(): Promise<readonly CapabilityEvidence[]>
  read(path: VirtualPath): Promise<Result<Uint8Array, PlatformError>>
  write(path: VirtualPath, bytes: Uint8Array): Promise<Result<void, PlatformError>>
  list(path: VirtualPath): Promise<Result<readonly string[], PlatformError>>
  remove(path: VirtualPath): Promise<Result<void, PlatformError>>
  digest(algorithm: "sha1" | "sha256", bytes: Uint8Array): Promise<Result<string, PlatformError>>
  requestImport(kind: "rom" | "mod" | "save" | "component"): Promise<Result<Uint8Array, PlatformError>>
  setWakeLock(enabled: boolean): Promise<Result<void, PlatformError>>
  playHaptic(kind: "press" | "confirm" | "warning" | "error"): Promise<Result<void, PlatformError>>
}
