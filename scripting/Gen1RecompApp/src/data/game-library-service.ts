import { PRODUCT } from "../config/product"
import {
  GAME_CATALOG,
  GAME_ORDER,
  compareSaveSlots,
  emptyGameRegistry,
  identifyCanonicalRom,
  parseGameRegistry,
  pendingGame,
  replaceGame,
  type GameId,
  type GameRegistry,
  type InstalledGame,
  type SaveSlotSummary,
} from "../domain/games"

export type RomImportStage = "reading" | "identity" | "staging" | "registry"

export type GameLibrarySnapshot = {
  readonly games: readonly InstalledGame[]
  readonly updatedAt: string
}

export class GameLibraryError extends Error {
  public constructor(
    public readonly code: "busy" | "file" | "size" | "identity" | "storage" | "registry",
    message: string,
    public readonly retryable = false,
  ) {
    super(message)
    this.name = "GameLibraryError"
  }
}

type ImportJournal = {
  readonly schemaVersion: 1
  readonly operation: "import"
  readonly gameId: GameId
  readonly sha1: string
  readonly createdAt: string
}

function now(): string {
  return new Date().toISOString()
}

function snapshot(registry: GameRegistry): GameLibrarySnapshot {
  return { games: registry.games, updatedAt: registry.updatedAt }
}

export class GameLibraryService {
  readonly #privateRoot = `${FileManager.appGroupDocumentsDirectory}/${PRODUCT.privateDirectoryName}`
  readonly #libraryRoot = `${this.#privateRoot}/library`
  readonly #stateRoot = `${this.#libraryRoot}/state`
  readonly #sourceRoot = `${this.#libraryRoot}/pending-sources`
  readonly #stagingRoot = `${this.#libraryRoot}/staging`
  readonly #registryPath = `${this.#stateRoot}/game-registry.json`
  readonly #registryBackupPath = `${this.#stateRoot}/game-registry.backup.json`
  readonly #journalPath = `${this.#stateRoot}/import-journal.json`
  #busy = false

  public async initialize(): Promise<GameLibrarySnapshot> {
    await this.#ensureDirectories()
    let registry = await this.#loadRegistry()
    let changed = false

    for (const id of GAME_ORDER) {
      const source = this.#sourcePath(id)
      const game = registry.games.find((candidate) => candidate.id === id)
      const sourceExists = await FileManager.exists(source)
      if (game?.status === "pendingExtraction") {
        if (!sourceExists || !await this.#sourceMatches(id, source)) {
          const updatedAt = now()
          registry = replaceGame(registry, {
            ...game,
            status: "needsReimport",
            retainedSource: false,
            updatedAt,
          }, updatedAt)
          if (sourceExists) await FileManager.remove(source)
          changed = true
        }
      } else if (sourceExists) {
        await FileManager.remove(source)
      }
    }

    if (await FileManager.exists(this.#journalPath)) await FileManager.remove(this.#journalPath)
    for (const id of GAME_ORDER) {
      const staging = this.#stagingPath(id)
      if (await FileManager.exists(staging)) await FileManager.remove(staging)
    }
    if (changed) await this.#writeRegistry(registry)
    return snapshot(registry)
  }

  public async importRom(
    path: string,
    onStage?: (stage: RomImportStage) => void,
  ): Promise<{ readonly game: InstalledGame; readonly snapshot: GameLibrarySnapshot }> {
    if (this.#busy) throw new GameLibraryError("busy", "Another library operation is already running.", true)
    this.#busy = true
    let stagedPath: string | null = null
    try {
      await this.#ensureDirectories()
      onStage?.("reading")
      let data: Data
      try {
        data = await FileManager.readAsData(path)
      } catch {
        throw new GameLibraryError("file", "The selected file could not be read.", true)
      }

      onStage?.("identity")
      const possibleSize = GAME_ORDER.some((id) => GAME_CATALOG[id].romSize === data.size)
      if (!possibleSize) {
        throw new GameLibraryError("size", "Expected an exact 1 MiB Red/Blue/Yellow dump or exact 2 MiB Gold dump.")
      }
      const sha1 = Crypto.sha1(data).toHexString().toLowerCase()
      const identification = identifyCanonicalRom(data.size, sha1)
      if (!identification.ok) {
        throw new GameLibraryError(
          "identity",
          "Unsupported ROM. Choose a clean, unmodified canonical US Pokémon Red, Blue, Yellow, or Gold dump.",
        )
      }
      const identity = identification.game
      stagedPath = this.#stagingPath(identity.id)
      if (await FileManager.exists(stagedPath)) await FileManager.remove(stagedPath)

      onStage?.("staging")
      await FileManager.writeAsData(stagedPath, data)
      if (!await this.#sourceMatches(identity.id, stagedPath)) {
        throw new GameLibraryError("storage", "The private staging copy failed verification.", true)
      }
      const journal: ImportJournal = {
        schemaVersion: 1,
        operation: "import",
        gameId: identity.id,
        sha1: identity.romSha1,
        createdAt: now(),
      }
      await FileManager.writeAsString(this.#journalPath, JSON.stringify(journal, null, 2))

      const sourcePath = this.#sourcePath(identity.id)
      if (await FileManager.exists(sourcePath) && !await this.#sourceMatches(identity.id, sourcePath)) {
        await FileManager.remove(sourcePath)
      }
      if (!await FileManager.exists(sourcePath)) await FileManager.copyFile(stagedPath, sourcePath)
      if (!await this.#sourceMatches(identity.id, sourcePath)) {
        throw new GameLibraryError("storage", "The retained private source failed verification.", true)
      }

      onStage?.("registry")
      const registry = await this.#loadRegistry()
      const timestamp = now()
      const game = pendingGame(
        identity,
        registry.games.find((candidate) => candidate.id === identity.id),
        timestamp,
      )
      const next = replaceGame(registry, game, timestamp)
      await this.#writeRegistry(next)
      await FileManager.remove(stagedPath)
      stagedPath = null
      if (await FileManager.exists(this.#journalPath)) await FileManager.remove(this.#journalPath)
      return { game, snapshot: snapshot(next) }
    } catch (error) {
      if (error instanceof GameLibraryError) throw error
      throw new GameLibraryError("storage", "The private game library could not complete the import.", true)
    } finally {
      if (stagedPath != null && await FileManager.exists(stagedPath)) await FileManager.remove(stagedPath)
      this.#busy = false
    }
  }

  public async retainedSourceData(id: GameId): Promise<Data> {
    const registry = await this.#loadRegistry()
    const game = registry.games.find((candidate) => candidate.id === id)
    const path = this.#sourcePath(id)
    if (game?.status !== "pendingExtraction" || !game.retainedSource
        || !await FileManager.exists(path) || !await this.#sourceMatches(id, path)) {
      throw new GameLibraryError("file", "The verified ROM source is no longer available. Import it again.")
    }
    return FileManager.readAsData(path)
  }

  public async markReady(id: GameId): Promise<GameLibrarySnapshot> {
    const registry = await this.#loadRegistry()
    const game = registry.games.find((candidate) => candidate.id === id)
    if (game == null) throw new GameLibraryError("registry", "The imported game is no longer registered.")
    const timestamp = now()
    const next = replaceGame(registry, {
      ...game,
      status: "ready",
      retainedSource: false,
      updatedAt: timestamp,
    }, timestamp)
    await this.#writeRegistry(next)
    const source = this.#sourcePath(id)
    if (await FileManager.exists(source)) await FileManager.remove(source)
    return snapshot(next)
  }

  public async markCacheMissing(id: GameId): Promise<GameLibrarySnapshot> {
    const registry = await this.#loadRegistry()
    const game = registry.games.find((candidate) => candidate.id === id)
    if (game == null || game.status !== "ready") return snapshot(registry)
    const timestamp = now()
    const next = replaceGame(registry, {
      ...game,
      status: "needsReimport",
      retainedSource: false,
      updatedAt: timestamp,
    }, timestamp)
    await this.#writeRegistry(next)
    return snapshot(next)
  }

  public async updateSaves(id: GameId, saves: readonly SaveSlotSummary[]): Promise<GameLibrarySnapshot> {
    const registry = await this.#loadRegistry()
    const game = registry.games.find((candidate) => candidate.id === id)
    if (game == null) return snapshot(registry)
    const normalized = [...saves].sort(compareSaveSlots)
    if (JSON.stringify(normalized) === JSON.stringify(game.saves)) return snapshot(registry)
    const timestamp = now()
    const next = replaceGame(registry, { ...game, saves: normalized, updatedAt: timestamp }, timestamp)
    await this.#writeRegistry(next)
    return snapshot(next)
  }

  public async forget(id: GameId): Promise<GameLibrarySnapshot> {
    const registry = await this.#loadRegistry()
    const source = this.#sourcePath(id)
    if (await FileManager.exists(source)) await FileManager.remove(source)
    const timestamp = now()
    const next: GameRegistry = {
      schemaVersion: 1,
      games: registry.games.filter((game) => game.id !== id),
      updatedAt: timestamp,
    }
    await this.#writeRegistry(next)
    return snapshot(next)
  }

  async #ensureDirectories(): Promise<void> {
    await FileManager.createDirectory(this.#stateRoot, true)
    await FileManager.createDirectory(this.#sourceRoot, true)
    await FileManager.createDirectory(this.#stagingRoot, true)
  }

  #sourcePath(id: GameId): string {
    return `${this.#sourceRoot}/${id}.verified-rom`
  }

  #stagingPath(id: GameId): string {
    return `${this.#stagingRoot}/${id}.part`
  }

  async #sourceMatches(id: GameId, path: string): Promise<boolean> {
    try {
      const data = await FileManager.readAsData(path)
      const identity = GAME_CATALOG[id]
      return data.size === identity.romSize
        && Crypto.sha1(data).toHexString().toLowerCase() === identity.romSha1
    } catch {
      return false
    }
  }

  async #loadRegistry(): Promise<GameRegistry> {
    if (!await FileManager.exists(this.#registryPath)) {
      if (await FileManager.exists(this.#registryBackupPath)) {
        const recovered = parseGameRegistry(JSON.parse(await FileManager.readAsString(this.#registryBackupPath)))
        if (recovered != null) {
          await FileManager.writeAsString(this.#registryPath, JSON.stringify(recovered, null, 2))
          return recovered
        }
      }
      const initial = emptyGameRegistry(now())
      await FileManager.writeAsString(this.#registryPath, JSON.stringify(initial, null, 2))
      return initial
    }
    try {
      const parsed = parseGameRegistry(JSON.parse(await FileManager.readAsString(this.#registryPath)))
      if (parsed != null) return parsed
    } catch {
      // Recovery is attempted from the independent last-known registry below.
    }
    if (await FileManager.exists(this.#registryBackupPath)) {
      try {
        const recovered = parseGameRegistry(JSON.parse(await FileManager.readAsString(this.#registryBackupPath)))
        if (recovered != null) {
          await FileManager.writeAsString(this.#registryPath, JSON.stringify(recovered, null, 2))
          return recovered
        }
      } catch {
        // Converted to a stable registry error below.
      }
    }
    throw new GameLibraryError("registry", "The game library registry and its recovery copy are damaged.")
  }

  async #writeRegistry(registry: GameRegistry): Promise<void> {
    if (parseGameRegistry(registry) == null) throw new GameLibraryError("registry", "Refusing to persist invalid game state.")
    if (await FileManager.exists(this.#registryPath)) {
      await this.#copyReplacing(this.#registryPath, this.#registryBackupPath)
    }
    await FileManager.writeAsString(this.#registryPath, JSON.stringify(registry, null, 2))
    const readback = parseGameRegistry(JSON.parse(await FileManager.readAsString(this.#registryPath)))
    if (readback == null) throw new GameLibraryError("registry", "The game registry write could not be verified.", true)
    await this.#copyReplacing(this.#registryPath, this.#registryBackupPath)
  }

  async #copyReplacing(source: string, destination: string): Promise<void> {
    if (await FileManager.exists(destination)) await FileManager.remove(destination)
    await FileManager.copyFile(source, destination)
  }
}
