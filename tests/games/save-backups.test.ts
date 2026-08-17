import assert from "node:assert/strict"
import test from "node:test"

import {
  SAVE_BACKUP_KIND,
  SAVE_BACKUP_MAX_BYTES,
  createSaveBackupEnvelope,
  parseSaveBackupEnvelope,
  saveBackupFilename,
} from "../../scripting/Gen1RecompApp/src/domain/save-backups.js"

const instant = "2026-08-17T12:34:56.000Z"
const digest = "a".repeat(64)
const base64 = "c2F2ZQ=="

test("save backup codec round-trips a closed integrity envelope", () => {
  const envelope = createSaveBackupEnvelope("yellow", "slot2", instant, 4, digest, base64)
  assert.notEqual(envelope, null)
  assert.deepEqual(parseSaveBackupEnvelope(JSON.parse(JSON.stringify(envelope))), {
    gameId: "yellow",
    saveId: "slot2",
    exportedAt: instant,
    bytes: 4,
    sha256: digest,
    base64,
  })
  assert.equal(
    saveBackupFilename("yellow", "slot2", instant),
    "Gen1Recomp-yellow-slot2-20260817T123456000Z.gen1save.json",
  )
})

test("save backup parser rejects identity, size, digest, and shape tampering", () => {
  const envelope = createSaveBackupEnvelope("red", "legacy", instant, 4, digest, base64)
  assert.notEqual(envelope, null)
  assert.equal(parseSaveBackupEnvelope({ ...envelope, kind: "other" }), null)
  assert.equal(parseSaveBackupEnvelope({ ...envelope, gameId: "green" }), null)
  assert.equal(parseSaveBackupEnvelope({ ...envelope, saveId: "../slot1" }), null)
  assert.equal(parseSaveBackupEnvelope({ ...envelope, payload: { ...envelope?.payload, bytes: SAVE_BACKUP_MAX_BYTES + 1 } }), null)
  assert.equal(parseSaveBackupEnvelope({ ...envelope, payload: { ...envelope?.payload, sha256: "0" } }), null)
  assert.equal(parseSaveBackupEnvelope({ ...envelope, unexpected: true }), null)
})

test("save backup builder fails closed on malformed values", () => {
  assert.equal(createSaveBackupEnvelope("blue", "slot0", instant, 4, digest, base64), null)
  assert.equal(createSaveBackupEnvelope("blue", "slot1", "today", 4, digest, base64), null)
  assert.equal(createSaveBackupEnvelope("blue", "slot1", instant, 0, digest, base64), null)
  assert.equal(createSaveBackupEnvelope("blue", "slot1", instant, 4, digest.toUpperCase(), base64), null)
  assert.equal(saveBackupFilename("gold", "../slot1", instant), null)
  assert.equal(SAVE_BACKUP_KIND, "org.gen1recomp.save-backup")
})
