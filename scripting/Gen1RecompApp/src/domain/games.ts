export type GameId = "red" | "blue" | "yellow" | "gold"

export type GameIdentity = {
  readonly id: GameId
  readonly title: string
  readonly shortTitle: string
  readonly generation: 1 | 2
  readonly support: "stable" | "beta"
  readonly romSize: number
  readonly romSha1: string
  readonly cachePrefix: string
  readonly saveSuffix: string
  readonly accent: "systemRed" | "systemBlue" | "systemYellow" | "systemOrange"
  readonly systemImage: string
}

export const GAME_ORDER: readonly GameId[] = ["red", "blue", "yellow", "gold"]

export const GAME_CATALOG: Readonly<Record<GameId, GameIdentity>> = {
  red: {
    id: "red",
    title: "Pokémon Red",
    shortTitle: "Red",
    generation: 1,
    support: "stable",
    romSize: 1_048_576,
    romSha1: "ea9bcae617fdf159b045185467ae58b2e4a48b9a",
    cachePrefix: "red",
    saveSuffix: "",
    accent: "systemRed",
    systemImage: "flame.fill",
  },
  blue: {
    id: "blue",
    title: "Pokémon Blue",
    shortTitle: "Blue",
    generation: 1,
    support: "stable",
    romSize: 1_048_576,
    romSha1: "d7037c83e1ae5b39bde3c30787637ba1d4c48ce2",
    cachePrefix: "blue",
    saveSuffix: "_blue",
    accent: "systemBlue",
    systemImage: "drop.fill",
  },
  yellow: {
    id: "yellow",
    title: "Pokémon Yellow",
    shortTitle: "Yellow",
    generation: 1,
    support: "stable",
    romSize: 1_048_576,
    romSha1: "cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1",
    cachePrefix: "yellow",
    saveSuffix: "_yellow",
    accent: "systemYellow",
    systemImage: "bolt.fill",
  },
  gold: {
    id: "gold",
    title: "Pokémon Gold",
    shortTitle: "Gold (Beta)",
    generation: 2,
    support: "beta",
    romSize: 2_097_152,
    romSha1: "d8b8a3600a465308c9953dfa04f0081c05bdcb94",
    cachePrefix: "gold",
    saveSuffix: "_gold",
    accent: "systemOrange",
    systemImage: "sparkles",
  },
}

export type RomIdentification =
  | { readonly ok: true; readonly game: GameIdentity }
  | { readonly ok: false; readonly reason: "size" | "sha1" }

export function identifyCanonicalRom(size: number, sha1: string): RomIdentification {
  const normalized = sha1.toLowerCase()
  const sizeMatches = GAME_ORDER.filter((id) => GAME_CATALOG[id].romSize === size)
  if (sizeMatches.length === 0) return { ok: false, reason: "size" }
  const id = sizeMatches.find((candidate) => GAME_CATALOG[candidate].romSha1 === normalized)
  return id == null
    ? { ok: false, reason: "sha1" }
    : { ok: true, game: GAME_CATALOG[id] }
}

export type GameImportStatus = "pendingExtraction" | "ready" | "needsReimport"

export type SaveSlotSummary = {
  readonly id: string
  readonly bytes: number
  readonly modifiedAt: string | null
}

export function isSaveSlotId(value: unknown): value is string {
  return value === "legacy" || (typeof value === "string" && /^slot[1-9][0-9]*$/.test(value))
}

export function compareSaveSlots(left: SaveSlotSummary, right: SaveSlotSummary): number {
  if (left.id === right.id) return 0
  if (left.id === "legacy") return -1
  if (right.id === "legacy") return 1
  return Number(left.id.slice(4)) - Number(right.id.slice(4))
}

export type InstalledGame = {
  readonly id: GameId
  readonly title: string
  readonly generation: 1 | 2
  readonly support: "stable" | "beta"
  readonly romSize: number
  readonly romSha1: string
  readonly cacheFormat: "rom-cache-v10"
  readonly status: GameImportStatus
  readonly retainedSource: boolean
  readonly importedAt: string
  readonly updatedAt: string
  readonly saves: readonly SaveSlotSummary[]
}

export type GameRegistry = {
  readonly schemaVersion: 1
  readonly games: readonly InstalledGame[]
  readonly updatedAt: string
}

export function emptyGameRegistry(now: string): GameRegistry {
  return { schemaVersion: 1, games: [], updatedAt: now }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function parseSave(value: unknown): SaveSlotSummary | null {
  if (!isObject(value) || !exactKeys(value, ["id", "bytes", "modifiedAt"])) return null
  if (!isSaveSlotId(value["id"])) return null
  if (!Number.isSafeInteger(value["bytes"]) || (value["bytes"] as number) < 0) return null
  if (value["modifiedAt"] !== null && (typeof value["modifiedAt"] !== "string" || !isIsoDate(value["modifiedAt"]))) return null
  return {
    id: value["id"],
    bytes: value["bytes"] as number,
    modifiedAt: value["modifiedAt"] as string | null,
  }
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && !Number.isNaN(Date.parse(value))
}

function parseGame(value: unknown): InstalledGame | null {
  if (!isObject(value) || !exactKeys(value, [
    "id", "title", "generation", "support", "romSize", "romSha1", "cacheFormat",
    "status", "retainedSource", "importedAt", "updatedAt", "saves",
  ])) return null
  const id = value["id"]
  if (typeof id !== "string" || !GAME_ORDER.includes(id as GameId)) return null
  const identity = GAME_CATALOG[id as GameId]
  if (value["title"] !== identity.title
      || value["generation"] !== identity.generation
      || value["support"] !== identity.support
      || value["romSize"] !== identity.romSize
      || value["romSha1"] !== identity.romSha1
      || value["cacheFormat"] !== "rom-cache-v10") return null
  const status = value["status"]
  if (status !== "pendingExtraction" && status !== "ready" && status !== "needsReimport") return null
  if (typeof value["retainedSource"] !== "boolean") return null
  if ((status === "pendingExtraction") !== value["retainedSource"]) return null
  if (typeof value["importedAt"] !== "string" || !isIsoDate(value["importedAt"])
      || typeof value["updatedAt"] !== "string" || !isIsoDate(value["updatedAt"])) return null
  if (!Array.isArray(value["saves"])) return null
  const saves: SaveSlotSummary[] = []
  const saveIds = new Set<string>()
  for (const raw of value["saves"]) {
    const save = parseSave(raw)
    if (save == null || saveIds.has(save.id)) return null
    saves.push(save)
    saveIds.add(save.id)
  }
  saves.sort(compareSaveSlots)
  return {
    id: identity.id,
    title: identity.title,
    generation: identity.generation,
    support: identity.support,
    romSize: identity.romSize,
    romSha1: identity.romSha1,
    cacheFormat: "rom-cache-v10",
    status,
    retainedSource: value["retainedSource"],
    importedAt: value["importedAt"],
    updatedAt: value["updatedAt"],
    saves,
  }
}

export function parseGameRegistry(value: unknown): GameRegistry | null {
  if (!isObject(value) || !exactKeys(value, ["schemaVersion", "games", "updatedAt"])) return null
  if (value["schemaVersion"] !== 1 || !Array.isArray(value["games"])
      || typeof value["updatedAt"] !== "string" || !isIsoDate(value["updatedAt"])) return null
  const games: InstalledGame[] = []
  const ids = new Set<GameId>()
  for (const raw of value["games"]) {
    const game = parseGame(raw)
    if (game == null || ids.has(game.id)) return null
    games.push(game)
    ids.add(game.id)
  }
  games.sort((left, right) => GAME_ORDER.indexOf(left.id) - GAME_ORDER.indexOf(right.id))
  return { schemaVersion: 1, games, updatedAt: value["updatedAt"] }
}

export function pendingGame(identity: GameIdentity, previous: InstalledGame | undefined, now: string): InstalledGame {
  return {
    id: identity.id,
    title: identity.title,
    generation: identity.generation,
    support: identity.support,
    romSize: identity.romSize,
    romSha1: identity.romSha1,
    cacheFormat: "rom-cache-v10",
    status: "pendingExtraction",
    retainedSource: true,
    importedAt: previous?.importedAt ?? now,
    updatedAt: now,
    saves: previous?.saves ?? [],
  }
}

export function replaceGame(registry: GameRegistry, game: InstalledGame, now: string): GameRegistry {
  return {
    schemaVersion: 1,
    games: [...registry.games.filter(({ id }) => id !== game.id), game]
      .sort((left, right) => GAME_ORDER.indexOf(left.id) - GAME_ORDER.indexOf(right.id)),
    updatedAt: now,
  }
}
