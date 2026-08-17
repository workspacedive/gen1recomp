import { compare, valid } from "semver"

import {
  parseComponentManifest,
  type ComponentKind,
  type ComponentManifest,
} from "../../contracts/src/component-manifest.js"
import { hasOnlyKeys, isRecord } from "../../contracts/src/json.js"
import { err, ok, type Result } from "../../contracts/src/result.js"

export type UpdateCatalogDomain = "system" | "mods"
export type UpdateChannel = "stable" | "preview"

export type LocalizedReleaseNotes = {
  readonly en: string
  readonly de?: string
}

export type CatalogRelease = {
  readonly manifest: ComponentManifest
  readonly publishedAt: string
  readonly notes: LocalizedReleaseNotes
}

export type UpdateCatalog = {
  readonly schemaVersion: 1
  readonly catalogId: string
  readonly domain: UpdateCatalogDomain
  readonly channel: UpdateChannel
  readonly sequence: number
  readonly generatedAt: string
  readonly artifactBaseURL: string
  readonly releases: readonly CatalogRelease[]
}

export type CatalogTrustPolicy = {
  readonly catalogId: string
  readonly domain: UpdateCatalogDomain
  readonly channel: UpdateChannel
  readonly sourceURLs: readonly string[]
  readonly artifactBaseURLs: readonly string[]
}

export type CatalogError = {
  readonly code:
    | "invalid_catalog"
    | "identity"
    | "domain"
    | "channel"
    | "source"
    | "artifact_source"
    | "rollback"
    | "mixed_domain"
    | "duplicate"
  readonly message: string
}

const CATALOG_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/
const SYSTEM_KINDS: ReadonlySet<ComponentKind> = new Set([
  "host",
  "platform",
  "runtime",
  "lua",
  "compatibility",
  "love2d",
  "kernel",
  "core",
  "mod-api",
  "ui",
  "renderer",
])

function catalogError(code: CatalogError["code"], message: string): Result<never, CatalogError> {
  return err({ code, message })
}

function parseTimestamp(value: unknown, field: string): Result<string, CatalogError> {
  if (typeof value !== "string") return catalogError("invalid_catalog", `${field} must be an ISO timestamp`)
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    return catalogError("invalid_catalog", `${field} must be a canonical UTC ISO timestamp`)
  }
  return ok(value)
}

function parseHTTPSBaseURL(value: unknown): Result<string, CatalogError> {
  if (typeof value !== "string") {
    return catalogError("invalid_catalog", "artifactBaseURL must be an HTTPS URL")
  }
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
      return catalogError("invalid_catalog", "artifactBaseURL must be a credential-free HTTPS URL without query or fragment")
    }
    if (!url.pathname.endsWith("/")) {
      return catalogError("invalid_catalog", "artifactBaseURL must end with a slash")
    }
    return ok(url.toString())
  } catch {
    return catalogError("invalid_catalog", "artifactBaseURL must be a valid HTTPS URL")
  }
}

function parseNotes(value: unknown, index: number): Result<LocalizedReleaseNotes, CatalogError> {
  if (!isRecord(value) || !hasOnlyKeys(value, new Set(["en", "de"]))) {
    return catalogError("invalid_catalog", `releases[${index}].notes must contain only en and optional de`)
  }
  if (typeof value["en"] !== "string" || value["en"].trim().length === 0) {
    return catalogError("invalid_catalog", `releases[${index}].notes.en is required`)
  }
  const de = value["de"]
  if (de !== undefined && (typeof de !== "string" || de.trim().length === 0)) {
    return catalogError("invalid_catalog", `releases[${index}].notes.de must be a non-empty string`)
  }
  return de === undefined ? ok({ en: value["en"] }) : ok({ en: value["en"], de })
}

function parseRelease(value: unknown, index: number): Result<CatalogRelease, CatalogError> {
  if (!isRecord(value) || !hasOnlyKeys(value, new Set(["manifest", "publishedAt", "notes"]))) {
    return catalogError("invalid_catalog", `releases[${index}] has an invalid shape`)
  }
  const manifest = parseComponentManifest(value["manifest"])
  if (!manifest.ok) {
    return catalogError("invalid_catalog", `releases[${index}].manifest: ${manifest.error}`)
  }
  const publishedAt = parseTimestamp(value["publishedAt"], `releases[${index}].publishedAt`)
  if (!publishedAt.ok) return publishedAt
  const notes = parseNotes(value["notes"], index)
  if (!notes.ok) return notes
  return ok({ manifest: manifest.value, publishedAt: publishedAt.value, notes: notes.value })
}

export function parseUpdateCatalog(value: unknown): Result<UpdateCatalog, CatalogError> {
  if (!isRecord(value) || !hasOnlyKeys(value, new Set([
    "schemaVersion",
    "catalogId",
    "domain",
    "channel",
    "sequence",
    "generatedAt",
    "artifactBaseURL",
    "releases",
  ]))) {
    return catalogError("invalid_catalog", "catalog has an invalid shape")
  }
  if (value["schemaVersion"] !== 1) {
    return catalogError("invalid_catalog", "catalog schemaVersion must be 1")
  }
  if (typeof value["catalogId"] !== "string" || !CATALOG_ID_PATTERN.test(value["catalogId"])) {
    return catalogError("invalid_catalog", "catalogId must be a canonical lowercase identifier")
  }
  if (value["domain"] !== "system" && value["domain"] !== "mods") {
    return catalogError("invalid_catalog", "catalog domain is unsupported")
  }
  if (value["channel"] !== "stable" && value["channel"] !== "preview") {
    return catalogError("invalid_catalog", "catalog channel is unsupported")
  }
  if (!Number.isSafeInteger(value["sequence"]) || (value["sequence"] as number) < 1) {
    return catalogError("invalid_catalog", "catalog sequence must be a positive safe integer")
  }
  const generatedAt = parseTimestamp(value["generatedAt"], "generatedAt")
  if (!generatedAt.ok) return generatedAt
  const artifactBaseURL = parseHTTPSBaseURL(value["artifactBaseURL"])
  if (!artifactBaseURL.ok) return artifactBaseURL
  if (!Array.isArray(value["releases"])) {
    return catalogError("invalid_catalog", "releases must be an array")
  }

  const releases: CatalogRelease[] = []
  const identities = new Set<string>()
  for (const [index, candidate] of value["releases"].entries()) {
    const release = parseRelease(candidate, index)
    if (!release.ok) return release
    const key = `${release.value.manifest.id}\0${release.value.manifest.version}`
    if (identities.has(key)) {
      return catalogError("duplicate", `duplicate release ${release.value.manifest.id}@${release.value.manifest.version}`)
    }
    identities.add(key)
    releases.push(release.value)
  }

  releases.sort((left, right) =>
    left.manifest.id.localeCompare(right.manifest.id) ||
    compare(right.manifest.version, left.manifest.version),
  )
  return ok({
    schemaVersion: 1,
    catalogId: value["catalogId"],
    domain: value["domain"],
    channel: value["channel"],
    sequence: value["sequence"] as number,
    generatedAt: generatedAt.value,
    artifactBaseURL: artifactBaseURL.value,
    releases,
  })
}

function canonicalSourceURL(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hash !== "") return null
    return url.toString()
  } catch {
    return null
  }
}

function isAllowedBaseURL(candidate: string, allowed: readonly string[]): boolean {
  const parsed = canonicalSourceURL(candidate)
  if (parsed === null) return false
  return allowed.some((entry) => canonicalSourceURL(entry) === parsed)
}

export function catalogArtifactURL(catalog: UpdateCatalog, release: CatalogRelease): string {
  return new URL(release.manifest.artifact.path, catalog.artifactBaseURL).toString()
}

export function verifyCatalogTrust(
  catalog: UpdateCatalog,
  sourceURL: string,
  policy: CatalogTrustPolicy,
  lastAcceptedSequence: number | null,
): Result<UpdateCatalog, CatalogError> {
  if (catalog.catalogId !== policy.catalogId) {
    return catalogError("identity", `expected catalog ${policy.catalogId}, found ${catalog.catalogId}`)
  }
  if (catalog.domain !== policy.domain) {
    return catalogError("domain", `expected ${policy.domain} catalog, found ${catalog.domain}`)
  }
  if (catalog.channel !== policy.channel) {
    return catalogError("channel", `expected ${policy.channel} channel, found ${catalog.channel}`)
  }
  const canonicalSource = canonicalSourceURL(sourceURL)
  if (canonicalSource === null || !policy.sourceURLs.some((candidate) => canonicalSourceURL(candidate) === canonicalSource)) {
    return catalogError("source", "catalog source URL is not trusted")
  }
  if (!isAllowedBaseURL(catalog.artifactBaseURL, policy.artifactBaseURLs)) {
    return catalogError("artifact_source", "catalog artifact base URL is not trusted")
  }
  if (lastAcceptedSequence !== null && catalog.sequence < lastAcceptedSequence) {
    return catalogError("rollback", `catalog sequence ${catalog.sequence} is older than accepted sequence ${lastAcceptedSequence}`)
  }

  for (const release of catalog.releases) {
    const isSystem = SYSTEM_KINDS.has(release.manifest.kind)
    if ((catalog.domain === "system" && !isSystem) || (catalog.domain === "mods" && release.manifest.kind !== "mod")) {
      return catalogError("mixed_domain", `${release.manifest.id} has kind ${release.manifest.kind} in the ${catalog.domain} catalog`)
    }
    if (valid(release.manifest.version) === null) {
      return catalogError("invalid_catalog", `${release.manifest.id} has an invalid semantic version`)
    }
    const artifactURL = new URL(release.manifest.artifact.path, catalog.artifactBaseURL)
    const base = new URL(catalog.artifactBaseURL)
    if (artifactURL.origin !== base.origin || !artifactURL.pathname.startsWith(base.pathname)) {
      return catalogError("artifact_source", `${release.manifest.id} resolves outside the trusted artifact base path`)
    }
  }
  return ok(catalog)
}
