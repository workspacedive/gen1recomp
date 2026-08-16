import { valid, validRange } from "semver"

import { hasOnlyKeys, isRecord } from "../../contracts/src/json.js"
import { err, ok, type Result } from "../../contracts/src/result.js"

export type ModPermission = "network" | "filesystem" | "engine_internals" | "steps" | "background"
export type ModProfile = "content" | "overhaul" | "total_conversion"
export type ModGame = "red" | "blue" | "yellow" | "gold" | "gen1" | "gen2" | "all"

export type ModDependency = {
  readonly id: string
  readonly range: string | null
  readonly github: string | null
  readonly games: readonly ModGame[]
}

export type ModUserImport = {
  readonly id: string
  readonly name: string
  readonly file: string
  readonly md5: readonly string[]
  readonly format: "raw" | "n64"
  readonly description: string | null
  readonly size: number | null
  readonly maximumSize: number | null
}

export type Gen1RecompModManifest = {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly api: 1 | 2
  readonly entry: string
  readonly priority: number
  readonly games: readonly ModGame[]
  readonly dependencies: readonly ModDependency[]
  readonly optionalDependencies: readonly ModDependency[]
  readonly dependencySources: Readonly<Record<string, string>>
  readonly conflicts: readonly ModDependency[]
  readonly category: string
  readonly gameVersion: string | null
  readonly description: string
  readonly github: string | null
  readonly experimental: boolean
  readonly profile: ModProfile
  readonly affectsLink: boolean
  readonly permissions: readonly ModPermission[]
  readonly requiredImports: readonly ModUserImport[]
  readonly optionalImports: readonly ModUserImport[]
  readonly optionsSchema: string | null
  readonly assetsTransforms: string | null
  readonly logURL: string | null
}

export type ModManifestError = {
  readonly code: "invalid_manifest" | "unsupported_api" | "unsafe_path" | "invalid_dependency" | "invalid_permission"
  readonly path: string
  readonly message: string
}

const MOD_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const CATEGORY_PATTERN = /^[A-Z][A-Z0-9_]{0,31}$/
const MD5_PATTERN = /^[a-f0-9]{32}$/
const GAME_SET: ReadonlySet<string> = new Set<ModGame>(["red", "blue", "yellow", "gold", "gen1", "gen2", "all"])
const PERMISSIONS: ReadonlySet<string> = new Set<ModPermission>([
  "network", "filesystem", "engine_internals", "steps", "background",
])
const PROFILES: ReadonlySet<string> = new Set<ModProfile>(["content", "overhaul", "total_conversion"])
const MANIFEST_KEYS = new Set([
  "id", "name", "version", "entry", "api", "priority", "games",
  "dependencies", "optional_dependencies", "dependency_sources", "conflicts", "incompatible",
  "category", "game_version", "description", "github", "experimental", "profile",
  "affects_link", "permissions", "required_imports", "optional_imports", "options_schema",
  "assets_transforms", "force_enable_env", "log_url",
])

function failure(
  code: ModManifestError["code"],
  path: string,
  message: string,
): Result<never, ModManifestError> {
  return err({ code, path, message })
}

function safeRelativeFile(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 240
    && !value.startsWith("/")
    && !value.includes("\\")
    && value.split("/").every((part) => part !== "" && part !== "." && part !== "..")
}

export function normalizeGitHubRepository(value: unknown): Result<string | null, ModManifestError> {
  if (value === undefined || value === null || value === "") return ok(null)
  if (typeof value !== "string") return failure("invalid_manifest", "github", "github must be a string")
  let candidate = value.trim()
  const url = /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(candidate)
  if (url !== null) candidate = `${url[1]}/${url[2]}`
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(candidate)) {
    return failure("invalid_manifest", "github", "github must be owner/repo or an HTTPS github.com repository URL")
  }
  return ok(candidate)
}

function parseGames(value: unknown, path: string, defaults: readonly ModGame[] = ["gen1"]): Result<readonly ModGame[], ModManifestError> {
  if (value === undefined) return ok(defaults)
  if (!Array.isArray(value) || value.length === 0) return failure("invalid_manifest", path, `${path} must be a non-empty array`)
  const output: ModGame[] = []
  const seen = new Set<string>()
  for (const [index, game] of value.entries()) {
    if (typeof game !== "string" || !GAME_SET.has(game) || seen.has(game)) {
      return failure("invalid_manifest", `${path}[${index}]`, "game target is unsupported or duplicated")
    }
    seen.add(game)
    output.push(game as ModGame)
  }
  return ok(output)
}

function parseDependencyString(value: string, path: string): Result<ModDependency, ModManifestError> {
  const hash = value.indexOf("#")
  const githubRaw = hash < 0 ? null : value.slice(hash + 1)
  const dependency = hash < 0 ? value : value.slice(0, hash)
  const at = dependency.indexOf("@")
  const id = at < 0 ? dependency : dependency.slice(0, at)
  const range = at < 0 ? null : dependency.slice(at + 1)
  if (!MOD_ID_PATTERN.test(id) || (range !== null && validRange(range) === null)) {
    return failure("invalid_dependency", path, "dependency ID or semantic version range is invalid")
  }
  const github = normalizeGitHubRepository(githubRaw)
  if (!github.ok) return failure("invalid_dependency", path, github.error.message)
  return ok({ id, range, github: github.value, games: [] })
}

function parseDependency(value: unknown, path: string): Result<ModDependency, ModManifestError> {
  if (typeof value === "string") return parseDependencyString(value, path)
  if (!isRecord(value) || !hasOnlyKeys(value, new Set(["id", "range", "version", "games", "github", "repo"]))) {
    return failure("invalid_dependency", path, "dependency must be a supported string or object")
  }
  if (typeof value["id"] !== "string" || !MOD_ID_PATTERN.test(value["id"])) {
    return failure("invalid_dependency", `${path}.id`, "dependency id is invalid")
  }
  const rangeValue = value["range"] ?? value["version"] ?? null
  if (rangeValue !== null && (typeof rangeValue !== "string" || validRange(rangeValue) === null)) {
    return failure("invalid_dependency", `${path}.range`, "dependency range is invalid")
  }
  const github = normalizeGitHubRepository(value["github"] ?? value["repo"])
  if (!github.ok) return failure("invalid_dependency", `${path}.github`, github.error.message)
  const games: Result<readonly ModGame[], ModManifestError> = value["games"] === undefined
    ? ok<readonly ModGame[]>([])
    : parseGames(value["games"], `${path}.games`, [])
  if (!games.ok) return games
  return ok({ id: value["id"], range: rangeValue as string | null, github: github.value, games: games.value })
}

function parseDependencies(value: unknown, path: string): Result<readonly ModDependency[], ModManifestError> {
  if (value === undefined) return ok([])
  if (!Array.isArray(value)) return failure("invalid_dependency", path, `${path} must be an array`)
  const output: ModDependency[] = []
  const seen = new Set<string>()
  for (const [index, candidate] of value.entries()) {
    const parsed = parseDependency(candidate, `${path}[${index}]`)
    if (!parsed.ok) return parsed
    const key = `${parsed.value.id}\0${parsed.value.range ?? ""}`
    if (seen.has(key)) return failure("invalid_dependency", `${path}[${index}]`, "dependency is duplicated")
    seen.add(key)
    output.push(parsed.value)
  }
  return ok(output)
}

function parseImports(value: unknown, path: string): Result<readonly ModUserImport[], ModManifestError> {
  if (value === undefined) return ok([])
  if (!Array.isArray(value)) return failure("invalid_manifest", path, `${path} must be an array`)
  const output: ModUserImport[] = []
  const ids = new Set<string>()
  for (const [index, candidate] of value.entries()) {
    const itemPath = `${path}[${index}]`
    if (!isRecord(candidate) || !hasOnlyKeys(candidate, new Set([
      "id", "name", "file", "md5", "format", "description", "size", "max_size",
    ]))) return failure("invalid_manifest", itemPath, "user import has unknown fields")
    if (typeof candidate["id"] !== "string" || !MOD_ID_PATTERN.test(candidate["id"]) || ids.has(candidate["id"])) {
      return failure("invalid_manifest", `${itemPath}.id`, "user import id is invalid or duplicated")
    }
    if (typeof candidate["name"] !== "string" || candidate["name"].trim().length === 0 || !safeRelativeFile(candidate["file"]) || (candidate["file"] as string).includes("/")) {
      return failure("invalid_manifest", itemPath, "user import name/file is invalid")
    }
    const rawMd5 = Array.isArray(candidate["md5"]) ? candidate["md5"] : [candidate["md5"]]
    if (rawMd5.length === 0 || rawMd5.some((digest) => typeof digest !== "string" || !MD5_PATTERN.test(digest))) {
      return failure("invalid_manifest", `${itemPath}.md5`, "user import MD5 list is invalid")
    }
    const format = candidate["format"] ?? "raw"
    if (format !== "raw" && format !== "n64") return failure("invalid_manifest", `${itemPath}.format`, "user import format is unsupported")
    const size = candidate["size"] ?? null
    const maximumSize = candidate["max_size"] ?? null
    if ((size !== null && (!Number.isSafeInteger(size) || (size as number) <= 0))
      || (maximumSize !== null && (!Number.isSafeInteger(maximumSize) || (maximumSize as number) <= 0))) {
      return failure("invalid_manifest", itemPath, "user import size policy is invalid")
    }
    ids.add(candidate["id"])
    output.push({
      id: candidate["id"],
      name: candidate["name"],
      file: candidate["file"] as string,
      md5: rawMd5 as string[],
      format,
      description: typeof candidate["description"] === "string" ? candidate["description"] : null,
      size: size as number | null,
      maximumSize: maximumSize as number | null,
    })
  }
  return ok(output)
}

export function parseGen1RecompModManifest(value: unknown): Result<Gen1RecompModManifest, ModManifestError> {
  if (!isRecord(value) || !hasOnlyKeys(value, MANIFEST_KEYS)) {
    return failure("invalid_manifest", "$", "manifest must be an object with only supported fields")
  }
  if (typeof value["id"] !== "string" || !MOD_ID_PATTERN.test(value["id"])) return failure("invalid_manifest", "id", "mod id is invalid")
  if (typeof value["name"] !== "string" || value["name"].trim().length === 0 || value["name"].length > 80) return failure("invalid_manifest", "name", "mod name is invalid")
  if (typeof value["version"] !== "string" || valid(value["version"]) === null) return failure("invalid_manifest", "version", "mod version must be canonical semantic versioning")
  const api = value["api"] ?? 1
  if (api !== 1 && api !== 2) return failure("unsupported_api", "api", "only Mod API 1 and 2 are supported")
  if (!safeRelativeFile(value["entry"]) || !(value["entry"] as string).toLowerCase().endsWith(".lua")) return failure("unsafe_path", "entry", "entry must be a safe relative Lua file")
  const priority = value["priority"] ?? 0
  if (!Number.isSafeInteger(priority)) return failure("invalid_manifest", "priority", "priority must be a safe integer")
  const games = parseGames(value["games"], "games")
  if (!games.ok) return games
  const dependencies = parseDependencies(value["dependencies"], "dependencies")
  if (!dependencies.ok) return dependencies
  const optionalDependencies = parseDependencies(value["optional_dependencies"], "optional_dependencies")
  if (!optionalDependencies.ok) return optionalDependencies
  const dependencySources: Record<string, string> = {}
  if (value["dependency_sources"] !== undefined) {
    if (!isRecord(value["dependency_sources"])) {
      return failure("invalid_dependency", "dependency_sources", "dependency_sources must be an object")
    }
    for (const [id, repository] of Object.entries(value["dependency_sources"])) {
      if (!MOD_ID_PATTERN.test(id)) return failure("invalid_dependency", `dependency_sources.${id}`, "dependency source ID is invalid")
      const parsed = normalizeGitHubRepository(repository)
      if (!parsed.ok || parsed.value === null) return failure("invalid_dependency", `dependency_sources.${id}`, "dependency source repository is invalid")
      dependencySources[id] = parsed.value
    }
  }
  const withSources = (items: readonly ModDependency[]): readonly ModDependency[] => items.map((dependency) =>
    dependency.github === null && dependencySources[dependency.id] !== undefined
      ? { ...dependency, github: dependencySources[dependency.id]! }
      : dependency,
  )
  const conflicts = parseDependencies([
    ...(Array.isArray(value["conflicts"]) ? value["conflicts"] : []),
    ...(Array.isArray(value["incompatible"]) ? value["incompatible"] : []),
  ], "conflicts")
  if (!conflicts.ok) return conflicts
  if ((value["conflicts"] !== undefined && !Array.isArray(value["conflicts"]))
    || (value["incompatible"] !== undefined && !Array.isArray(value["incompatible"]))) {
    return failure("invalid_dependency", "conflicts", "conflicts and incompatible must be arrays")
  }
  const profile = value["profile"] ?? "content"
  if (typeof profile !== "string" || !PROFILES.has(profile)) return failure("invalid_manifest", "profile", "profile is unsupported")
  const permissionsRaw = value["permissions"] ?? []
  if (!Array.isArray(permissionsRaw)) return failure("invalid_permission", "permissions", "permissions must be an array")
  const permissions: ModPermission[] = []
  for (const [index, permission] of permissionsRaw.entries()) {
    if (typeof permission !== "string" || !PERMISSIONS.has(permission) || permissions.includes(permission as ModPermission)) {
      return failure("invalid_permission", `permissions[${index}]`, "permission is unsupported or duplicated")
    }
    permissions.push(permission as ModPermission)
  }
  const github = normalizeGitHubRepository(value["github"])
  if (!github.ok) return github
  const gameVersion = value["game_version"] ?? null
  if (gameVersion !== null && (typeof gameVersion !== "string" || validRange(gameVersion) === null)) {
    return failure("invalid_manifest", "game_version", "game_version range is invalid")
  }
  const requiredImports = parseImports(value["required_imports"], "required_imports")
  if (!requiredImports.ok) return requiredImports
  const optionalImports = parseImports(value["optional_imports"], "optional_imports")
  if (!optionalImports.ok) return optionalImports
  const category = value["category"] ?? "OTHER"
  if (typeof category !== "string" || !CATEGORY_PATTERN.test(category)) return failure("invalid_manifest", "category", "category is invalid")
  const logURL = value["log_url"] ?? null
  if (logURL !== null) {
    if (typeof logURL !== "string") return failure("invalid_manifest", "log_url", "log_url must be an HTTPS URL")
    try {
      const parsed = new URL(logURL)
      if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "") throw new Error("unsafe")
    } catch {
      return failure("invalid_manifest", "log_url", "log_url must be a credential-free HTTPS URL")
    }
    if (!permissions.includes("network")) return failure("invalid_permission", "log_url", "log_url requires the network permission")
  }
  const optionalFile = (field: "options_schema" | "assets_transforms"): Result<string | null, ModManifestError> => {
    const candidate = value[field]
    return candidate === undefined || candidate === null
      ? ok(null)
      : safeRelativeFile(candidate) ? ok(candidate) : failure("unsafe_path", field, `${field} must be a safe relative file`)
  }
  const optionsSchema = optionalFile("options_schema")
  if (!optionsSchema.ok) return optionsSchema
  const assetsTransforms = optionalFile("assets_transforms")
  if (!assetsTransforms.ok) return assetsTransforms
  const affectsLinkDefault = profile !== "content"
  if (value["affects_link"] !== undefined && typeof value["affects_link"] !== "boolean") return failure("invalid_manifest", "affects_link", "affects_link must be boolean")
  if (value["experimental"] !== undefined && typeof value["experimental"] !== "boolean") return failure("invalid_manifest", "experimental", "experimental must be boolean")
  if (value["description"] !== undefined && typeof value["description"] !== "string") return failure("invalid_manifest", "description", "description must be a string")
  if (value["force_enable_env"] !== undefined
    && (typeof value["force_enable_env"] !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value["force_enable_env"]))) {
    return failure("invalid_manifest", "force_enable_env", "force_enable_env must be an environment variable name")
  }

  return ok({
    id: value["id"],
    name: value["name"],
    version: value["version"],
    api,
    entry: value["entry"] as string,
    priority: priority as number,
    games: games.value,
    dependencies: withSources(dependencies.value),
    optionalDependencies: withSources(optionalDependencies.value),
    dependencySources,
    conflicts: conflicts.value,
    category,
    gameVersion: gameVersion as string | null,
    description: (value["description"] as string | undefined) ?? "",
    github: github.value,
    experimental: value["experimental"] === true,
    profile: profile as ModProfile,
    affectsLink: typeof value["affects_link"] === "boolean" ? value["affects_link"] : affectsLinkDefault,
    permissions,
    requiredImports: requiredImports.value,
    optionalImports: optionalImports.value,
    optionsSchema: optionsSchema.value,
    assetsTransforms: assetsTransforms.value,
    logURL: logURL as string | null,
  })
}
