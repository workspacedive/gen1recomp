import assert from "node:assert/strict"
import test from "node:test"

import {
  GAME_CATALOG,
  GAME_ORDER,
  emptyGameRegistry,
  identifyCanonicalRom,
  parseGameRegistry,
  pendingGame,
  replaceGame,
} from "../../scripting/Gen1RecompApp/src/domain/games.js"

const instant = "2026-08-17T12:00:00.000Z"

test("canonical ROM identity is bound to exact size and SHA-1", () => {
  for (const id of GAME_ORDER) {
    const identity = GAME_CATALOG[id]
    assert.deepEqual(identifyCanonicalRom(identity.romSize, identity.romSha1.toUpperCase()), {
      ok: true,
      game: identity,
    })
  }
  assert.deepEqual(identifyCanonicalRom(1_048_575, GAME_CATALOG.yellow.romSha1), { ok: false, reason: "size" })
  assert.deepEqual(identifyCanonicalRom(1_048_576, "0".repeat(40)), { ok: false, reason: "sha1" })
  assert.deepEqual(identifyCanonicalRom(2_097_152, GAME_CATALOG.yellow.romSha1), { ok: false, reason: "sha1" })
})

test("pending registration contains identity metadata but no source path or ROM bytes", () => {
  const game = pendingGame(GAME_CATALOG.yellow, undefined, instant)
  assert.equal(game.status, "pendingExtraction")
  assert.equal(game.retainedSource, true)
  assert.equal(game.romSize, 1_048_576)
  assert.equal(game.romSha1, "cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1")
  const serialized = JSON.stringify(game)
  assert.doesNotMatch(serialized, /path|base64|romData|sourcePath/i)
})

test("registry parser is strict, canonical, unique, and status-consistent", () => {
  const game = pendingGame(GAME_CATALOG.red, undefined, instant)
  const registry = replaceGame(emptyGameRegistry(instant), game, instant)
  assert.deepEqual(parseGameRegistry(JSON.parse(JSON.stringify(registry))), registry)

  assert.equal(parseGameRegistry({ ...registry, unexpected: true }), null)
  assert.equal(parseGameRegistry({ ...registry, games: [game, game] }), null)
  assert.equal(parseGameRegistry({ ...registry, games: [{ ...game, romSha1: "0".repeat(40) }] }), null)
  assert.equal(parseGameRegistry({ ...registry, games: [{ ...game, retainedSource: false }] }), null)
  assert.equal(parseGameRegistry({ ...registry, games: [{ ...game, status: "ready" }] }), null)
})

test("replacement preserves original import time and save summaries", () => {
  const prior = {
    ...pendingGame(GAME_CATALOG.blue, undefined, instant),
    status: "ready" as const,
    retainedSource: false,
    saves: [{ id: "slot1", bytes: 4096, modifiedAt: instant }],
  }
  const nextTime = "2026-08-17T13:00:00.000Z"
  const next = pendingGame(GAME_CATALOG.blue, prior, nextTime)
  assert.equal(next.importedAt, instant)
  assert.equal(next.updatedAt, nextTime)
  assert.deepEqual(next.saves, prior.saves)
})

test("registry parser rejects executable-looking or malformed save metadata", () => {
  const game = pendingGame(GAME_CATALOG.gold, undefined, instant)
  const base = replaceGame(emptyGameRegistry(instant), game, instant)
  assert.equal(parseGameRegistry({
    ...base,
    games: [{ ...game, saves: [{ id: "../slot1", bytes: 1, modifiedAt: null }] }],
  }), null)
  assert.equal(parseGameRegistry({
    ...base,
    games: [{ ...game, saves: [{ id: "slot1", bytes: -1, modifiedAt: null }] }],
  }), null)
  assert.equal(parseGameRegistry({
    ...base,
    games: [{ ...game, saves: [{ id: "slot1", bytes: 1, modifiedAt: "yesterday" }] }],
  }), null)
})
