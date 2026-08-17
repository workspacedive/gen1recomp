import { PRODUCT } from "../config/product"
import type { GameLibraryService, GameLibrarySnapshot } from "../data/game-library-service"
import type { SystemUpdateService } from "../data/system-update-service"
import {
  GAME_CATALOG,
  compareSaveSlots,
  isSaveSlotId,
  type GameId,
  type InstalledGame,
  type SaveSlotSummary,
} from "../domain/games"
import {
  SAVE_BACKUP_MAX_BYTES,
  SAVE_BACKUP_MAX_FILE_BYTES,
  createSaveBackupEnvelope,
  parseSaveBackupEnvelope,
  saveBackupFilename,
  type PreparedSaveBackup,
} from "../domain/save-backups"

export type { PreparedSaveBackup } from "../domain/save-backups"

const LEGACY_HOST_SESSION_FILE = ".gen1recomp-host-session.json"
const HOST_SESSION_PROTOCOL = 1
const MAINTENANCE_POLL_INTERVAL_MS = 50
const MAINTENANCE_TIMEOUT_MS = 30_000

export type GameRuntimeResult = {
  readonly runtimeReady: boolean
  readonly cacheReady: boolean
  readonly snapshot: GameLibrarySnapshot
  readonly errors: readonly string[]
}

type RuntimeEvent = {
  readonly type?: string
  readonly stage?: string
  readonly message?: string
  readonly token?: string
  readonly gameId?: string
  readonly saves?: readonly unknown[]
}

type MaintenanceOperation = "delete-cache" | "list-saves" | "read-save" | "restore-save" | "delete-save"

type MaintenanceResult = {
  readonly ok?: boolean
  readonly token?: string
  readonly operation?: string
  readonly deleted?: number
  readonly error?: string
  readonly saves?: readonly unknown[]
  readonly file?: unknown
}

type MaintenanceFile = {
  readonly id: string
  readonly bytes: number
  readonly modifiedAt: string | null
  readonly sha256: string
  readonly base64: string
}

export class SaveManagementError extends Error {
  public constructor(
    public readonly code: "missing" | "format" | "identity" | "integrity" | "storage",
    message: string,
  ) {
    super(message)
    this.name = "SaveManagementError"
  }
}

function sessionToken(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && !Number.isNaN(Date.parse(value))
}

function parseSaves(value: readonly unknown[] | undefined): readonly SaveSlotSummary[] | null {
  if (value == null || value.length > 128) return null
  const result: SaveSlotSummary[] = []
  const ids = new Set<string>()
  for (const raw of value) {
    if (!isObject(raw) || !exactKeys(raw, ["bytes", "id", "modifiedAt"]) || !isSaveSlotId(raw["id"])
        || !Number.isSafeInteger(raw["bytes"]) || (raw["bytes"] as number) < 0
        || (raw["modifiedAt"] !== null && !isIsoDate(raw["modifiedAt"]))) return null
    if (ids.has(raw["id"])) return null
    ids.add(raw["id"])
    result.push({
      id: raw["id"],
      bytes: raw["bytes"] as number,
      modifiedAt: raw["modifiedAt"] as string | null,
    })
  }
  return result.sort(compareSaveSlots)
}

function parseMaintenanceFile(value: unknown): MaintenanceFile | null {
  if (!isObject(value) || !exactKeys(value, ["base64", "bytes", "id", "modifiedAt", "sha256"])
      || !isSaveSlotId(value["id"])
      || !Number.isSafeInteger(value["bytes"]) || (value["bytes"] as number) < 1
      || (value["bytes"] as number) > SAVE_BACKUP_MAX_BYTES
      || (value["modifiedAt"] !== null && !isIsoDate(value["modifiedAt"]))
      || typeof value["sha256"] !== "string" || !/^[0-9a-f]{64}$/.test(value["sha256"])
      || typeof value["base64"] !== "string") return null
  return {
    id: value["id"],
    bytes: value["bytes"] as number,
    modifiedAt: value["modifiedAt"] as string | null,
    sha256: value["sha256"],
    base64: value["base64"],
  }
}

export class GameRuntimeService {
  public constructor(
    private readonly updates: SystemUpdateService,
    private readonly library: GameLibraryService,
  ) {}

  public async recoverTransientSessions(): Promise<void> {
    const state = await this.updates.loadState()
    const packaged = `${FileManager.scriptsDirectory}/${PRODUCT.projectDirectoryName}/${PRODUCT.packagedRuntimeDirectory}`
    const roots = state.activeRuntimeRoot == null ? [packaged] : [packaged, state.activeRuntimeRoot]
    for (const root of roots) {
      const legacy = `${root}/${LEGACY_HOST_SESSION_FILE}`
      if (await FileManager.exists(legacy)) await FileManager.remove(legacy)
    }
  }

  public async launch(game: InstalledGame, saveId?: string): Promise<GameRuntimeResult> {
    if (saveId != null && !isSaveSlotId(saveId)) throw new SaveManagementError("identity", "The selected save slot is invalid.")
    const { root, usedUpdatedComponents } = await this.#runtimeRoot()
    const token = sessionToken()
    let rom: Data | null = game.status === "pendingExtraction"
      ? await this.library.retainedSourceData(game.id)
      : null
    const hadRom = rom != null
    const session = {
      schemaVersion: HOST_SESSION_PROTOCOL,
      token,
      mode: "game",
      gameId: game.id,
      arguments: [
        `--game=${game.id}`,
        ...(saveId == null || saveId === "legacy" ? [] : [`--slot=${saveId}`]),
      ],
      rom: rom == null ? null : {
        size: rom.size,
        sha1: GAME_CATALOG[game.id].romSha1,
        base64: rom.toBase64String(),
      },
    }

    const controller = new WebViewController({ ephemeral: false })
    let runtimeReady = false
    let cacheReady = game.status === "ready"
    let currentSnapshot = await this.library.initialize()
    const errors: string[] = []
    let eventTail: Promise<void> = Promise.resolve()
    try {
      await controller.addScriptMessageHandler("gen1recompLog", (entry?: { level?: string; message?: string }) => {
        const message = entry?.message ?? "empty runtime log"
        if (entry?.level === "error") {
          errors.push(message)
          console.error(`[Gen1Recomp Native] ${message}`)
        } else if (entry?.level === "warn") {
          console.warn(`[Gen1Recomp Native] ${message}`)
        } else {
          console.log(`[Gen1Recomp Native] ${message}`)
        }
        return { accepted: true }
      })
      await controller.addScriptMessageHandler("gen1recompEvent", async (event?: RuntimeEvent) => {
        if (event?.token != null && event.token !== token) return { accepted: false }
        const operation = eventTail.then(async () => {
          if (event?.type === "preview.ready") {
            runtimeReady = true
          } else if (event?.type === "preview.dismiss") {
            controller.dismiss()
          } else if (event?.type === "game.cacheReady" && event.gameId === game.id) {
            currentSnapshot = await this.library.markReady(game.id)
            cacheReady = true
          } else if (event?.type === "game.cacheMissing" && event.gameId === game.id && !hadRom) {
            currentSnapshot = await this.library.markCacheMissing(game.id)
            cacheReady = false
          } else if (event?.type === "game.saves" && event.gameId === game.id) {
            const saves = parseSaves(event.saves)
            if (saves != null) currentSnapshot = await this.library.updateSaves(game.id, saves)
          } else if (event?.type === "preview.error") {
            errors.push(`${event.stage ?? "runtime"}: ${event.message ?? "unknown error"}`)
          }
        })
        eventTail = operation.catch((error: unknown) => {
          errors.push(`native event: ${error instanceof Error ? error.message : String(error)}`)
        })
        await eventTail
        return { accepted: true }
      })
      if (!await controller.loadFile(`${root}/index.html`, root) || !await controller.waitForLoad()) {
        throw new Error("runtime_load_failed")
      }
      const started = await controller.evaluateJavaScript<boolean>(
        `return window.__gen1recompStart(${JSON.stringify(session)})`,
      )
      if (session.rom != null) session.rom.base64 = ""
      rom = null
      if (started !== true) throw new Error("runtime_session_rejected")
      // Scripting exposes no API to animate native navigation chrome. Present
      // without its persistent title/gradient; the WebView supplies a brief,
      // fading game title plus an explicit dismiss button instead.
      await controller.present({ fullscreen: true })
    } catch (error) {
      errors.push(String(error))
    } finally {
      await eventTail
      controller.dispose()
    }
    if (usedUpdatedComponents && !runtimeReady) await this.updates.rollbackAfterRuntimeFailure()
    currentSnapshot = await this.library.initialize()
    return { runtimeReady, cacheReady, snapshot: currentSnapshot, errors }
  }

  public async refreshSaves(game: InstalledGame): Promise<GameLibrarySnapshot> {
    const result = await this.#runMaintenance("list-saves", game.id)
    const saves = parseSaves(result.saves)
    if (saves == null) throw new SaveManagementError("storage", "The private save index is invalid.")
    return this.library.updateSaves(game.id, saves)
  }

  public async createSaveBackup(
    game: InstalledGame,
    save: SaveSlotSummary,
  ): Promise<{ readonly data: Data; readonly name: string }> {
    if (!isSaveSlotId(save.id)) throw new SaveManagementError("identity", "The selected save slot is invalid.")
    const result = await this.#runMaintenance("read-save", game.id, { saveId: save.id })
    const file = parseMaintenanceFile(result.file)
    if (file == null || file.id !== save.id) throw new SaveManagementError("storage", "The private save could not be read safely.")
    const payload = Data.fromBase64String(file.base64)
    if (payload == null || payload.size !== file.bytes
        || Crypto.sha256(payload).toHexString().toLowerCase() !== file.sha256) {
      throw new SaveManagementError("integrity", "The save backup failed its integrity check.")
    }
    const exportedAt = new Date().toISOString()
    const envelope = createSaveBackupEnvelope(
      game.id,
      save.id,
      exportedAt,
      file.bytes,
      file.sha256,
      file.base64,
    )
    const name = saveBackupFilename(game.id, save.id, exportedAt)
    if (envelope == null || name == null) throw new SaveManagementError("format", "The save backup could not be encoded.")
    const data = Data.fromRawString(JSON.stringify(envelope, null, 2), "utf-8")
    if (data == null) throw new SaveManagementError("format", "The save backup could not be encoded.")
    return { data, name }
  }

  public async inspectSaveBackup(game: InstalledGame, path: string): Promise<PreparedSaveBackup> {
    let data: Data
    try {
      data = await FileManager.readAsData(path)
    } catch {
      throw new SaveManagementError("missing", "The selected backup could not be read.")
    }
    if (data.size < 1 || data.size > SAVE_BACKUP_MAX_FILE_BYTES) {
      throw new SaveManagementError("format", "The selected backup has an unsupported size.")
    }
    const text = data.toRawString("utf-8")
    if (text == null) throw new SaveManagementError("format", "The selected backup is not UTF-8 JSON.")
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      throw new SaveManagementError("format", "The selected backup is not valid JSON.")
    }
    const backup = parseSaveBackupEnvelope(raw)
    if (backup == null) throw new SaveManagementError("format", "The selected file is not a supported Gen1Recomp save backup.")
    if (backup.gameId !== game.id) throw new SaveManagementError("identity", "This backup belongs to a different game.")
    const payload = Data.fromBase64String(backup.base64)
    if (payload == null || payload.size !== backup.bytes
        || Crypto.sha256(payload).toHexString().toLowerCase() !== backup.sha256) {
      throw new SaveManagementError("integrity", "The selected backup failed its integrity check.")
    }
    return backup
  }

  public async restoreSaveBackup(game: InstalledGame, backup: PreparedSaveBackup): Promise<GameLibrarySnapshot> {
    if (backup.gameId !== game.id || !isSaveSlotId(backup.saveId)) {
      throw new SaveManagementError("identity", "The backup target is invalid.")
    }
    const result = await this.#runMaintenance("restore-save", game.id, {
      saveId: backup.saveId,
      bytes: backup.bytes,
      sha256: backup.sha256,
      base64: backup.base64,
    })
    const file = parseMaintenanceFile(result.file)
    const saves = parseSaves(result.saves)
    if (file == null || saves == null || file.id !== backup.saveId
        || file.bytes !== backup.bytes || file.sha256 !== backup.sha256) {
      throw new SaveManagementError("storage", "The restored save could not be verified.")
    }
    return this.library.updateSaves(game.id, saves)
  }

  public async deleteSave(game: InstalledGame, save: SaveSlotSummary): Promise<GameLibrarySnapshot> {
    if (!isSaveSlotId(save.id)) throw new SaveManagementError("identity", "The selected save slot is invalid.")
    const result = await this.#runMaintenance("delete-save", game.id, { saveId: save.id })
    if (!Number.isSafeInteger(result.deleted) || (result.deleted as number) < 1) {
      throw new SaveManagementError("missing", "The selected save no longer exists.")
    }
    const saves = parseSaves(result.saves)
    if (saves == null) throw new SaveManagementError("storage", "The private save index is invalid.")
    return this.library.updateSaves(game.id, saves)
  }

  public async removeGame(game: InstalledGame): Promise<GameLibrarySnapshot> {
    await this.#runMaintenance("delete-cache", game.id)
    return this.library.forget(game.id)
  }

  async #runMaintenance(
    operation: MaintenanceOperation,
    gameId: GameId,
    details: Readonly<Record<string, unknown>> = {},
  ): Promise<MaintenanceResult> {
    const { root } = await this.#runtimeRoot(true)
    const token = sessionToken()
    const session = {
      schemaVersion: HOST_SESSION_PROTOCOL,
      token,
      mode: "maintenance",
      operation,
      gameId,
      ...details,
    }
    const controller = new WebViewController({ ephemeral: false })
    try {
      if (!await controller.loadFile(`${root}/maintenance.html`, root) || !await controller.waitForLoad()) {
        throw new SaveManagementError("storage", "The private maintenance runtime could not load.")
      }
      const started = await controller.evaluateJavaScript<boolean>(
        `return window.__gen1recompMaintenanceStart(${JSON.stringify(session)})`,
      )
      if (started !== true) throw new SaveManagementError("storage", "The private maintenance request was rejected.")
      for (let elapsed = 0; elapsed < MAINTENANCE_TIMEOUT_MS; elapsed += MAINTENANCE_POLL_INTERVAL_MS) {
        const value = await controller.evaluateJavaScript<unknown>("return window.__gen1recompMaintenanceResult ?? null")
        if (isObject(value) && value["token"] === token && value["operation"] === operation
            && typeof value["ok"] === "boolean") {
          const result = value as MaintenanceResult
          if (result.ok === true) return result
          throw new SaveManagementError("storage", typeof result.error === "string" ? result.error : "Private maintenance failed.")
        }
        await sleep(MAINTENANCE_POLL_INTERVAL_MS)
      }
      throw new SaveManagementError("storage", "The private maintenance operation timed out.")
    } finally {
      controller.dispose()
    }
  }

  async #runtimeRoot(requireMaintenance = false): Promise<{ readonly root: string; readonly usedUpdatedComponents: boolean }> {
    const state = await this.updates.loadState()
    const packaged = `${FileManager.scriptsDirectory}/${PRODUCT.projectDirectoryName}/${PRODUCT.packagedRuntimeDirectory}`
    const candidate = state.activeRuntimeRoot ?? packaged
    const candidateConfig = `${candidate}/runtime-config.js`
    const candidateEntry = requireMaintenance ? `${candidate}/maintenance.html` : `${candidate}/index.html`
    if (await FileManager.exists(candidateEntry) && await FileManager.exists(candidateConfig)) {
      try {
        const config = await FileManager.readAsString(candidateConfig)
        if (config.includes(`\"hostSessionProtocol\":${HOST_SESSION_PROTOCOL}`)
            && config.includes(`\"sha256\":\"${PRODUCT.packagedPayloadSha256}\"`)) {
          return { root: candidate, usedUpdatedComponents: state.activeRuntimeRoot != null }
        }
      } catch {
        // A damaged/incompatible active generation falls back to the packaged runtime.
      }
    }
    const packagedEntry = requireMaintenance ? `${packaged}/maintenance.html` : `${packaged}/index.html`
    if (!await FileManager.exists(packagedEntry)) throw new Error("runtime_missing")
    return { root: packaged, usedUpdatedComponents: false }
  }
}
