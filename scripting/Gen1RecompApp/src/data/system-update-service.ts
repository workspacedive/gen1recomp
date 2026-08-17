import {
  COMPONENTS,
  PRODUCT,
  PROVIDED_APIS,
  RUNTIME_SHELL_FILES,
  type ProductComponentId,
} from "../config/product"
import {
  defaultPersistentState,
  emptyUpdateSnapshot,
  type ActiveComponents,
  type CatalogDependency,
  type CatalogManifest,
  type CatalogRelease,
  type ComponentUpdateRow,
  type PersistentProductState,
  type SemanticVersion,
  type SystemCatalog,
  type UpdateMutationStage,
  type UpdateSnapshot,
} from "../domain/models"

export class UpdateServiceError extends Error {
  readonly code: "network" | "catalog" | "compatibility" | "integrity" | "archive" | "storage" | "busy" | "no_update"
  readonly retryable: boolean

  public constructor(
    code: UpdateServiceError["code"],
    message: string,
    retryable = false,
  ) {
    super(message)
    this.name = "UpdateServiceError"
    this.code = code
    this.retryable = retryable
  }
}

type UpdateJournal = {
  readonly schemaVersion: 1
  readonly transactionId: string
  readonly phase: "staging" | "activating"
  readonly previous: PersistentProductState
  readonly transactionRoot: string
}

const COMPONENT_BY_ID: Readonly<Record<ProductComponentId, typeof COMPONENTS.runtime | typeof COMPONENTS.core>> = {
  [COMPONENTS.runtime.id]: COMPONENTS.runtime,
  [COMPONENTS.core.id]: COMPONENTS.core,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = new Set(allowed)
  return Object.keys(value).every((key) => keys.has(key))
}

function parseVersion(value: string): SemanticVersion | null {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value)
  if (match == null) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  return Number.isSafeInteger(major) && Number.isSafeInteger(minor) && Number.isSafeInteger(patch)
    ? { major, minor, patch }
    : null
}

function compareVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (a == null || b == null) throw new UpdateServiceError("catalog", "The catalog contains an invalid component version.")
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

function satisfies(version: string, range: string): boolean {
  const candidate = parseVersion(version)
  if (candidate == null) return false
  const exact = parseVersion(range)
  if (exact != null) return compareVersions(version, range) === 0
  const caret = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range)
  if (caret != null) {
    const minimum = `${caret[1]}.${caret[2]}.${caret[3]}`
    if (compareVersions(version, minimum) < 0) return false
    const major = Number(caret[1])
    const minor = Number(caret[2])
    if (major > 0) return candidate.major === major
    if (minor > 0) return candidate.major === 0 && candidate.minor === minor
    return candidate.major === 0 && candidate.minor === 0 && candidate.patch === Number(caret[3])
  }
  const wildcard = /^(\d+)\.(\d+)\.x$/.exec(range)
  return wildcard != null && candidate.major === Number(wildcard[1]) && candidate.minor === Number(wildcard[2])
}

function isComponentId(value: unknown): value is ProductComponentId {
  return value === COMPONENTS.runtime.id || value === COMPONENTS.core.id
}

function safeRelativePath(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 240
    && !value.startsWith("/")
    && !value.includes("\\")
    && value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..")
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value
}

function parseDependency(value: unknown): CatalogDependency {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ["id", "range", "optional"])
    || !isComponentId(value["id"])
    || typeof value["range"] !== "string") {
    throw new UpdateServiceError("catalog", "A component dependency is invalid.")
  }
  if (parseVersion(value["range"]) == null
    && !/^\^\d+\.\d+\.\d+$/.test(value["range"])
    && !/^\d+\.\d+\.x$/.test(value["range"])) {
    throw new UpdateServiceError("catalog", "The catalog uses an unsupported dependency range.")
  }
  if (value["optional"] !== undefined && typeof value["optional"] !== "boolean") {
    throw new UpdateServiceError("catalog", "A component dependency flag is invalid.")
  }
  return { id: value["id"], range: value["range"], optional: value["optional"] === true }
}

function parseManifest(value: unknown): CatalogManifest {
  if (!isRecord(value)
    || !hasOnlyKeys(value, [
      "schemaVersion", "id", "kind", "version", "apiVersion", "artifact",
      "dependencies", "compatibility", "capabilities", "migrations", "selfTests",
    ])
    || value["schemaVersion"] !== 1
    || !isComponentId(value["id"])
    || typeof value["version"] !== "string"
    || parseVersion(value["version"]) == null
    || typeof value["apiVersion"] !== "string"
    || parseVersion(value["apiVersion"]) == null
    || !isRecord(value["artifact"])
    || !hasOnlyKeys(value["artifact"], ["path", "size", "integrity"])
    || !safeRelativePath(value["artifact"]["path"])
    || !Number.isSafeInteger(value["artifact"]["size"])
    || (value["artifact"]["size"] as number) <= 0
    || !isRecord(value["artifact"]["integrity"])
    || !hasOnlyKeys(value["artifact"]["integrity"], ["algorithm", "digest"])
    || value["artifact"]["integrity"]["algorithm"] !== "sha256"
    || typeof value["artifact"]["integrity"]["digest"] !== "string"
    || !/^[a-f0-9]{64}$/.test(value["artifact"]["integrity"]["digest"] as string)
    || !Array.isArray(value["dependencies"])
    || !isRecord(value["compatibility"])
    || !Array.isArray(value["capabilities"])
    || value["capabilities"].length !== 0
    || !Array.isArray(value["migrations"])
    || value["migrations"].length !== 0
    || !Array.isArray(value["selfTests"])
    || value["selfTests"].length !== 0) {
    throw new UpdateServiceError("catalog", "A component manifest is invalid.")
  }
  const expected = COMPONENT_BY_ID[value["id"]]
  if (value["kind"] !== expected.kind) {
    throw new UpdateServiceError("catalog", "The catalog mixes an unexpected component kind.")
  }
  const compatibility: Record<string, string> = {}
  for (const [api, range] of Object.entries(value["compatibility"])) {
    if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(api) || typeof range !== "string") {
      throw new UpdateServiceError("catalog", "A compatibility requirement is invalid.")
    }
    compatibility[api] = range
  }
  return {
    id: value["id"],
    kind: value["kind"] as "runtime" | "core",
    version: value["version"],
    artifact: {
      path: value["artifact"]["path"],
      size: value["artifact"]["size"] as number,
      sha256: value["artifact"]["integrity"]["digest"] as string,
    },
    dependencies: value["dependencies"].map(parseDependency),
    compatibility,
  }
}

function parseCatalog(value: unknown, minimumSequence: number): SystemCatalog {
  if (!isRecord(value)
    || !hasOnlyKeys(value, [
      "schemaVersion", "catalogId", "domain", "channel", "sequence",
      "generatedAt", "artifactBaseURL", "releases",
    ])
    || value["schemaVersion"] !== 1
    || value["catalogId"] !== PRODUCT.systemCatalogId
    || value["domain"] !== "system"
    || value["channel"] !== "stable"
    || !Number.isSafeInteger(value["sequence"])
    || (value["sequence"] as number) < Math.max(1, minimumSequence)
    || !canonicalTimestamp(value["generatedAt"])
    || value["artifactBaseURL"] !== PRODUCT.artifactBaseURL
    || !Array.isArray(value["releases"])) {
    throw new UpdateServiceError("catalog", "The system update catalog failed its trust policy.")
  }
  const releases: CatalogRelease[] = []
  const identities = new Set<string>()
  for (const candidate of value["releases"]) {
    if (!isRecord(candidate)
      || !hasOnlyKeys(candidate, ["manifest", "publishedAt", "notes"])
      || !canonicalTimestamp(candidate["publishedAt"])
      || !isRecord(candidate["notes"])
      || !hasOnlyKeys(candidate["notes"], ["en", "de"])
      || typeof candidate["notes"]["en"] !== "string"
      || candidate["notes"]["en"].trim().length === 0) {
      throw new UpdateServiceError("catalog", "A catalog release is invalid.")
    }
    const manifest = parseManifest(candidate["manifest"])
    const identity = `${manifest.id}@${manifest.version}`
    if (identities.has(identity)) throw new UpdateServiceError("catalog", "The catalog contains a duplicate release.")
    identities.add(identity)
    const de = candidate["notes"]["de"]
    if (de !== undefined && typeof de !== "string") throw new UpdateServiceError("catalog", "Localized release notes are invalid.")
    releases.push({
      manifest,
      publishedAt: candidate["publishedAt"],
      notes: de === undefined
        ? { en: candidate["notes"]["en"] }
        : { en: candidate["notes"]["en"], de },
    })
  }
  return {
    id: PRODUCT.systemCatalogId,
    sequence: value["sequence"] as number,
    generatedAt: value["generatedAt"],
    artifactBaseURL: PRODUCT.artifactBaseURL,
    releases,
  }
}

function parseActive(value: unknown): ActiveComponents | null {
  if (!isRecord(value)
    || !hasOnlyKeys(value, [COMPONENTS.runtime.id, COMPONENTS.core.id])
    || typeof value[COMPONENTS.runtime.id] !== "string"
    || typeof value[COMPONENTS.core.id] !== "string"
    || parseVersion(value[COMPONENTS.runtime.id] as string) == null
    || parseVersion(value[COMPONENTS.core.id] as string) == null) return null
  return {
    [COMPONENTS.runtime.id]: value[COMPONENTS.runtime.id] as string,
    [COMPONENTS.core.id]: value[COMPONENTS.core.id] as string,
  }
}

function parsePersistentState(value: unknown): PersistentProductState | null {
  if (!isRecord(value)
    || !hasOnlyKeys(value, [
      "schemaVersion", "active", "knownGood", "previous", "activeRuntimeRoot",
      "knownGoodRuntimeRoot", "previousRuntimeRoot", "acceptedCatalogSequence", "updatedAt",
    ])
    || value["schemaVersion"] !== 1) return null
  const active = parseActive(value["active"])
  const knownGood = parseActive(value["knownGood"])
  const previous = value["previous"] === null ? null : parseActive(value["previous"])
  if (active == null || knownGood == null || (value["previous"] !== null && previous == null)) return null
  for (const key of ["activeRuntimeRoot", "knownGoodRuntimeRoot", "previousRuntimeRoot"] as const) {
    if (value[key] !== null && typeof value[key] !== "string") return null
  }
  if (!Number.isSafeInteger(value["acceptedCatalogSequence"]) || (value["acceptedCatalogSequence"] as number) < 0 || !canonicalTimestamp(value["updatedAt"])) return null
  return {
    schemaVersion: 1,
    active,
    knownGood,
    previous,
    activeRuntimeRoot: value["activeRuntimeRoot"] as string | null,
    knownGoodRuntimeRoot: value["knownGoodRuntimeRoot"] as string | null,
    previousRuntimeRoot: value["previousRuntimeRoot"] as string | null,
    acceptedCatalogSequence: value["acceptedCatalogSequence"] as number,
    updatedAt: value["updatedAt"],
  }
}

function latestRelease(catalog: SystemCatalog, id: ProductComponentId): CatalogRelease | null {
  let latest: CatalogRelease | null = null
  for (const release of catalog.releases) {
    if (release.manifest.id === id && (latest == null || compareVersions(release.manifest.version, latest.manifest.version) > 0)) latest = release
  }
  return latest
}

function exactRelease(catalog: SystemCatalog, id: ProductComponentId, version: string): CatalogRelease | null {
  return catalog.releases.find((release) => release.manifest.id === id && release.manifest.version === version) ?? null
}

function snapshot(catalog: SystemCatalog, state: PersistentProductState): UpdateSnapshot {
  const rows: ComponentUpdateRow[] = []
  for (const id of [COMPONENTS.runtime.id, COMPONENTS.core.id] as const) {
    const latest = latestRelease(catalog, id)
    if (latest == null) throw new UpdateServiceError("catalog", `The catalog is missing ${id}.`)
    const installedVersion = state.active[id]
    rows.push({
      id,
      label: COMPONENT_BY_ID[id].label,
      installedVersion,
      availableVersion: latest.manifest.version,
      release: latest,
      updateAvailable: compareVersions(latest.manifest.version, installedVersion) > 0,
    })
  }
  return { components: rows, checkedAt: new Date().toISOString(), catalogSequence: catalog.sequence }
}

function compatibilitySatisfied(manifest: CatalogManifest): boolean {
  return Object.entries(manifest.compatibility).every(([api, range]) => {
    const provided = PROVIDED_APIS[api]
    return provided !== undefined && satisfies(provided, range)
  })
}

export class SystemUpdateService {
  readonly #privateRoot = `${FileManager.appGroupDocumentsDirectory}/${PRODUCT.privateDirectoryName}`
  readonly #statePath = `${this.#privateRoot}/state/product-state.json`
  readonly #journalPath = `${this.#privateRoot}/state/update-journal.json`
  #busy = false
  #catalog: SystemCatalog | null = null

  public async initialize(): Promise<{ state: PersistentProductState; snapshot: UpdateSnapshot }> {
    await FileManager.createDirectory(`${this.#privateRoot}/state`, true)
    await this.#recoverInterruptedUpdate()
    const state = await this.loadState()
    return { state, snapshot: emptyUpdateSnapshot(state) }
  }

  public async loadState(): Promise<PersistentProductState> {
    if (!await FileManager.exists(this.#statePath)) {
      const initial = defaultPersistentState(new Date().toISOString())
      await this.#writeState(initial)
      return initial
    }
    const parsed = parsePersistentState(JSON.parse(await FileManager.readAsString(this.#statePath)))
    if (parsed == null) throw new UpdateServiceError("storage", "The component state is damaged. Recovery is required.")
    return parsed
  }

  public async check(): Promise<UpdateSnapshot> {
    if (this.#busy) throw new UpdateServiceError("busy", "Another update operation is already running.", true)
    this.#busy = true
    try {
      const state = await this.loadState()
      const response = await fetch(PRODUCT.systemCatalogURL, {
        timeout: PRODUCT.networkTimeoutSeconds,
        debugLabel: "Gen1Recomp system update catalog",
        handleRedirect: async (request) => request.url === PRODUCT.systemCatalogURL ? request : null,
      })
      if (!response.ok || response.url !== PRODUCT.systemCatalogURL) {
        throw new UpdateServiceError("network", `The update catalog returned HTTP ${response.status}.`, true)
      }
      if (response.expectedContentLength !== undefined && response.expectedContentLength > PRODUCT.catalogMaximumCharacters) {
        throw new UpdateServiceError("catalog", "The update catalog is unexpectedly large.")
      }
      const text = await response.text()
      if (text.length > PRODUCT.catalogMaximumCharacters) throw new UpdateServiceError("catalog", "The update catalog is unexpectedly large.")
      let decoded: unknown
      try {
        decoded = JSON.parse(text)
      } catch {
        throw new UpdateServiceError("catalog", "The update catalog is not valid JSON.")
      }
      const catalog = parseCatalog(decoded, state.acceptedCatalogSequence)
      this.#catalog = catalog
      if (catalog.sequence > state.acceptedCatalogSequence) {
        await this.#writeState({ ...state, acceptedCatalogSequence: catalog.sequence, updatedAt: new Date().toISOString() })
      }
      return snapshot(catalog, { ...state, acceptedCatalogSequence: Math.max(state.acceptedCatalogSequence, catalog.sequence) })
    } catch (error) {
      if (error instanceof UpdateServiceError) throw error
      throw new UpdateServiceError("network", "The update catalog could not be loaded.", true)
    } finally {
      this.#busy = false
    }
  }

  public async importComponentPackage(
    path: string,
    onStage: (stage: UpdateMutationStage, componentLabel: string | null) => void,
  ): Promise<UpdateSnapshot> {
    if (this.#busy) throw new UpdateServiceError("busy", "Another update operation is already running.", true)
    if (this.#catalog == null) throw new UpdateServiceError("catalog", "Check for updates before importing a component package.", true)
    const data = await FileManager.readAsData(path)
    if (data.size <= 0 || data.size > PRODUCT.artifactMaximumBytes) {
      throw new UpdateServiceError("integrity", "The selected component package exceeds its size policy.")
    }
    const digest = Crypto.sha256(data).toHexString()
    const release = this.#catalog.releases.find(({ manifest }) =>
      manifest.artifact.size === data.size && manifest.artifact.sha256 === digest,
    )
    if (release == null) {
      throw new UpdateServiceError("integrity", "The selected package is not present in the trusted system catalog.")
    }
    const identity = `${release.manifest.id}@${release.manifest.version}`
    return this.install(
      [release.manifest.id],
      onStage,
      new Map([[identity, data]]),
    )
  }

  public async install(
    requested: readonly ProductComponentId[],
    onStage: (stage: UpdateMutationStage, componentLabel: string | null) => void,
    localPackages: ReadonlyMap<string, Data> = new Map(),
  ): Promise<UpdateSnapshot> {
    if (this.#busy) throw new UpdateServiceError("busy", "Another update operation is already running.", true)
    if (this.#catalog == null) throw new UpdateServiceError("catalog", "Check for updates before installing.", true)
    this.#busy = true
    const catalog = this.#catalog
    const transactionId = `manual-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
    const transactionRoot = `${this.#privateRoot}/staging/${transactionId}`
    let previous: PersistentProductState | null = null
    try {
      onStage("planning", null)
      previous = await this.loadState()
      if (await FileManager.exists(this.#journalPath)) {
        throw new UpdateServiceError("busy", "An update recovery transaction is already active.", true)
      }
      const candidate: Record<ProductComponentId, string> = { ...previous.active }
      const selected = new Map<ProductComponentId, CatalogRelease>()
      const resolving = new Set<ProductComponentId>()
      const addRelease = (release: CatalogRelease): void => {
        if (!compatibilitySatisfied(release.manifest)) {
          throw new UpdateServiceError("compatibility", `${COMPONENT_BY_ID[release.manifest.id].label} is not compatible with this host.`)
        }
        const existing = selected.get(release.manifest.id)
        if (existing != null) {
          if (resolving.has(release.manifest.id)) {
            throw new UpdateServiceError("compatibility", "The component dependency graph contains a cycle.")
          }
          if (existing.manifest.version !== release.manifest.version) {
            throw new UpdateServiceError("compatibility", "The selected component dependencies conflict.")
          }
          return
        }
        if (resolving.has(release.manifest.id)) {
          throw new UpdateServiceError("compatibility", "The component dependency graph contains a cycle.")
        }
        resolving.add(release.manifest.id)
        selected.set(release.manifest.id, release)
        candidate[release.manifest.id] = release.manifest.version
        for (const dependency of release.manifest.dependencies) {
          if (dependency.optional) continue
          const activeVersion = candidate[dependency.id]
          if (satisfies(activeVersion, dependency.range)) continue
          const options = catalog.releases
            .filter((item) => item.manifest.id === dependency.id && satisfies(item.manifest.version, dependency.range))
            .sort((a, b) => compareVersions(b.manifest.version, a.manifest.version))
          const target = options[0]
          if (target == null || compareVersions(target.manifest.version, previous!.active[dependency.id]) < 0) {
            throw new UpdateServiceError("compatibility", `No safe dependency version is available for ${dependency.id}.`)
          }
          addRelease(target)
        }
        resolving.delete(release.manifest.id)
      }
      for (const id of [...new Set(requested)]) {
        const localIdentity = [...localPackages.keys()].find((identity) => identity.startsWith(`${id}@`))
        const release = localIdentity === undefined
          ? latestRelease(catalog, id)
          : exactRelease(catalog, id, localIdentity.slice(`${id}@`.length))
        if (release == null) {
          throw new UpdateServiceError("no_update", `No ${COMPONENT_BY_ID[id].label} package is available.`)
        }
        const identity = `${release.manifest.id}@${release.manifest.version}`
        const isTrustedManualReinstall = localPackages.has(identity)
          && release.manifest.version === previous.active[id]
        if (compareVersions(release.manifest.version, previous.active[id]) <= 0 && !isTrustedManualReinstall) {
          throw new UpdateServiceError("no_update", `No newer ${COMPONENT_BY_ID[id].label} version is available.`)
        }
        addRelease(release)
      }

      // Materializing a complete game runtime needs both active component generations locally.
      const required = new Map<ProductComponentId, CatalogRelease>(selected)
      for (const id of [COMPONENTS.runtime.id, COMPONENTS.core.id] as const) {
        const release = exactRelease(catalog, id, candidate[id])
        if (release == null) throw new UpdateServiceError("catalog", `The catalog does not retain ${id}@${candidate[id]}.`)
        if (!await this.#componentIsLocal(release)) required.set(id, release)
      }

      await FileManager.createDirectory(transactionRoot, true)
      await this.#writeJournal({ schemaVersion: 1, transactionId, phase: "staging", previous, transactionRoot })
      for (const release of required.values()) {
        const identity = `${release.manifest.id}@${release.manifest.version}`
        await this.#stagePackage(
          transactionRoot,
          catalog,
          release,
          onStage,
          localPackages.get(identity) ?? null,
        )
      }
      onStage("staging", null)
      const runtimeRoot = await this.#materializeRuntime(transactionRoot, candidate)
      await this.#writeJournal({ schemaVersion: 1, transactionId, phase: "activating", previous, transactionRoot })
      onStage("activation", null)
      const activating: PersistentProductState = {
        ...previous,
        active: candidate,
        previous: previous.active,
        previousRuntimeRoot: previous.activeRuntimeRoot,
        activeRuntimeRoot: runtimeRoot,
        updatedAt: new Date().toISOString(),
      }
      await this.#writeState(activating)
      onStage("health", null)
      await this.#healthCheckRuntime(runtimeRoot)
      const committed: PersistentProductState = {
        ...activating,
        knownGood: candidate,
        knownGoodRuntimeRoot: runtimeRoot,
        updatedAt: new Date().toISOString(),
      }
      await this.#writeState(committed)
      await FileManager.remove(this.#journalPath)
      if (await FileManager.exists(transactionRoot)) await FileManager.remove(transactionRoot)
      return snapshot(catalog, committed)
    } catch (error) {
      let restored = previous == null
      if (previous != null) {
        try {
          await this.#writeState(previous)
          restored = true
        } catch {
          // Keep the journal: removing it here would destroy the only automatic recovery record.
        }
      }
      if (restored) {
        try {
          if (await FileManager.exists(this.#journalPath)) await FileManager.remove(this.#journalPath)
          if (await FileManager.exists(transactionRoot)) await FileManager.remove(transactionRoot)
        } catch { /* Maintenance can reclaim stale staging. */ }
      } else {
        throw new UpdateServiceError("storage", "The update failed and automatic state restoration must be retried.", true)
      }
      if (error instanceof UpdateServiceError) throw error
      throw new UpdateServiceError("storage", "The component update could not be staged safely.", true)
    } finally {
      this.#busy = false
    }
  }

  public async rollbackAfterRuntimeFailure(): Promise<void> {
    const state = await this.loadState()
    if (state.previous == null) return
    await this.#writeState({
      ...state,
      active: state.previous,
      knownGood: state.previous,
      activeRuntimeRoot: state.previousRuntimeRoot,
      knownGoodRuntimeRoot: state.previousRuntimeRoot,
      previous: null,
      previousRuntimeRoot: null,
      updatedAt: new Date().toISOString(),
    })
  }

  async #stagePackage(
    transactionRoot: string,
    catalog: SystemCatalog,
    release: CatalogRelease,
    onStage: (stage: UpdateMutationStage, componentLabel: string | null) => void,
    providedData: Data | null,
  ): Promise<void> {
    const label = COMPONENT_BY_ID[release.manifest.id].label
    let data: Data
    if (providedData == null) {
      onStage("download", label)
      const url = `${catalog.artifactBaseURL}${release.manifest.artifact.path}`
      if (!url.startsWith(PRODUCT.artifactBaseURL)) throw new UpdateServiceError("catalog", "A package URL left the trusted update path.")
      const response = await fetch(url, {
        timeout: PRODUCT.networkTimeoutSeconds,
        debugLabel: `Gen1Recomp ${release.manifest.id}`,
        handleRedirect: async (request) => request.url.startsWith(PRODUCT.artifactBaseURL) ? request : null,
      })
      if (!response.ok || !response.url.startsWith(PRODUCT.artifactBaseURL)) throw new UpdateServiceError("network", `The package returned HTTP ${response.status}.`, true)
      if (release.manifest.artifact.size > PRODUCT.artifactMaximumBytes
        || (response.expectedContentLength !== undefined && response.expectedContentLength !== release.manifest.artifact.size)) {
        throw new UpdateServiceError("integrity", "The package size does not match its manifest.")
      }
      data = await response.data()
    } else {
      data = providedData
    }
    if (data.size !== release.manifest.artifact.size) throw new UpdateServiceError("integrity", "The downloaded package has the wrong size.")
    onStage("integrity", label)
    if (Crypto.sha256(data).toHexString() !== release.manifest.artifact.sha256) {
      throw new UpdateServiceError("integrity", "The downloaded package failed SHA-256 verification.")
    }
    const archivePath = `${transactionRoot}/${release.manifest.id}-${release.manifest.version}.zip`
    await FileManager.writeAsData(archivePath, data)
    onStage("archive", label)
    const archive = Archive.openForMode(archivePath, "read")
    const entries = archive.entries()
    const expectedFiles = new Set<string>(COMPONENT_BY_ID[release.manifest.id].files)
    if (entries.length !== expectedFiles.size) throw new UpdateServiceError("archive", "The package contains an unexpected number of entries.")
    let total = 0
    for (const entry of entries) {
      if (entry.type !== "file" || !safeRelativePath(entry.path) || !expectedFiles.has(entry.path)) {
        throw new UpdateServiceError("archive", "The package contains an unsafe or unexpected entry.")
      }
      if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 || entry.uncompressedSize > PRODUCT.artifactMaximumBytes) {
        throw new UpdateServiceError("archive", "A package entry exceeds its size policy.")
      }
      const ratio = entry.compressedSize === 0 ? (entry.uncompressedSize === 0 ? 1 : Number.POSITIVE_INFINITY) : entry.uncompressedSize / entry.compressedSize
      if (ratio > 200) throw new UpdateServiceError("archive", "A package entry exceeds its expansion policy.")
      total += entry.uncompressedSize
      if (total > PRODUCT.artifactMaximumBytes) throw new UpdateServiceError("archive", "The expanded package exceeds its size policy.")
    }
    const extracted = `${transactionRoot}/extracted/${release.manifest.id}/${release.manifest.version}`
    await FileManager.createDirectory(extracted, true)
    await FileManager.unzip(archivePath, extracted)
    const destination = this.#componentDirectory(release.manifest.id, release.manifest.version)
    if (await FileManager.exists(destination)) await FileManager.remove(destination)
    await FileManager.createDirectory(destination, true)
    for (const file of expectedFiles) {
      const source = `${extracted}/${file}`
      if (!await FileManager.isFile(source) || await FileManager.isLink(source)) throw new UpdateServiceError("archive", "An extracted component file is invalid.")
      const slash = file.lastIndexOf("/")
      if (slash >= 0) await FileManager.createDirectory(`${destination}/${file.slice(0, slash)}`, true)
      await FileManager.copyFile(source, `${destination}/${file}`)
    }
  }

  async #componentIsLocal(release: CatalogRelease): Promise<boolean> {
    const root = this.#componentDirectory(release.manifest.id, release.manifest.version)
    for (const file of COMPONENT_BY_ID[release.manifest.id].files) {
      if (!await FileManager.isFile(`${root}/${file}`)) return false
    }
    return true
  }

  #componentDirectory(id: ProductComponentId, version: string): string {
    return `${this.#privateRoot}/components/${id}/${version}`
  }

  async #materializeRuntime(transactionRoot: string, active: ActiveComponents): Promise<string> {
    const name = `runtime-v047-r${active[COMPONENTS.runtime.id]}-c${active[COMPONENTS.core.id]}`
    const destination = `${this.#privateRoot}/runtimes/${name}`
    if (await FileManager.exists(destination)) {
      try {
        await this.#healthCheckRuntime(destination)
        return destination
      } catch {
        await FileManager.remove(destination)
      }
    }
    const staging = `${transactionRoot}/runtime`
    await FileManager.createDirectory(staging, true)
    const project = `${FileManager.scriptsDirectory}/${PRODUCT.projectDirectoryName}`
    const shell = `${project}/${PRODUCT.runtimeShellDirectory}`
    for (const file of RUNTIME_SHELL_FILES) {
      await FileManager.copyFile(`${shell}/${file}`, `${staging}/${file}`)
    }
    const runtime = this.#componentDirectory(COMPONENTS.runtime.id, active[COMPONENTS.runtime.id])
    await FileManager.createDirectory(`${staging}/11.5`, true)
    await FileManager.copyFile(`${runtime}/player.js`, `${staging}/player.js`)
    await FileManager.copyFile(`${runtime}/11.5/love.js`, `${staging}/11.5/love.js`)

    const core = this.#componentDirectory(COMPONENTS.core.id, active[COMPONENTS.core.id])
    const packages: Record<string, string> = {}
    for (const [name, path] of [
      ["gen1recomp.love", `${core}/gen1recomp.love`],
      ["lua/normalize1.lua", `${runtime}/lua/normalize1.lua`],
      ["lua/normalize2.lua", `${runtime}/lua/normalize2.lua`],
      ["11.5/love.wasm", `${runtime}/11.5/love.wasm`],
    ] as const) {
      packages[name] = (await FileManager.readAsData(path)).toBase64String()
    }
    await FileManager.writeAsString(
      `${staging}/embedded-packages.js`,
      `window.__gen1recompEmbeddedPackages = Object.freeze(${JSON.stringify(packages)});\n`,
    )
    await FileManager.createDirectory(`${destination}/11.5`, true)
    for (const file of RUNTIME_SHELL_FILES) {
      await FileManager.copyFile(`${staging}/${file}`, `${destination}/${file}`)
    }
    await FileManager.copyFile(`${staging}/embedded-packages.js`, `${destination}/embedded-packages.js`)
    await FileManager.copyFile(`${staging}/player.js`, `${destination}/player.js`)
    await FileManager.copyFile(`${staging}/11.5/love.js`, `${destination}/11.5/love.js`)
    return destination
  }

  async #healthCheckRuntime(root: string): Promise<void> {
    for (const file of [...RUNTIME_SHELL_FILES, "embedded-packages.js", "player.js", "11.5/love.js"]) {
      if (!await FileManager.isFile(`${root}/${file}`)) throw new UpdateServiceError("storage", "The activated runtime is incomplete.")
    }
  }

  async #recoverInterruptedUpdate(): Promise<void> {
    if (!await FileManager.exists(this.#journalPath)) return
    try {
      const value: unknown = JSON.parse(await FileManager.readAsString(this.#journalPath))
      if (!isRecord(value) || value["schemaVersion"] !== 1 || !isRecord(value["previous"]) || typeof value["transactionRoot"] !== "string") {
        throw new Error("invalid update journal")
      }
      const previous = parsePersistentState(value["previous"])
      if (previous == null) throw new Error("invalid previous state")
      await this.#writeState(previous)
      if (await FileManager.exists(value["transactionRoot"])) await FileManager.remove(value["transactionRoot"])
      await FileManager.remove(this.#journalPath)
    } catch {
      throw new UpdateServiceError("storage", "An interrupted update could not be recovered automatically.")
    }
  }

  async #writeJournal(journal: UpdateJournal): Promise<void> {
    await FileManager.writeAsString(this.#journalPath, JSON.stringify(journal, null, 2))
  }

  async #writeState(state: PersistentProductState): Promise<void> {
    await FileManager.createDirectory(`${this.#privateRoot}/state`, true)
    await FileManager.writeAsString(this.#statePath, JSON.stringify(state, null, 2))
  }
}
