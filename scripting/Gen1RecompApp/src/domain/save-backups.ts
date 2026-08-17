export type SaveBackupGameId = "red" | "blue" | "yellow" | "gold"

export const SAVE_BACKUP_KIND = "org.gen1recomp.save-backup"
export const SAVE_BACKUP_MAX_BYTES = 8 * 1024 * 1024
export const SAVE_BACKUP_MAX_FILE_BYTES = 12 * 1024 * 1024

export type PreparedSaveBackup = {
  readonly gameId: SaveBackupGameId
  readonly saveId: string
  readonly exportedAt: string
  readonly bytes: number
  readonly sha256: string
  readonly base64: string
}

export type SaveBackupEnvelope = {
  readonly schemaVersion: 1
  readonly kind: typeof SAVE_BACKUP_KIND
  readonly gameId: SaveBackupGameId
  readonly saveId: string
  readonly exportedAt: string
  readonly payload: {
    readonly encoding: "base64"
    readonly bytes: number
    readonly sha256: string
    readonly base64: string
  }
}

const GAME_IDS = new Set<string>(["red", "blue", "yellow", "gold"])

function isGameId(value: unknown): value is SaveBackupGameId {
  return typeof value === "string" && GAME_IDS.has(value)
}

function isSaveSlotId(value: unknown): value is string {
  return value === "legacy" || (typeof value === "string" && /^slot[1-9][0-9]*$/.test(value))
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

export function createSaveBackupEnvelope(
  gameId: SaveBackupGameId,
  saveId: string,
  exportedAt: string,
  bytes: number,
  sha256: string,
  base64: string,
): SaveBackupEnvelope | null {
  if (!isGameId(gameId) || !isSaveSlotId(saveId)
      || !isIsoDate(exportedAt) || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > SAVE_BACKUP_MAX_BYTES
      || !/^[0-9a-f]{64}$/.test(sha256) || typeof base64 !== "string") return null
  return {
    schemaVersion: 1,
    kind: SAVE_BACKUP_KIND,
    gameId,
    saveId,
    exportedAt,
    payload: { encoding: "base64", bytes, sha256, base64 },
  }
}

export function parseSaveBackupEnvelope(value: unknown): PreparedSaveBackup | null {
  if (!isObject(value) || !exactKeys(value, ["exportedAt", "gameId", "kind", "payload", "saveId", "schemaVersion"])
      || value["schemaVersion"] !== 1 || value["kind"] !== SAVE_BACKUP_KIND
      || !isGameId(value["gameId"])
      || !isSaveSlotId(value["saveId"]) || !isIsoDate(value["exportedAt"]) || !isObject(value["payload"])) return null
  const payload = value["payload"]
  if (!exactKeys(payload, ["base64", "bytes", "encoding", "sha256"]) || payload["encoding"] !== "base64"
      || !Number.isSafeInteger(payload["bytes"]) || (payload["bytes"] as number) < 1
      || (payload["bytes"] as number) > SAVE_BACKUP_MAX_BYTES
      || typeof payload["sha256"] !== "string" || !/^[0-9a-f]{64}$/.test(payload["sha256"])
      || typeof payload["base64"] !== "string") return null
  return {
    gameId: value["gameId"] as SaveBackupGameId,
    saveId: value["saveId"],
    exportedAt: value["exportedAt"],
    bytes: payload["bytes"] as number,
    sha256: payload["sha256"],
    base64: payload["base64"],
  }
}

export function saveBackupFilename(gameId: SaveBackupGameId, saveId: string, timestamp: string): string | null {
  if (!isGameId(gameId) || !isSaveSlotId(saveId) || !isIsoDate(timestamp)) return null
  return `Gen1Recomp-${gameId}-${saveId}-${timestamp.replace(/[-:.]/g, "")}.gen1save.json`
}
