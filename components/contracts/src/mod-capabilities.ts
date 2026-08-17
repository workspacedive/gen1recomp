import { err, ok, type Result } from "./result.js"

export type UpstreamModPermission =
  | "network"
  | "filesystem"
  | "engine_internals"
  | "steps"
  | "background"

export type ModCapability =
  | "assets:read-own"
  | "events:subscribe"
  | "hooks:register"
  | "registry:read"
  | "registry:write-during-load"
  | "save:read-own"
  | "save:write-own"
  | "storage:read-own"
  | "storage:write-own"
  | "ui:register"
  | "network:https"
  | "background:compute"
  | "steps:read"
  | "imports:read-declared"
  | "platform:haptics"
  | "legacy:engine-internals"

export type ModCapabilityClass = "baseline" | "optional" | "legacy"

export const BASELINE_MOD_CAPABILITIES: ReadonlySet<ModCapability> = new Set([
  "assets:read-own",
  "events:subscribe",
  "hooks:register",
  "registry:read",
  "registry:write-during-load",
  "save:read-own",
  "save:write-own",
  "storage:read-own",
  "storage:write-own",
  "ui:register",
])

const OPTIONAL_MOD_CAPABILITIES: ReadonlySet<ModCapability> = new Set([
  "network:https",
  "background:compute",
  "steps:read",
  "imports:read-declared",
  "platform:haptics",
])

const UPSTREAM_PERMISSIONS: ReadonlySet<string> = new Set<UpstreamModPermission>([
  "network",
  "filesystem",
  "engine_internals",
  "steps",
  "background",
])

export type ModPermissionMapping = {
  readonly capabilities: ReadonlySet<ModCapability>
  readonly disclosures: readonly string[]
}

export type ModCapabilityDecision =
  | {
      readonly allowed: true
      readonly capability: ModCapability
      readonly source: "baseline" | "grant" | "legacy-opt-in"
    }
  | {
      readonly allowed: false
      readonly capability: ModCapability
      readonly reason: "undeclared" | "not_granted" | "unavailable" | "legacy_disabled"
    }

export type ModCapabilityPolicyOptions = {
  readonly declared: ReadonlySet<ModCapability>
  readonly granted: ReadonlySet<ModCapability>
  readonly available: ReadonlySet<ModCapability>
  readonly legacyInternalsEnabled: boolean
}

export function modCapabilityClass(capability: ModCapability): ModCapabilityClass {
  if (BASELINE_MOD_CAPABILITIES.has(capability)) return "baseline"
  if (OPTIONAL_MOD_CAPABILITIES.has(capability)) return "optional"
  return "legacy"
}

export function parseUpstreamModPermissions(
  value: unknown,
): Result<readonly UpstreamModPermission[], string> {
  if (!Array.isArray(value)) return err("permissions must be an array")
  const output: UpstreamModPermission[] = []
  const seen = new Set<string>()
  for (const [index, permission] of value.entries()) {
    if (typeof permission !== "string" || !UPSTREAM_PERMISSIONS.has(permission)) {
      return err(`permissions[${index}] is unsupported`)
    }
    if (seen.has(permission)) return err(`duplicate permission: ${permission}`)
    seen.add(permission)
    output.push(permission as UpstreamModPermission)
  }
  return ok(output)
}

export function mapUpstreamModPermissions(
  permissions: readonly UpstreamModPermission[],
): ModPermissionMapping {
  const capabilities = new Set<ModCapability>()
  const disclosures: string[] = []
  for (const permission of permissions) {
    switch (permission) {
      case "network":
        capabilities.add("network:https")
        break
      case "background":
        capabilities.add("background:compute")
        break
      case "steps":
        capabilities.add("steps:read")
        break
      case "engine_internals":
        capabilities.add("legacy:engine-internals")
        break
      case "filesystem":
        disclosures.push(
          "filesystem is legacy disclosure only; no raw host filesystem capability is granted",
        )
        break
    }
  }
  return { capabilities, disclosures }
}

export class ModCapabilityPolicy {
  readonly #declared: ReadonlySet<ModCapability>
  readonly #granted: ReadonlySet<ModCapability>
  readonly #available: ReadonlySet<ModCapability>
  readonly #legacyInternalsEnabled: boolean

  public constructor(options: ModCapabilityPolicyOptions) {
    this.#declared = new Set(options.declared)
    this.#granted = new Set(options.granted)
    this.#available = new Set(options.available)
    this.#legacyInternalsEnabled = options.legacyInternalsEnabled
  }

  public authorize(capability: ModCapability): ModCapabilityDecision {
    const classification = modCapabilityClass(capability)
    if (classification === "baseline") {
      return { allowed: true, capability, source: "baseline" }
    }
    if (!this.#declared.has(capability)) {
      return { allowed: false, capability, reason: "undeclared" }
    }
    if (!this.#available.has(capability)) {
      return { allowed: false, capability, reason: "unavailable" }
    }
    if (classification === "legacy") {
      return this.#legacyInternalsEnabled
        ? { allowed: true, capability, source: "legacy-opt-in" }
        : { allowed: false, capability, reason: "legacy_disabled" }
    }
    return this.#granted.has(capability)
      ? { allowed: true, capability, source: "grant" }
      : { allowed: false, capability, reason: "not_granted" }
  }
}
