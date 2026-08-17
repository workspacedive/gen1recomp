import { hasOnlyKeys, isJsonValue, isRecord, type JsonValue } from "./json.js"
import { err, ok, type Result } from "./result.js"

export const HOST_PROTOCOL_VERSION = 1 as const

export type HostMethod =
  | "host.capabilities"
  | "storage.read"
  | "storage.write"
  | "storage.list"
  | "storage.remove"
  | "import.request"
  | "crypto.digest"
  | "network.fetch"
  | "haptics.play"
  | "lifecycle.ready"
  | "lifecycle.suspend"
  | "lifecycle.resume"
  | "lifecycle.exit"
  | "diagnostics.emit"
  | "diagnostics.export"

export type HostEvent =
  | "lifecycle.suspend"
  | "lifecycle.resume"
  | "lifecycle.memoryWarning"
  | "input.changed"
  | "host.capabilitiesChanged"

export type HostErrorCode =
  | "invalid_request"
  | "unsupported_protocol"
  | "unsupported_method"
  | "capability_denied"
  | "not_found"
  | "integrity_failed"
  | "cancelled"
  | "unavailable"
  | "internal"

export type HostError = {
  readonly code: HostErrorCode
  readonly message: string
  readonly retryable: boolean
  readonly details?: JsonValue
}

export type HostRequest = {
  readonly kind: "request"
  readonly protocol: typeof HOST_PROTOCOL_VERSION
  readonly requestId: string
  readonly method: HostMethod
  readonly payload: JsonValue
}

export type HostSuccessResponse = {
  readonly kind: "response"
  readonly protocol: typeof HOST_PROTOCOL_VERSION
  readonly requestId: string
  readonly ok: true
  readonly payload: JsonValue
}

export type HostFailureResponse = {
  readonly kind: "response"
  readonly protocol: typeof HOST_PROTOCOL_VERSION
  readonly requestId: string
  readonly ok: false
  readonly error: HostError
}

export type HostEventMessage = {
  readonly kind: "event"
  readonly protocol: typeof HOST_PROTOCOL_VERSION
  readonly event: HostEvent
  readonly payload: JsonValue
}

export type HostMessage =
  | HostRequest
  | HostSuccessResponse
  | HostFailureResponse
  | HostEventMessage

const HOST_METHODS: ReadonlySet<string> = new Set<HostMethod>([
  "host.capabilities",
  "storage.read",
  "storage.write",
  "storage.list",
  "storage.remove",
  "import.request",
  "crypto.digest",
  "network.fetch",
  "haptics.play",
  "lifecycle.ready",
  "lifecycle.suspend",
  "lifecycle.resume",
  "lifecycle.exit",
  "diagnostics.emit",
  "diagnostics.export",
])

const HOST_EVENTS: ReadonlySet<string> = new Set<HostEvent>([
  "lifecycle.suspend",
  "lifecycle.resume",
  "lifecycle.memoryWarning",
  "input.changed",
  "host.capabilitiesChanged",
])

const HOST_ERROR_CODES: ReadonlySet<string> = new Set<HostErrorCode>([
  "invalid_request",
  "unsupported_protocol",
  "unsupported_method",
  "capability_denied",
  "not_found",
  "integrity_failed",
  "cancelled",
  "unavailable",
  "internal",
])

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function parseHostError(value: unknown): Result<HostError, string> {
  if (!isRecord(value)) return err("error must be an object")
  if (!hasOnlyKeys(value, new Set(["code", "message", "retryable", "details"]))) {
    return err("error has unknown fields")
  }
  if (typeof value["code"] !== "string" || !HOST_ERROR_CODES.has(value["code"])) {
    return err("error.code is unsupported")
  }
  if (!nonEmptyString(value["message"])) return err("error.message is required")
  if (typeof value["retryable"] !== "boolean") return err("error.retryable must be boolean")
  if (value["details"] !== undefined && !isJsonValue(value["details"])) {
    return err("error.details must be JSON")
  }
  const base = {
    code: value["code"] as HostErrorCode,
    message: value["message"],
    retryable: value["retryable"],
  }
  return value["details"] === undefined
    ? ok(base)
    : ok({ ...base, details: value["details"] })
}

export function parseHostMessage(value: unknown): Result<HostMessage, string> {
  if (!isRecord(value)) return err("message must be an object")
  if (value["protocol"] !== HOST_PROTOCOL_VERSION) {
    return err(`unsupported protocol: ${String(value["protocol"])}`)
  }
  if (!isJsonValue(value["payload"]) && value["kind"] !== "response") {
    return err("payload must be JSON")
  }

  switch (value["kind"]) {
    case "request": {
      if (!hasOnlyKeys(value, new Set(["kind", "protocol", "requestId", "method", "payload"]))) {
        return err("request has unknown fields")
      }
      if (!nonEmptyString(value["requestId"])) return err("requestId is required")
      if (typeof value["method"] !== "string" || !HOST_METHODS.has(value["method"])) {
        return err("method is unsupported")
      }
      if (!isJsonValue(value["payload"])) return err("payload must be JSON")
      return ok({
        kind: "request",
        protocol: HOST_PROTOCOL_VERSION,
        requestId: value["requestId"],
        method: value["method"] as HostMethod,
        payload: value["payload"],
      })
    }
    case "event": {
      if (!hasOnlyKeys(value, new Set(["kind", "protocol", "event", "payload"]))) {
        return err("event has unknown fields")
      }
      if (typeof value["event"] !== "string" || !HOST_EVENTS.has(value["event"])) {
        return err("event is unsupported")
      }
      if (!isJsonValue(value["payload"])) return err("payload must be JSON")
      return ok({
        kind: "event",
        protocol: HOST_PROTOCOL_VERSION,
        event: value["event"] as HostEvent,
        payload: value["payload"],
      })
    }
    case "response": {
      if (!nonEmptyString(value["requestId"])) return err("requestId is required")
      if (value["ok"] === true) {
        if (!hasOnlyKeys(value, new Set(["kind", "protocol", "requestId", "ok", "payload"]))) {
          return err("successful response has unknown fields")
        }
        if (!isJsonValue(value["payload"])) return err("successful response payload must be JSON")
        return ok({
          kind: "response",
          protocol: HOST_PROTOCOL_VERSION,
          requestId: value["requestId"],
          ok: true,
          payload: value["payload"],
        })
      }
      if (value["ok"] === false) {
        if (!hasOnlyKeys(value, new Set(["kind", "protocol", "requestId", "ok", "error"]))) {
          return err("failed response has unknown fields")
        }
        const parsedError = parseHostError(value["error"])
        if (!parsedError.ok) return parsedError
        return ok({
          kind: "response",
          protocol: HOST_PROTOCOL_VERSION,
          requestId: value["requestId"],
          ok: false,
          error: parsedError.value,
        })
      }
      return err("response.ok must be boolean")
    }
    default:
      return err("message kind is unsupported")
  }
}
