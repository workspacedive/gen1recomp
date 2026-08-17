import type {
  RuntimeCapability,
  RuntimeDescriptor,
  RuntimeError,
} from "../../../components/contracts/src/runtime.js"
import {
  hasOnlyKeys,
  isJsonValue,
  isRecord,
  type JsonValue,
} from "../../../components/contracts/src/json.js"
import { err, ok, type Result } from "../../../components/contracts/src/result.js"

export const LOVEJS_CAPABILITY_SCHEMA_VERSION = 1 as const

export type LoveJsCheckId =
  | "runtime.love11_5"
  | "lua.version51"
  | "lua.setfenv"
  | "lua.loadstring"
  | "lua.bit"
  | "lua.coroutine"
  | "web.wasm"
  | "web.crossOriginIsolated"
  | "graphics.webgl1"
  | "graphics.webgl2"
  | "graphics.canvas"
  | "graphics.imageData"
  | "graphics.shader"
  | "loop.fixedStep"
  | "storage.session"
  | "storage.explicitSync"
  | "audio.queueableBuffer"
  | "input.touchNamespace"
  | "input.simultaneousTouch"
  | "input.joystickNamespace"
  | "thread.channel"
  | "thread.workerRoundtrip"

export type CapabilityCheckStatus = "pass" | "fail" | "unavailable" | "error"

export type LoveJsCapabilityCheck = {
  readonly status: CapabilityCheckStatus
  readonly observed: JsonValue
}

export type LoveJsCapabilityReport = {
  readonly schemaVersion: typeof LOVEJS_CAPABILITY_SCHEMA_VERSION
  readonly purpose: "live-activation" | "archival"
  readonly sessionId: string
  readonly runtimeRevision: string
  readonly observedAt: string
  readonly environment: {
    readonly host: "outside-browser" | "scripting-webview"
    readonly hostVersion: string
    readonly osVersion: string | null
    readonly renderer: string | null
  }
  readonly checks: Readonly<Partial<Record<LoveJsCheckId, LoveJsCapabilityCheck>>>
}

export type LoveJsCapabilityProfile = {
  readonly id: string
  readonly requiredHost: LoveJsCapabilityReport["environment"]["host"]
  readonly runtimeRevision: string
  readonly activation:
    | { readonly status: "eligible" }
    | { readonly status: "evidence-pending"; readonly reason: string }
  readonly required: ReadonlySet<LoveJsCheckId>
  readonly expectedUnavailable: ReadonlySet<LoveJsCheckId>
}

export type CapabilityGateIssue = {
  readonly code:
    | "host_mismatch"
    | "runtime_revision_mismatch"
    | "activation_blocked"
    | "missing_check"
    | "required_check_failed"
    | "capability_policy_mismatch"
  readonly check: LoveJsCheckId | null
  readonly message: string
}

export type CapabilityGateResult =
  | {
      readonly compatible: true
      readonly issues: readonly []
      readonly descriptor: RuntimeDescriptor
    }
  | {
      readonly compatible: false
      readonly issues: readonly CapabilityGateIssue[]
      readonly descriptor: null
    }

const CHECK_IDS: readonly LoveJsCheckId[] = [
  "runtime.love11_5",
  "lua.version51",
  "lua.setfenv",
  "lua.loadstring",
  "lua.bit",
  "lua.coroutine",
  "web.wasm",
  "web.crossOriginIsolated",
  "graphics.webgl1",
  "graphics.webgl2",
  "graphics.canvas",
  "graphics.imageData",
  "graphics.shader",
  "loop.fixedStep",
  "storage.session",
  "storage.explicitSync",
  "audio.queueableBuffer",
  "input.touchNamespace",
  "input.simultaneousTouch",
  "input.joystickNamespace",
  "thread.channel",
  "thread.workerRoundtrip",
]

const CHECK_ID_SET: ReadonlySet<string> = new Set(CHECK_IDS)
const CHECK_STATUS_SET: ReadonlySet<string> = new Set<CapabilityCheckStatus>([
  "pass",
  "fail",
  "unavailable",
  "error",
])

function isUtcTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) return false
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z")
  return parsed.toISOString() === normalized
}

export const LOVEJS_OUTSIDE_BROWSER_PROFILE: LoveJsCapabilityProfile = {
  id: "lovejs-11.5-outside-browser",
  requiredHost: "outside-browser",
  runtimeRevision: "9355186de22db13bd88bf2a0db75d2925647d036",
  activation: { status: "eligible" },
  required: new Set<LoveJsCheckId>([
    "runtime.love11_5",
    "lua.version51",
    "lua.setfenv",
    "lua.loadstring",
    "lua.bit",
    "lua.coroutine",
    "web.wasm",
    "web.crossOriginIsolated",
    "graphics.webgl1",
    "graphics.webgl2",
    "graphics.canvas",
    "graphics.imageData",
    "graphics.shader",
    "loop.fixedStep",
    "storage.session",
    "storage.explicitSync",
    "audio.queueableBuffer",
    "thread.channel",
  ]),
  expectedUnavailable: new Set<LoveJsCheckId>(["thread.workerRoundtrip"]),
}

export const LOVEJS_SCRIPTING_DEVICE_PROFILE: LoveJsCapabilityProfile = {
  ...LOVEJS_OUTSIDE_BROWSER_PROFILE,
  id: "lovejs-11.5-scripting-device",
  requiredHost: "scripting-webview",
  activation: {
    status: "evidence-pending",
    reason: "Preview 0.1.4 proves physical startup, but activation still requires same-session touch, audio, and persistence evidence plus app-synchronized declarations",
  },
  required: new Set<LoveJsCheckId>([
    ...[...LOVEJS_OUTSIDE_BROWSER_PROFILE.required].filter((check) => check !== "web.crossOriginIsolated"),
    "input.touchNamespace",
    "input.simultaneousTouch",
  ]),
  expectedUnavailable: new Set<LoveJsCheckId>([
    ...LOVEJS_OUTSIDE_BROWSER_PROFILE.expectedUnavailable,
    "web.crossOriginIsolated",
  ]),
}

function parseCheck(value: unknown, path: string): Result<LoveJsCapabilityCheck, string> {
  if (!isRecord(value)) return err(`${path} must be an object`)
  if (!hasOnlyKeys(value, new Set(["status", "observed"]))) {
    return err(`${path} has unknown fields`)
  }
  if (typeof value["status"] !== "string" || !CHECK_STATUS_SET.has(value["status"])) {
    return err(`${path}.status is unsupported`)
  }
  if (!isJsonValue(value["observed"])) return err(`${path}.observed must be JSON`)
  return ok({
    status: value["status"] as CapabilityCheckStatus,
    observed: value["observed"],
  })
}

function parseLoveJsCapabilityReportInner(
  value: unknown,
): Result<LoveJsCapabilityReport, string> {
  if (!isRecord(value)) return err("capability report must be an object")
  if (!hasOnlyKeys(value, new Set([
    "schemaVersion",
    "purpose",
    "sessionId",
    "runtimeRevision",
    "observedAt",
    "environment",
    "checks",
  ]))) {
    return err("capability report has unknown fields")
  }
  if (value["schemaVersion"] !== LOVEJS_CAPABILITY_SCHEMA_VERSION) {
    return err("capability report schemaVersion must be 1")
  }
  if (value["purpose"] !== "live-activation" && value["purpose"] !== "archival") {
    return err("purpose must be live-activation or archival")
  }
  if (
    typeof value["sessionId"] !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value["sessionId"])
  ) {
    return err("sessionId must be a canonical non-empty identifier")
  }
  if (
    typeof value["runtimeRevision"] !== "string" ||
    !/^[0-9a-f]{40}$/.test(value["runtimeRevision"])
  ) {
    return err("runtimeRevision must be a lowercase 40-character Git revision")
  }
  if (typeof value["observedAt"] !== "string" || !isUtcTimestamp(value["observedAt"])) {
    return err("observedAt must be a canonical UTC ISO-8601 timestamp")
  }
  const environment = value["environment"]
  if (!isRecord(environment) || !hasOnlyKeys(environment, new Set([
    "host", "hostVersion", "osVersion", "renderer",
  ]))) {
    return err("environment is invalid")
  }
  if (environment["host"] !== "outside-browser" && environment["host"] !== "scripting-webview") {
    return err("environment.host is unsupported")
  }
  if (typeof environment["hostVersion"] !== "string" || environment["hostVersion"].length === 0) {
    return err("environment.hostVersion is required")
  }
  if (environment["osVersion"] !== null && typeof environment["osVersion"] !== "string") {
    return err("environment.osVersion must be string or null")
  }
  if (environment["renderer"] !== null && typeof environment["renderer"] !== "string") {
    return err("environment.renderer must be string or null")
  }
  const checks = value["checks"]
  if (!isRecord(checks)) return err("checks must be an object")
  if (Object.keys(checks).length === 0) return err("checks must not be empty")
  const unknownChecks = Object.keys(checks).filter((id) => !CHECK_ID_SET.has(id))
  if (unknownChecks.length > 0) return err(`unknown checks: ${unknownChecks.join(", ")}`)
  const parsedChecks: Partial<Record<LoveJsCheckId, LoveJsCapabilityCheck>> = {}
  for (const [id, check] of Object.entries(checks)) {
    const parsed = parseCheck(check, `checks.${id}`)
    if (!parsed.ok) return parsed
    parsedChecks[id as LoveJsCheckId] = parsed.value
  }
  return ok({
    schemaVersion: LOVEJS_CAPABILITY_SCHEMA_VERSION,
    purpose: value["purpose"],
    sessionId: value["sessionId"],
    runtimeRevision: value["runtimeRevision"],
    observedAt: value["observedAt"],
    environment: {
      host: environment["host"],
      hostVersion: environment["hostVersion"],
      osVersion: environment["osVersion"],
      renderer: environment["renderer"],
    },
    checks: parsedChecks,
  })
}

export function parseLoveJsCapabilityReport(
  value: unknown,
): Result<LoveJsCapabilityReport, string> {
  try {
    return parseLoveJsCapabilityReportInner(value)
  } catch {
    return err("capability report could not be inspected safely")
  }
}

function passed(report: LoveJsCapabilityReport, check: LoveJsCheckId): boolean {
  return report.checks[check]?.status === "pass"
}

export function runtimeCapabilities(
  report: LoveJsCapabilityReport,
): ReadonlySet<RuntimeCapability> {
  const output = new Set<RuntimeCapability>()
  if (passed(report, "lua.version51")) output.add("lua51")
  if (passed(report, "lua.coroutine")) output.add("coroutines")
  if (passed(report, "lua.bit")) output.add("bitLibrary")
  if (passed(report, "web.wasm")) output.add("webAssembly")
  if (passed(report, "graphics.webgl1")) output.add("webgl1")
  if (passed(report, "graphics.webgl2")) output.add("webgl2")
  if (passed(report, "graphics.shader")) output.add("shaders")
  if (passed(report, "graphics.canvas")) output.add("renderTargets")
  if (passed(report, "storage.session")) output.add("filesystem")
  if (passed(report, "storage.explicitSync")) output.add("persistentStorage")
  if (passed(report, "audio.queueableBuffer")) output.add("queueableAudio")
  if (passed(report, "input.simultaneousTouch")) output.add("rawMultiTouch")
  if (passed(report, "thread.channel")) output.add("threadChannels")
  if (passed(report, "thread.workerRoundtrip")) output.add("threads")
  return output
}

export function evaluateLoveJsCapabilities(
  report: LoveJsCapabilityReport,
  profile: LoveJsCapabilityProfile,
): CapabilityGateResult {
  const issues: CapabilityGateIssue[] = []
  if (report.environment.host !== profile.requiredHost) {
    issues.push({
      code: "host_mismatch",
      check: null,
      message: `required ${profile.requiredHost}, observed ${report.environment.host}`,
    })
  }
  if (report.runtimeRevision !== profile.runtimeRevision) {
    issues.push({
      code: "runtime_revision_mismatch",
      check: null,
      message: `required ${profile.runtimeRevision}, observed ${report.runtimeRevision}`,
    })
  }
  if (profile.activation.status === "evidence-pending") {
    issues.push({
      code: "activation_blocked",
      check: null,
      message: profile.activation.reason,
    })
  }
  for (const check of profile.required) {
    const observed = report.checks[check]
    if (observed === undefined) {
      issues.push({ code: "missing_check", check, message: `${check} was not reported` })
    } else if (observed.status !== "pass") {
      issues.push({
        code: "required_check_failed",
        check,
        message: `${check} is ${observed.status}`,
      })
    }
  }
  for (const check of profile.expectedUnavailable) {
    const observed = report.checks[check]
    if (observed === undefined) {
      issues.push({ code: "missing_check", check, message: `${check} was not reported` })
    } else if (observed.status !== "unavailable") {
      issues.push({
        code: "capability_policy_mismatch",
        check,
        message: `${check} must be unavailable for profile ${profile.id}, observed ${observed.status}`,
      })
    }
  }
  if (issues.length > 0) {
    return { compatible: false, issues, descriptor: null }
  }
  return {
    compatible: true,
    issues: [],
    descriptor: {
      id: "org.gen1recomp.runtime.lovejs",
      version: "0.1.0",
      apiVersion: "1.0.0",
      luaVersion: "5.1",
      loveVersion: "11.5.0",
      capabilities: runtimeCapabilities(report),
    },
  }
}

export function verifyLoveJsCapabilityEvidence(
  value: unknown,
  profile: LoveJsCapabilityProfile,
  expectedSessionId: string,
): Result<RuntimeDescriptor, RuntimeError> {
  const parsed = parseLoveJsCapabilityReport(value)
  if (!parsed.ok) {
    return err({
      code: "invalid_payload",
      message: parsed.error,
      retryable: false,
    })
  }
  if (parsed.value.purpose !== "live-activation") {
    return err({
      code: "invalid_payload",
      message: "archival capability evidence cannot activate a runtime",
      retryable: false,
    })
  }
  if (parsed.value.sessionId !== expectedSessionId) {
    return err({
      code: "invalid_payload",
      message: `capability evidence session ${parsed.value.sessionId} does not match ${expectedSessionId}`,
      retryable: false,
    })
  }
  const evaluated = evaluateLoveJsCapabilities(parsed.value, profile)
  if (!evaluated.compatible) {
    return err({
      code: "capability",
      message: evaluated.issues
        .map(({ check, message }) => `${check ?? "environment"}: ${message}`)
        .join("; "),
      retryable: true,
    })
  }
  return ok(evaluated.descriptor)
}
