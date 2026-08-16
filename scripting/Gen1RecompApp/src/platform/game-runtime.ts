import { PRODUCT } from "../config/product"
import type { GameLibraryService, GameLibrarySnapshot } from "../data/game-library-service"
import type { SystemUpdateService } from "../data/system-update-service"
import { GAME_CATALOG, type GameId, type InstalledGame, type SaveSlotSummary } from "../domain/games"

const LEGACY_HOST_SESSION_FILE = ".gen1recomp-host-session.json"
const HOST_SESSION_PROTOCOL = 1

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

type MaintenanceResult = {
  readonly ok: boolean
  readonly token: string
  readonly deleted: number
  readonly error?: string
}

function sessionToken(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function parseSaves(value: readonly unknown[] | undefined): readonly SaveSlotSummary[] | null {
  if (value == null || value.length > 128) return null
  const result: SaveSlotSummary[] = []
  const ids = new Set<string>()
  for (const raw of value) {
    if (typeof raw !== "object" || raw == null || Array.isArray(raw)) return null
    const item = raw as Record<string, unknown>
    const keys = Object.keys(item).sort().join(",")
    if (keys !== "bytes,id,modifiedAt" || typeof item["id"] !== "string"
        || !/^(slot[1-9][0-9]*|legacy)$/.test(item["id"])
        || !Number.isSafeInteger(item["bytes"]) || (item["bytes"] as number) < 0
        || (item["modifiedAt"] !== null && typeof item["modifiedAt"] !== "string")) return null
    if (ids.has(item["id"])) return null
    ids.add(item["id"])
    result.push({
      id: item["id"],
      bytes: item["bytes"] as number,
      modifiedAt: item["modifiedAt"] as string | null,
    })
  }
  return result.sort((left, right) => left.id.localeCompare(right.id))
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

  public async launch(game: InstalledGame): Promise<GameRuntimeResult> {
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
      arguments: [`--game=${game.id}`],
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
      await controller.present({ fullscreen: true, navigationTitle: game.title })
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

  public async removeGame(game: InstalledGame): Promise<GameLibrarySnapshot> {
    const { root } = await this.#runtimeRoot(true)
    const token = sessionToken()
    const session = {
      schemaVersion: HOST_SESSION_PROTOCOL,
      token,
      mode: "maintenance",
      operation: "delete-cache",
      gameId: game.id,
    }
    const controller = new WebViewController({ ephemeral: false })
    try {
      if (!await controller.loadFile(`${root}/maintenance.html`, root) || !await controller.waitForLoad()) {
        throw new Error("maintenance_load_failed")
      }
      const started = await controller.evaluateJavaScript<boolean>(
        `return window.__gen1recompMaintenanceStart(${JSON.stringify(session)})`,
      )
      if (started !== true) throw new Error("maintenance_session_rejected")
      let result: MaintenanceResult | null = null
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const value = await controller.evaluateJavaScript<unknown>("return window.__gen1recompMaintenanceResult ?? null")
        if (typeof value === "object" && value != null) {
          const candidate = value as Record<string, unknown>
          if (candidate["token"] === token && typeof candidate["ok"] === "boolean"
              && Number.isSafeInteger(candidate["deleted"])) {
            result = {
              ok: candidate["ok"],
              token,
              deleted: candidate["deleted"] as number,
              ...(typeof candidate["error"] === "string" ? { error: candidate["error"] } : {}),
            }
            break
          }
        }
        await sleep(50)
      }
      if (result == null || !result.ok) {
        throw new Error(result?.error ?? "maintenance_timeout")
      }
      return await this.library.forget(game.id)
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
