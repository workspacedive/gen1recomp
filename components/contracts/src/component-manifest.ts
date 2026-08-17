import { valid } from "semver"

import { hasOnlyKeys, isRecord } from "./json.js"
import { err, ok, type Result } from "./result.js"

export const COMPONENT_MANIFEST_SCHEMA_VERSION = 1 as const

export type ComponentKind =
  | "host"
  | "platform"
  | "runtime"
  | "lua"
  | "compatibility"
  | "love2d"
  | "kernel"
  | "core"
  | "mod-api"
  | "mod"
  | "ui"
  | "renderer"

export type IntegrityAlgorithm = "sha256"

export type ComponentArtifact = {
  readonly path: string
  readonly size: number
  readonly integrity: {
    readonly algorithm: IntegrityAlgorithm
    readonly digest: string
  }
}

export type ComponentDependency = {
  readonly id: string
  readonly range: string
  readonly optional?: boolean
}

export type ComponentMigration = {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly entry: string
}

export type ComponentSelfTest = {
  readonly id: string
  readonly entry: string
  readonly timeoutMs: number
}

export type ComponentManifest = {
  readonly schemaVersion: typeof COMPONENT_MANIFEST_SCHEMA_VERSION
  readonly id: string
  readonly kind: ComponentKind
  readonly version: string
  readonly apiVersion: string
  readonly artifact: ComponentArtifact
  readonly dependencies: readonly ComponentDependency[]
  readonly compatibility: Readonly<Record<string, string>>
  readonly capabilities: readonly string[]
  readonly migrations: readonly ComponentMigration[]
  readonly selfTests: readonly ComponentSelfTest[]
}

const COMPONENT_KINDS: ReadonlySet<string> = new Set<ComponentKind>([
  "host",
  "platform",
  "runtime",
  "lua",
  "compatibility",
  "love2d",
  "kernel",
  "core",
  "mod-api",
  "mod",
  "ui",
  "renderer",
])

export const COMPONENT_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/
const SHA256_RE = /^[a-f0-9]{64}$/
const COMPATIBILITY_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/

function stringValue(record: Record<string, unknown>, key: string): Result<string, string> {
  const value = record[key]
  return typeof value === "string" && value.trim().length > 0
    ? ok(value)
    : err(`${key} must be a non-empty string`)
}

function parseArtifact(value: unknown): Result<ComponentArtifact, string> {
  if (!isRecord(value)) return err("artifact must be an object")
  if (!hasOnlyKeys(value, new Set(["path", "size", "integrity"]))) {
    return err("artifact has unknown fields")
  }
  const path = stringValue(value, "path")
  if (!path.ok) return path
  if (path.value.startsWith("/") || path.value.split("/").includes("..")) {
    return err("artifact.path must be a safe relative path")
  }
  const size = value["size"]
  if (!Number.isSafeInteger(size) || (size as number) < 0) {
    return err("artifact.size must be a non-negative safe integer")
  }
  const integrity = value["integrity"]
  if (!isRecord(integrity) || !hasOnlyKeys(integrity, new Set(["algorithm", "digest"]))) {
    return err("artifact.integrity must contain only algorithm and digest")
  }
  if (integrity["algorithm"] !== "sha256") {
    return err("artifact.integrity.algorithm must be sha256")
  }
  if (typeof integrity["digest"] !== "string" || !SHA256_RE.test(integrity["digest"])) {
    return err("artifact.integrity.digest must be a lowercase SHA-256")
  }
  return ok({
    path: path.value,
    size: size as number,
    integrity: { algorithm: "sha256", digest: integrity["digest"] },
  })
}

function parseDependencies(value: unknown): Result<ComponentDependency[], string> {
  if (!Array.isArray(value)) return err("dependencies must be an array")
  const output: ComponentDependency[] = []
  const ids = new Set<string>()
  for (const [index, candidate] of value.entries()) {
    if (!isRecord(candidate)) return err(`dependencies[${index}] must be an object`)
    if (!hasOnlyKeys(candidate, new Set(["id", "range", "optional"]))) {
      return err(`dependencies[${index}] has unknown fields`)
    }
    const id = stringValue(candidate, "id")
    const range = stringValue(candidate, "range")
    if (!id.ok) return err(`dependencies[${index}].${id.error}`)
    if (!range.ok) return err(`dependencies[${index}].${range.error}`)
    if (!COMPONENT_ID_PATTERN.test(id.value)) return err(`dependencies[${index}].id is invalid`)
    if (ids.has(id.value)) return err(`duplicate dependency: ${id.value}`)
    ids.add(id.value)
    const optional = candidate["optional"]
    if (optional !== undefined && typeof optional !== "boolean") {
      return err(`dependencies[${index}].optional must be boolean`)
    }
    output.push(
      optional === undefined
        ? { id: id.value, range: range.value }
        : { id: id.value, range: range.value, optional },
    )
  }
  return ok(output)
}

function parseStringMap(value: unknown, name: string): Result<Record<string, string>, string> {
  if (!isRecord(value)) return err(`${name} must be an object`)
  const output: Record<string, string> = {}
  for (const [key, candidate] of Object.entries(value)) {
    if (
      !COMPATIBILITY_KEY_PATTERN.test(key) ||
      typeof candidate !== "string" ||
      candidate.trim().length === 0
    ) {
      return err(`${name} keys must be API identifiers and values must be non-empty strings`)
    }
    output[key] = candidate
  }
  return ok(output)
}

function parseStringArray(value: unknown, name: string): Result<string[], string> {
  if (!Array.isArray(value)) return err(`${name} must be an array`)
  const output: string[] = []
  const seen = new Set<string>()
  for (const [index, candidate] of value.entries()) {
    if (typeof candidate !== "string" || candidate.trim().length === 0) {
      return err(`${name}[${index}] must be a non-empty string`)
    }
    if (seen.has(candidate)) return err(`${name} contains duplicate ${candidate}`)
    seen.add(candidate)
    output.push(candidate)
  }
  return ok(output)
}

function parseMigrations(value: unknown): Result<ComponentMigration[], string> {
  if (!Array.isArray(value)) return err("migrations must be an array")
  const output: ComponentMigration[] = []
  for (const [index, candidate] of value.entries()) {
    if (!isRecord(candidate)) return err(`migrations[${index}] must be an object`)
    if (!hasOnlyKeys(candidate, new Set(["id", "from", "to", "entry"]))) {
      return err(`migrations[${index}] has unknown fields`)
    }
    const id = stringValue(candidate, "id")
    const from = stringValue(candidate, "from")
    const to = stringValue(candidate, "to")
    const entry = stringValue(candidate, "entry")
    if (!id.ok) return err(`migrations[${index}].${id.error}`)
    if (!from.ok) return err(`migrations[${index}].${from.error}`)
    if (!to.ok) return err(`migrations[${index}].${to.error}`)
    if (!entry.ok) return err(`migrations[${index}].${entry.error}`)
    output.push({ id: id.value, from: from.value, to: to.value, entry: entry.value })
  }
  return ok(output)
}

function parseSelfTests(value: unknown): Result<ComponentSelfTest[], string> {
  if (!Array.isArray(value)) return err("selfTests must be an array")
  const output: ComponentSelfTest[] = []
  for (const [index, candidate] of value.entries()) {
    if (!isRecord(candidate)) return err(`selfTests[${index}] must be an object`)
    if (!hasOnlyKeys(candidate, new Set(["id", "entry", "timeoutMs"]))) {
      return err(`selfTests[${index}] has unknown fields`)
    }
    const id = stringValue(candidate, "id")
    const entry = stringValue(candidate, "entry")
    const timeout = candidate["timeoutMs"]
    if (!id.ok) return err(`selfTests[${index}].${id.error}`)
    if (!entry.ok) return err(`selfTests[${index}].${entry.error}`)
    if (!Number.isSafeInteger(timeout) || (timeout as number) <= 0) {
      return err(`selfTests[${index}].timeoutMs must be a positive safe integer`)
    }
    output.push({ id: id.value, entry: entry.value, timeoutMs: timeout as number })
  }
  return ok(output)
}

export function parseComponentManifest(value: unknown): Result<ComponentManifest, string> {
  if (!isRecord(value)) return err("manifest must be an object")
  if (!hasOnlyKeys(value, new Set([
    "schemaVersion",
    "id",
    "kind",
    "version",
    "apiVersion",
    "artifact",
    "dependencies",
    "compatibility",
    "capabilities",
    "migrations",
    "selfTests",
  ]))) {
    return err("manifest has unknown fields")
  }
  if (value["schemaVersion"] !== COMPONENT_MANIFEST_SCHEMA_VERSION) {
    return err(`unsupported schemaVersion: ${String(value["schemaVersion"])}`)
  }
  const id = stringValue(value, "id")
  const version = stringValue(value, "version")
  const apiVersion = stringValue(value, "apiVersion")
  if (!id.ok) return id
  if (!COMPONENT_ID_PATTERN.test(id.value)) return err("id must be a reverse-DNS-like lowercase identifier")
  if (!version.ok) return version
  if (valid(version.value) === null) return err("version must be canonical semantic X.Y.Z")
  if (!apiVersion.ok) return apiVersion
  if (valid(apiVersion.value) === null) return err("apiVersion must be canonical semantic X.Y.Z")
  if (typeof value["kind"] !== "string" || !COMPONENT_KINDS.has(value["kind"])) {
    return err("kind is unsupported")
  }

  const artifact = parseArtifact(value["artifact"])
  if (!artifact.ok) return artifact
  const dependencies = parseDependencies(value["dependencies"])
  if (!dependencies.ok) return dependencies
  const compatibility = parseStringMap(value["compatibility"], "compatibility")
  if (!compatibility.ok) return compatibility
  const capabilities = parseStringArray(value["capabilities"], "capabilities")
  if (!capabilities.ok) return capabilities
  const migrations = parseMigrations(value["migrations"])
  if (!migrations.ok) return migrations
  const selfTests = parseSelfTests(value["selfTests"])
  if (!selfTests.ok) return selfTests

  return ok({
    schemaVersion: COMPONENT_MANIFEST_SCHEMA_VERSION,
    id: id.value,
    kind: value["kind"] as ComponentKind,
    version: version.value,
    apiVersion: apiVersion.value,
    artifact: artifact.value,
    dependencies: dependencies.value,
    compatibility: compatibility.value,
    capabilities: capabilities.value,
    migrations: migrations.value,
    selfTests: selfTests.value,
  })
}
