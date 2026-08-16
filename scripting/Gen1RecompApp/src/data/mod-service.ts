import { PRODUCT } from "../config/product"
import type {
  GitHubAvailableUpdate,
  InstalledMod,
  ModOperationStage,
  ModRegistry,
  ModSnapshot,
  NativeModPermission,
} from "../domain/mods"

export class ModServiceError extends Error {
  readonly code: "network" | "github" | "integrity" | "archive" | "manifest" | "storage" | "busy" | "not_found" | "no_update"
  readonly retryable: boolean

  public constructor(code: ModServiceError["code"], message: string, retryable = false) {
    super(message)
    this.name = "ModServiceError"
    this.code = code
    this.retryable = retryable
  }
}

type ParsedModManifest = {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly api: 1 | 2
  readonly entry: string
  readonly category: string
  readonly profile: "content" | "overhaul" | "total_conversion"
  readonly description: string
  readonly github: string | null
  readonly permissions: readonly NativeModPermission[]
  readonly conflicts: readonly string[]
  readonly dependencies: readonly string[]
  readonly optionsSchema: string | null
  readonly assetsTransforms: string | null
}

type ParsedArchive = {
  readonly rootPrefix: string
  readonly manifestPath: string
  readonly entries: readonly ArchiveEntry[]
  readonly relativeFiles: readonly string[]
}

const REGISTRY_KEYS = new Set(["schemaVersion", "mods", "updatedAt"])
const INSTALLED_MOD_KEYS = new Set([
  "id", "name", "version", "api", "entry", "category", "profile", "description",
  "github", "permissions", "conflicts", "dependencies", "packagePath", "packageSha256",
  "source", "releaseTag", "previousVersion", "enabled", "installedAt", "updatedAt",
])
const MANIFEST_KEYS = new Set([
  "id", "name", "version", "entry", "api", "priority", "games",
  "dependencies", "optional_dependencies", "dependency_sources", "conflicts", "incompatible",
  "category", "game_version", "description", "github", "experimental", "profile",
  "affects_link", "permissions", "required_imports", "optional_imports", "options_schema",
  "assets_transforms", "force_enable_env", "log_url",
])
const MOD_ID = /^[A-Za-z0-9_-]{1,64}$/
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/
const PERMISSIONS = new Set<NativeModPermission>(["network", "filesystem", "engine_internals", "steps", "background"])
const FORBIDDEN_EXTENSIONS = new Set([
  ".gb", ".gbc", ".gba", ".nds", ".n64", ".z64", ".v64",
  ".ips", ".bps", ".ups", ".xdelta", ".ppf",
  ".exe", ".dll", ".dylib", ".so", ".luac",
])
const GITHUB_REDIRECT_HOSTS = new Set([
  "github.com",
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key))
}

function safePath(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 240
    && value === value.normalize("NFC")
    && !value.startsWith("/")
    && !value.includes("\\")
    && !/[\u0000-\u001f\u007f]/.test(value)
    && value.split("/").length <= 16
    && value.split("/").every((part) => part !== "" && part !== "." && part !== "..")
}

function extension(path: string): string {
  const file = path.slice(path.lastIndexOf("/") + 1).toLowerCase()
  const dot = file.lastIndexOf(".")
  return dot < 0 ? "" : file.slice(dot)
}

function forbiddenModPath(path: string): boolean {
  const parts = path.toLowerCase().split("/")
  return parts.includes("baserom")
    || parts.includes("baseroms")
    || parts.includes("rom")
    || parts.includes("roms")
    || parts.includes(".git")
    || parts.includes(".github")
    || parts.includes(".gitignore")
    || parts.includes(".gitattributes")
    || FORBIDDEN_EXTENSIONS.has(extension(path))
}

function normalizeRepository(value: string): string {
  let candidate = value.trim()
  const url = /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(candidate)
  if (url != null) candidate = `${url[1]}/${url[2]}`
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(candidate)) {
    throw new ModServiceError("github", "Enter a GitHub repository as owner/repo.")
  }
  return candidate
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value
}

function compareVersions(left: string, right: string): number {
  const a = VERSION.exec(left)
  const b = VERSION.exec(right)
  if (a == null || b == null) throw new ModServiceError("manifest", "A mod version is not canonical semantic versioning.")
  for (const index of [1, 2, 3]) {
    const difference = Number(a[index]) - Number(b[index])
    if (difference !== 0) return difference
  }
  if (a[4] == null && b[4] != null) return 1
  if (a[4] != null && b[4] == null) return -1
  return (a[4] ?? "").localeCompare(b[4] ?? "")
}

function dependencyId(value: unknown): string {
  if (typeof value === "string") {
    const clean = value.split("#", 1)[0]!.split("@", 1)[0]!
    if (MOD_ID.test(clean)) return clean
  } else if (isRecord(value) && typeof value["id"] === "string" && MOD_ID.test(value["id"])) {
    return value["id"]
  }
  throw new ModServiceError("manifest", "A mod dependency or conflict is invalid.")
}

function parseManifest(value: unknown): ParsedModManifest {
  if (!isRecord(value) || !hasOnlyKeys(value, MANIFEST_KEYS)) throw new ModServiceError("manifest", "The mod manifest contains unsupported fields.")
  if (typeof value["id"] !== "string" || !MOD_ID.test(value["id"])) throw new ModServiceError("manifest", "The mod ID is invalid.")
  if (typeof value["name"] !== "string" || value["name"].trim().length === 0 || value["name"].length > 80) throw new ModServiceError("manifest", "The mod name is invalid.")
  if (typeof value["version"] !== "string" || VERSION.exec(value["version"]) == null) throw new ModServiceError("manifest", "The mod version is invalid.")
  const api = value["api"] ?? 1
  if (api !== 1 && api !== 2) throw new ModServiceError("manifest", "Only Gen1Recomp Mod API 1 and 2 are supported.")
  if (!safePath(value["entry"]) || !(value["entry"] as string).toLowerCase().endsWith(".lua")) throw new ModServiceError("manifest", "The mod entry must be a safe Lua path.")
  const profile = value["profile"] ?? "content"
  if (profile !== "content" && profile !== "overhaul" && profile !== "total_conversion") throw new ModServiceError("manifest", "The mod profile is unsupported.")
  const permissionsValue = value["permissions"] ?? []
  if (!Array.isArray(permissionsValue)) throw new ModServiceError("manifest", "Mod permissions must be an array.")
  const permissions: NativeModPermission[] = []
  for (const permission of permissionsValue) {
    if (typeof permission !== "string" || !PERMISSIONS.has(permission as NativeModPermission) || permissions.includes(permission as NativeModPermission)) {
      throw new ModServiceError("manifest", "The mod requests an unknown or duplicate permission.")
    }
    permissions.push(permission as NativeModPermission)
  }
  let github: string | null = null
  if (value["github"] !== undefined && value["github"] !== "") {
    if (typeof value["github"] !== "string") throw new ModServiceError("manifest", "The mod GitHub source is invalid.")
    github = normalizeRepository(value["github"])
  }
  if (value["log_url"] !== undefined) {
    if (typeof value["log_url"] !== "string" || !permissions.includes("network")) throw new ModServiceError("manifest", "A log endpoint requires the network permission.")
    try {
      const url = new URL(value["log_url"])
      if (url.protocol !== "https:" || url.username !== "" || url.password !== "") throw new Error("unsafe")
    } catch {
      throw new ModServiceError("manifest", "The mod log endpoint is not a safe HTTPS URL.")
    }
  }
  const dependenciesValue = value["dependencies"] ?? []
  const conflictsValue = [
    ...(Array.isArray(value["conflicts"]) ? value["conflicts"] : []),
    ...(Array.isArray(value["incompatible"]) ? value["incompatible"] : []),
  ]
  if (!Array.isArray(dependenciesValue)
    || (value["conflicts"] !== undefined && !Array.isArray(value["conflicts"]))
    || (value["incompatible"] !== undefined && !Array.isArray(value["incompatible"]))) {
    throw new ModServiceError("manifest", "Mod dependencies or conflicts are invalid.")
  }
  const optionalFile = (field: "options_schema" | "assets_transforms"): string | null => {
    const item = value[field]
    if (item === undefined || item === null) return null
    if (!safePath(item)) throw new ModServiceError("manifest", `${field} is not a safe relative path.`)
    return item
  }
  return {
    id: value["id"],
    name: value["name"],
    version: value["version"],
    api,
    entry: value["entry"] as string,
    category: typeof value["category"] === "string" ? value["category"] : "OTHER",
    profile,
    description: typeof value["description"] === "string" ? value["description"] : "",
    github,
    permissions,
    conflicts: [...new Set(conflictsValue.map(dependencyId))],
    dependencies: [...new Set(dependenciesValue.map(dependencyId))],
    optionsSchema: optionalFile("options_schema"),
    assetsTransforms: optionalFile("assets_transforms"),
  }
}

function parseInstalledMod(value: unknown): InstalledMod | null {
  if (!isRecord(value)
    || !hasOnlyKeys(value, INSTALLED_MOD_KEYS)
    || typeof value["id"] !== "string" || !MOD_ID.test(value["id"])
    || typeof value["name"] !== "string"
    || typeof value["version"] !== "string" || VERSION.exec(value["version"]) == null
    || (value["api"] !== 1 && value["api"] !== 2)
    || typeof value["entry"] !== "string"
    || typeof value["packagePath"] !== "string"
    || typeof value["packageSha256"] !== "string" || !/^[a-f0-9]{64}$/.test(value["packageSha256"])
    || !Array.isArray(value["permissions"]) || !Array.isArray(value["conflicts"]) || !Array.isArray(value["dependencies"])
    || (value["source"] !== "manual" && value["source"] !== "github")
    || value["enabled"] !== false
    || !canonicalTimestamp(value["installedAt"]) || !canonicalTimestamp(value["updatedAt"])) return null
  const permissions = value["permissions"]
  if (permissions.some((item) => typeof item !== "string" || !PERMISSIONS.has(item as NativeModPermission))) return null
  const profile = value["profile"]
  if (profile !== "content" && profile !== "overhaul" && profile !== "total_conversion") return null
  if (!safePath(value["entry"])
    || typeof value["category"] !== "string"
    || typeof value["description"] !== "string"
    || (value["github"] !== null && typeof value["github"] !== "string")
    || (value["releaseTag"] !== null && typeof value["releaseTag"] !== "string")
    || (value["previousVersion"] !== null
      && (typeof value["previousVersion"] !== "string" || VERSION.exec(value["previousVersion"]) == null))
    || value["conflicts"].some((item) => typeof item !== "string" || !MOD_ID.test(item))
    || value["dependencies"].some((item) => typeof item !== "string" || !MOD_ID.test(item))) return null
  if (typeof value["github"] === "string") {
    try { normalizeRepository(value["github"]) } catch { return null }
  }
  return value as InstalledMod
}

function emptyRegistry(now = new Date().toISOString()): ModRegistry {
  return { schemaVersion: 1, mods: [], updatedAt: now }
}

export class ModService {
  readonly #root = `${FileManager.appGroupDocumentsDirectory}/${PRODUCT.privateDirectoryName}/mods`
  readonly #registryPath = `${this.#root}/registry.json`
  readonly #registryBackupPath = `${this.#root}/registry.previous.json`
  #busy = false
  #updates: Readonly<Record<string, GitHubAvailableUpdate>> = {}

  public async initialize(): Promise<ModSnapshot> {
    await FileManager.createDirectory(this.#root, true)
    const registry = await this.#readRegistry()
    return { mods: registry.mods, updates: this.#updates, checkedAt: null }
  }

  public async installFromFile(
    path: string,
    onStage: (stage: ModOperationStage, label: string | null) => void,
  ): Promise<ModSnapshot> {
    const data = await FileManager.readAsData(path)
    return this.#installData(data, {
      source: "manual",
      repository: null,
      release: null,
    }, onStage)
  }

  public async installFromGitHub(
    repositoryInput: string,
    onStage: (stage: ModOperationStage, label: string | null) => void,
  ): Promise<ModSnapshot> {
    const repository = normalizeRepository(repositoryInput)
    onStage("github", repository)
    const release = await this.#fetchLatestRelease(repository, null)
    const data = await this.#downloadRelease(release, onStage)
    return this.#installData(data, {
      source: "github",
      repository,
      release,
    }, onStage)
  }

  public async checkForUpdates(
    onStage: (stage: ModOperationStage, label: string | null) => void,
  ): Promise<ModSnapshot> {
    if (this.#busy) throw new ModServiceError("busy", "Another mod operation is active.", true)
    this.#busy = true
    try {
      const registry = await this.#readRegistry()
      const updates: Record<string, GitHubAvailableUpdate> = {}
      for (const mod of registry.mods) {
        if (mod.github == null) continue
        onStage("github", mod.name)
        const release = await this.#fetchLatestRelease(mod.github, mod.id)
        if (compareVersions(release.version, mod.version) > 0) updates[mod.id] = release
      }
      this.#updates = updates
      return { mods: registry.mods, updates, checkedAt: new Date().toISOString() }
    } finally {
      this.#busy = false
    }
  }

  public async update(
    modId: string,
    onStage: (stage: ModOperationStage, label: string | null) => void,
  ): Promise<ModSnapshot> {
    const update = this.#updates[modId]
    if (update == null) throw new ModServiceError("no_update", "No checked update is available for this mod.")
    const data = await this.#downloadRelease(update, onStage)
    return this.#installData(data, {
      source: "github",
      repository: update.repository,
      release: update,
    }, onStage)
  }

  public async updateAll(
    onStage: (stage: ModOperationStage, label: string | null) => void,
  ): Promise<ModSnapshot> {
    const ids = Object.keys(this.#updates).sort()
    if (ids.length === 0) throw new ModServiceError("no_update", "No checked mod updates are available.")
    const previousRegistry = await this.#readRegistry()
    const previousUpdates = this.#updates
    let snapshot: ModSnapshot | null = null
    try {
      for (const id of ids) snapshot = await this.update(id, onStage)
      return snapshot ?? this.initialize()
    } catch (error) {
      try {
        await this.#writeRegistry(previousRegistry)
        this.#updates = previousUpdates
      } catch {
        throw new ModServiceError("storage", "Bulk mod update failed and registry rollback must be retried.", true)
      }
      throw error
    }
  }

  public async remove(modId: string): Promise<ModSnapshot> {
    if (this.#busy) throw new ModServiceError("busy", "Another mod operation is active.", true)
    this.#busy = true
    try {
      const registry = await this.#readRegistry()
      const mod = registry.mods.find(({ id }) => id === modId)
      if (mod == null) throw new ModServiceError("not_found", "The installed mod was not found.")
      const modRoot = `${this.#root}/packages/${mod.id}`
      if (await FileManager.exists(modRoot)) await FileManager.remove(modRoot)
      const next: ModRegistry = {
        schemaVersion: 1,
        mods: registry.mods.filter(({ id }) => id !== modId),
        updatedAt: new Date().toISOString(),
      }
      await this.#writeRegistry(next)
      const updates = { ...this.#updates }
      delete updates[modId]
      this.#updates = updates
      return { mods: next.mods, updates, checkedAt: null }
    } finally {
      this.#busy = false
    }
  }

  async #installData(
    data: Data,
    source: {
      readonly source: "manual" | "github"
      readonly repository: string | null
      readonly release: GitHubAvailableUpdate | null
    },
    onStage: (stage: ModOperationStage, label: string | null) => void,
  ): Promise<ModSnapshot> {
    if (this.#busy) throw new ModServiceError("busy", "Another mod operation is active.", true)
    this.#busy = true
    const transaction = `${this.#root}/staging/mod-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
    try {
      if (data.size <= 0 || data.size > PRODUCT.modArchiveMaximumBytes) throw new ModServiceError("integrity", "The mod archive exceeds its size policy.")
      onStage("integrity", null)
      const digest = Crypto.sha256(data).toHexString()
      if (source.release != null && (data.size !== source.release.assetSize || digest !== source.release.assetSha256)) {
        throw new ModServiceError("integrity", "The GitHub release asset failed size or SHA-256 verification.")
      }
      await FileManager.createDirectory(transaction, true)
      const archivePath = `${transaction}/package.zip`
      await FileManager.writeAsData(archivePath, data)
      onStage("archive", null)
      const inventory = this.#validateArchive(archivePath)
      const extracted = `${transaction}/extracted`
      await FileManager.createDirectory(extracted, true)
      await FileManager.unzip(archivePath, extracted)
      onStage("manifest", null)
      const manifestRaw: unknown = JSON.parse(await FileManager.readAsString(`${extracted}/${inventory.manifestPath}`))
      const manifest = parseManifest(manifestRaw)
      if (!inventory.relativeFiles.includes(manifest.entry)
        || (manifest.optionsSchema != null && !inventory.relativeFiles.includes(manifest.optionsSchema))
        || (manifest.assetsTransforms != null && !inventory.relativeFiles.includes(manifest.assetsTransforms))) {
        throw new ModServiceError("manifest", "The archive is missing a file declared by its manifest.")
      }
      if (source.repository != null && manifest.github?.toLowerCase() !== source.repository.toLowerCase()) {
        throw new ModServiceError("manifest", "The release manifest does not bind itself to the selected GitHub repository.")
      }
      if (source.release != null && manifest.version !== source.release.version) {
        throw new ModServiceError("manifest", "The release tag and packaged mod version do not match.")
      }
      onStage("installing", manifest.name)
      const registry = await this.#readRegistry()
      const existing = registry.mods.find(({ id }) => id === manifest.id) ?? null
      if (existing != null && compareVersions(manifest.version, existing.version) < 0) {
        throw new ModServiceError("manifest", "A manual install cannot silently downgrade an installed mod.")
      }
      const destination = `${this.#root}/packages/${manifest.id}/${manifest.version}`
      if (await FileManager.exists(destination)) await FileManager.remove(destination)
      await FileManager.createDirectory(destination, true)
      const prefix = inventory.rootPrefix === "" ? "" : `${inventory.rootPrefix}/`
      for (const entry of inventory.entries) {
        if (entry.type !== "file") continue
        const relative = entry.path.startsWith(prefix) ? entry.path.slice(prefix.length) : entry.path
        if (relative === "") continue
        const sourcePath = `${extracted}/${entry.path}`
        if (!await FileManager.isFile(sourcePath) || await FileManager.isLink(sourcePath)) throw new ModServiceError("archive", "An extracted mod file is invalid.")
        const slash = relative.lastIndexOf("/")
        if (slash >= 0) await FileManager.createDirectory(`${destination}/${relative.slice(0, slash)}`, true)
        await FileManager.copyFile(sourcePath, `${destination}/${relative}`)
      }
      onStage("registry", manifest.name)
      const now = new Date().toISOString()
      const installed: InstalledMod = {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        api: manifest.api,
        entry: manifest.entry,
        category: manifest.category,
        profile: manifest.profile,
        description: manifest.description,
        github: manifest.github,
        permissions: manifest.permissions,
        conflicts: manifest.conflicts,
        dependencies: manifest.dependencies,
        packagePath: destination,
        packageSha256: digest,
        source: source.source,
        releaseTag: source.release?.tag ?? null,
        previousVersion: existing?.version ?? null,
        // Installation never grants capabilities or activates code implicitly.
        enabled: false,
        installedAt: existing?.installedAt ?? now,
        updatedAt: now,
      }
      const nextMods = [...registry.mods.filter(({ id }) => id !== manifest.id), installed]
        .sort((left, right) => left.name.localeCompare(right.name))
      const next: ModRegistry = { schemaVersion: 1, mods: nextMods, updatedAt: now }
      await this.#writeRegistry(next)
      if (await FileManager.exists(transaction)) await FileManager.remove(transaction)
      const updates = { ...this.#updates }
      delete updates[manifest.id]
      this.#updates = updates
      return { mods: next.mods, updates, checkedAt: null }
    } catch (error) {
      try { if (await FileManager.exists(transaction)) await FileManager.remove(transaction) } catch { /* reclaim later */ }
      if (error instanceof ModServiceError) throw error
      throw new ModServiceError("storage", "The mod package could not be installed safely.", true)
    } finally {
      this.#busy = false
    }
  }

  #validateArchive(path: string): ParsedArchive {
    const archive = Archive.openForMode(path, "read")
    const entries = archive.entries()
    if (entries.length === 0 || entries.length > PRODUCT.modMaximumEntries) throw new ModServiceError("archive", "The mod archive entry count is invalid.")
    const paths = new Set<string>()
    const pathKinds = new Map<string, ArchiveEntry["type"]>()
    let total = 0
    const filePaths: string[] = []
    for (const entry of entries) {
      if (entry.type !== "file" && entry.type !== "directory" && entry.type !== "symlink") {
        throw new ModServiceError("archive", "The mod archive contains an unsupported entry type.")
      }
      const candidate = entry.type === "directory" && entry.path.endsWith("/") ? entry.path.slice(0, -1) : entry.path
      if (!safePath(candidate) || entry.type === "symlink") throw new ModServiceError("archive", "The mod archive contains an unsafe path or symbolic link.")
      const collision = candidate.toLocaleLowerCase("en-US")
      if (paths.has(collision)) throw new ModServiceError("archive", "The mod archive contains a case-insensitive path collision.")
      paths.add(collision)
      pathKinds.set(collision, entry.type)
      if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0
        || !Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0) throw new ModServiceError("archive", "The mod archive contains invalid sizes.")
      if (entry.type === "directory" && (entry.uncompressedSize !== 0 || entry.compressedSize !== 0)) {
        throw new ModServiceError("archive", "A mod archive directory has invalid data sizes.")
      }
      if (entry.type === "file") {
        const ratio = entry.compressedSize === 0 ? (entry.uncompressedSize === 0 ? 1 : Number.POSITIVE_INFINITY) : entry.uncompressedSize / entry.compressedSize
        if (ratio > 200 || entry.uncompressedSize > PRODUCT.modArchiveMaximumBytes) throw new ModServiceError("archive", "A mod archive entry exceeds its expansion policy.")
        total += entry.uncompressedSize
        if (!Number.isSafeInteger(total) || total > PRODUCT.modExpandedMaximumBytes) throw new ModServiceError("archive", "The expanded mod exceeds its size policy.")
        filePaths.push(entry.path)
      }
    }
    for (const candidate of pathKinds.keys()) {
      const components = candidate.split("/")
      for (let depth = 1; depth < components.length; depth += 1) {
        if (pathKinds.get(components.slice(0, depth).join("/")) === "file") {
          throw new ModServiceError("archive", "A mod archive file is also the parent of another entry.")
        }
      }
    }
    let rootPrefix = ""
    if (!filePaths.includes("manifest.json")) {
      const roots = new Set(filePaths.map((file) => file.includes("/") ? file.slice(0, file.indexOf("/")) : ""))
      const candidates = [...roots].filter((root) => root !== "" && filePaths.includes(`${root}/manifest.json`))
      if (roots.size !== 1 || candidates.length !== 1) throw new ModServiceError("archive", "The ZIP must contain manifest.json at root or in one top-level mod folder.")
      rootPrefix = candidates[0]!
    }
    const prefix = rootPrefix === "" ? "" : `${rootPrefix}/`
    const relativeFiles = filePaths.map((file) => file.startsWith(prefix) ? file.slice(prefix.length) : file)
    for (const relative of relativeFiles) {
      if (!safePath(relative) || forbiddenModPath(relative)) throw new ModServiceError("archive", "The mod contains ROM, patch, native executable, bytecode, repository, or baserom content.")
    }
    return {
      rootPrefix,
      manifestPath: `${prefix}manifest.json`,
      entries,
      relativeFiles,
    }
  }

  async #fetchLatestRelease(repository: string, modId: string | null): Promise<GitHubAvailableUpdate> {
    const url = `https://api.github.com/repos/${repository}/releases/latest`
    let response: Awaited<ReturnType<typeof fetch>>
    try {
      response = await fetch(url, {
        timeout: PRODUCT.networkTimeoutSeconds,
        debugLabel: `Gen1Recomp mod release ${repository}`,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": PRODUCT.githubAPIVersion,
          "User-Agent": `Gen1Recomp-Scripting/${PRODUCT.version}`,
        },
        handleRedirect: async (request) => request.url === url ? request : null,
      })
    } catch {
      throw new ModServiceError("network", "GitHub could not be reached.", true)
    }
    if (!response.ok || response.url !== url) throw new ModServiceError("github", `GitHub returned HTTP ${response.status}.`, response.status >= 500)
    const text = await response.text()
    if (text.length > 2_000_000) throw new ModServiceError("github", "The GitHub release response is unexpectedly large.")
    let value: unknown
    try { value = JSON.parse(text) } catch { throw new ModServiceError("github", "GitHub returned invalid release JSON.") }
    if (!isRecord(value) || value["draft"] === true || value["prerelease"] === true || typeof value["tag_name"] !== "string" || !Array.isArray(value["assets"])) {
      throw new ModServiceError("github", "The latest GitHub release is not an installable stable release.")
    }
    const version = value["tag_name"].replace(/^[vV]/, "")
    if (VERSION.exec(version) == null) throw new ModServiceError("github", "The GitHub release tag is not semantic versioning.")
    const zipAssets = value["assets"].filter((asset) => isRecord(asset) && typeof asset["name"] === "string" && asset["name"].toLowerCase().endsWith(".zip")) as Record<string, unknown>[]
    let asset: Record<string, unknown> | undefined
    if (modId != null) {
      asset = zipAssets.find((item) => item["name"] === `${modId}-${version}.zip`)
        ?? (zipAssets.filter((item) => (item["name"] as string).toLowerCase().startsWith(modId.toLowerCase())).length === 1
          ? zipAssets.find((item) => (item["name"] as string).toLowerCase().startsWith(modId.toLowerCase()))
          : undefined)
    }
    if (asset == null && zipAssets.length === 1) asset = zipAssets[0]
    if (asset == null) throw new ModServiceError("github", "The release has no unambiguous installable ZIP asset.")
    if (asset["state"] !== "uploaded"
      || !Number.isSafeInteger(asset["size"]) || (asset["size"] as number) <= 0 || (asset["size"] as number) > PRODUCT.modArchiveMaximumBytes
      || typeof asset["digest"] !== "string" || !/^sha256:[a-f0-9]{64}$/.test(asset["digest"])
      || typeof asset["browser_download_url"] !== "string") {
      throw new ModServiceError("github", "The release asset lacks a valid size, URL, or GitHub SHA-256 digest.")
    }
    const downloadURL = new URL(asset["browser_download_url"])
    const [owner, repo] = repository.split("/")
    if (downloadURL.protocol !== "https:" || downloadURL.hostname !== "github.com"
      || !downloadURL.pathname.toLowerCase().startsWith(`/${owner}/${repo}/releases/download/`.toLowerCase())) {
      throw new ModServiceError("github", "The release asset URL left the selected GitHub repository.")
    }
    if (!canonicalTimestamp(value["published_at"])) {
      throw new ModServiceError("github", "The GitHub release publication date is invalid.")
    }
    return {
      modId: modId ?? "",
      repository,
      version,
      tag: value["tag_name"],
      assetName: asset["name"] as string,
      assetSize: asset["size"] as number,
      assetSha256: (asset["digest"] as string).slice("sha256:".length),
      downloadURL: downloadURL.toString(),
      notes: typeof value["body"] === "string" ? value["body"].slice(0, 20_000) : "",
      publishedAt: value["published_at"],
    }
  }

  async #downloadRelease(
    release: GitHubAvailableUpdate,
    onStage: (stage: ModOperationStage, label: string | null) => void,
  ): Promise<Data> {
    onStage("download", release.repository)
    let response: Awaited<ReturnType<typeof fetch>>
    try {
      response = await fetch(release.downloadURL, {
        timeout: PRODUCT.networkTimeoutSeconds,
        debugLabel: `Gen1Recomp mod package ${release.repository}`,
        handleRedirect: async (request) => {
          try {
            const url = new URL(request.url)
            return url.protocol === "https:" && GITHUB_REDIRECT_HOSTS.has(url.hostname) ? request : null
          } catch {
            return null
          }
        },
      })
    } catch {
      throw new ModServiceError("network", "The GitHub mod package could not be downloaded.", true)
    }
    if (!response.ok) throw new ModServiceError("network", `The mod package returned HTTP ${response.status}.`, response.status >= 500)
    try {
      const finalURL = new URL(response.url)
      if (finalURL.protocol !== "https:" || !GITHUB_REDIRECT_HOSTS.has(finalURL.hostname)) {
        throw new Error("untrusted final URL")
      }
    } catch {
      throw new ModServiceError("integrity", "The mod package response ended at an untrusted host.")
    }
    if (response.expectedContentLength !== undefined && response.expectedContentLength !== release.assetSize) throw new ModServiceError("integrity", "The GitHub package size changed during download.")
    return response.data()
  }

  #parseRegistry(value: unknown): ModRegistry {
    if (!isRecord(value) || !hasOnlyKeys(value, REGISTRY_KEYS)
      || value["schemaVersion"] !== 1 || !Array.isArray(value["mods"]) || !canonicalTimestamp(value["updatedAt"])) {
      throw new ModServiceError("storage", "The mod registry has an unsupported format.")
    }
    const mods = value["mods"].map(parseInstalledMod)
    if (mods.some((mod) => mod == null)) throw new ModServiceError("storage", "The mod registry contains an invalid record.")
    const ids = new Set<string>()
    for (const mod of mods) {
      if (ids.has(mod!.id)) throw new ModServiceError("storage", "The mod registry contains duplicate IDs.")
      if (!mod!.packagePath.startsWith(`${this.#root}/packages/${mod!.id}/`)) {
        throw new ModServiceError("storage", "The mod registry contains a package path outside private mod storage.")
      }
      ids.add(mod!.id)
    }
    return { schemaVersion: 1, mods: mods as InstalledMod[], updatedAt: value["updatedAt"] }
  }

  async #readRegistry(): Promise<ModRegistry> {
    if (!await FileManager.exists(this.#registryPath)) {
      const initial = emptyRegistry()
      await this.#writeRegistry(initial)
      return initial
    }
    try {
      return this.#parseRegistry(JSON.parse(await FileManager.readAsString(this.#registryPath)))
    } catch (error) {
      if (!await FileManager.exists(this.#registryBackupPath)) {
        if (error instanceof ModServiceError) throw error
        throw new ModServiceError("storage", "The mod registry is damaged.")
      }
      try {
        const recovered = this.#parseRegistry(JSON.parse(await FileManager.readAsString(this.#registryBackupPath)))
        await FileManager.writeAsString(this.#registryPath, JSON.stringify(recovered, null, 2))
        return recovered
      } catch {
        throw new ModServiceError("storage", "The mod registry and its previous generation are damaged.")
      }
    }
  }

  async #writeRegistry(registry: ModRegistry): Promise<void> {
    await FileManager.createDirectory(this.#root, true)
    if (await FileManager.exists(this.#registryPath)) {
      if (await FileManager.exists(this.#registryBackupPath)) await FileManager.remove(this.#registryBackupPath)
      await FileManager.copyFile(this.#registryPath, this.#registryBackupPath)
    }
    await FileManager.writeAsString(this.#registryPath, JSON.stringify(registry, null, 2))
  }
}
