import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { webcrypto } from "node:crypto"
import vm from "node:vm"

import { IDBFactory } from "fake-indexeddb"

const source = readFileSync(
  resolve(process.cwd(), "scripting/Gen1RecompApp/runtime-shell-v053/maintenance.js"),
  "utf8",
)
const root = "/home/web_user/.local/share/love/pokemon-love2d"

type MaintenanceResult = {
  readonly ok: boolean
  readonly token: string
  readonly operation: string
  readonly deleted?: number
  readonly saves?: readonly { readonly id: string; readonly bytes: number; readonly modifiedAt: string | null }[]
  readonly file?: { readonly id: string; readonly bytes: number; readonly sha256: string; readonly base64: string }
  readonly error?: string
}

type MaintenanceWindow = {
  __gen1recompMaintenanceStart?: (session: Readonly<Record<string, unknown>>) => boolean
  __gen1recompMaintenanceResult?: MaintenanceResult
}

function openDatabase(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("/home/web_user", 21)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("FILE_DATA")
      store.createIndex("timestamp", "timestamp", { unique: false })
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function seed(indexedDB: IDBFactory, values: Readonly<Record<string, Uint8Array>>): Promise<void> {
  const database = await openDatabase(indexedDB)
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(["FILE_DATA"], "readwrite")
    const store = transaction.objectStore("FILE_DATA")
    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => resolve()
    for (const [path, contents] of Object.entries(values)) {
      store.put({ timestamp: new Date("2026-08-17T12:00:00.000Z"), mode: 33206, contents }, path)
    }
  })
  database.close()
}

async function records(indexedDB: IDBFactory, paths: readonly string[]): Promise<ReadonlyMap<string, unknown>> {
  const database = await openDatabase(indexedDB)
  const result = new Map<string, unknown>()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(["FILE_DATA"], "readonly")
    const store = transaction.objectStore("FILE_DATA")
    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => resolve()
    for (const path of paths) {
      const request = store.get(path)
      request.onsuccess = () => { if (request.result != null) result.set(path, request.result) }
    }
  })
  database.close()
  return result
}

async function run(
  indexedDB: IDBFactory,
  operation: string,
  details: Readonly<Record<string, unknown>> = {},
): Promise<MaintenanceResult> {
  const window: MaintenanceWindow = {}
  vm.runInNewContext(source, {
    window,
    indexedDB,
    crypto: webcrypto,
    ArrayBuffer,
    Uint8Array,
    Date,
    Promise,
    String,
    Number,
    Object,
    RegExp,
    Set,
    Map,
    Math,
    Error,
    btoa,
    atob,
  })
  const token = `test-${operation}-token`
  const accepted = window.__gen1recompMaintenanceStart?.({
    schemaVersion: 1,
    mode: "maintenance",
    operation,
    gameId: "yellow",
    token,
    ...details,
  })
  assert.equal(accepted, true)
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (window.__gen1recompMaintenanceResult != null) return window.__gen1recompMaintenanceResult
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error("maintenance result timed out")
}

test("maintenance lists canonical save records in numeric slot order", async () => {
  const indexedDB = new IDBFactory()
  await seed(indexedDB, {
    [`${root}/save_yellow.lua`]: new Uint8Array([1]),
    [`${root}/saves/yellow/slot10.lua`]: new Uint8Array([10]),
    [`${root}/saves/yellow/slot2.lua`]: new Uint8Array([2]),
    [`${root}/saves/yellow/slot1.lua.bak`]: new Uint8Array([99]),
    [`${root}/yellow/data/generated/maps.lua`]: new Uint8Array([7]),
  })

  const result = await run(indexedDB, "list-saves")
  assert.equal(result.ok, true)
  assert.deepEqual(Array.from(result.saves ?? [], ({ id }) => id), ["legacy", "slot2", "slot10"])
})

test("maintenance reads an integrity-bound save and rejects an unsafe id", async () => {
  const indexedDB = new IDBFactory()
  const bytes = new TextEncoder().encode("return { player = { name = 'PIKA' } }")
  await seed(indexedDB, { [`${root}/saves/yellow/slot2.lua`]: bytes })

  const result = await run(indexedDB, "read-save", { saveId: "slot2" })
  assert.equal(result.ok, true)
  assert.equal(result.file?.id, "slot2")
  assert.equal(result.file?.bytes, bytes.length)
  assert.equal(result.file?.base64, Buffer.from(bytes).toString("base64"))
  assert.match(result.file?.sha256 ?? "", /^[0-9a-f]{64}$/)

  const window: MaintenanceWindow = {}
  vm.runInNewContext(source, { window, indexedDB, crypto: webcrypto, ArrayBuffer, Uint8Array, Date, Promise, String, Number, Object, RegExp, Set, Map, Math, Error, btoa, atob })
  assert.equal(window.__gen1recompMaintenanceStart?.({
    schemaVersion: 1,
    mode: "maintenance",
    operation: "read-save",
    gameId: "yellow",
    saveId: "../slot2",
    token: "unsafe-token",
  }), false)
})

test("restore preserves the previous main as backup and verifies the replacement", async () => {
  const indexedDB = new IDBFactory()
  const main = `${root}/saves/yellow/slot2.lua`
  const backup = `${main}.bak`
  const prior = new TextEncoder().encode("prior")
  const replacement = new TextEncoder().encode("replacement")
  await seed(indexedDB, { [main]: prior })
  const sha256 = Buffer.from(await webcrypto.subtle.digest("SHA-256", replacement)).toString("hex")

  const result = await run(indexedDB, "restore-save", {
    saveId: "slot2",
    bytes: replacement.length,
    sha256,
    base64: Buffer.from(replacement).toString("base64"),
  })
  assert.equal(result.ok, true)
  assert.equal(result.file?.sha256, sha256)

  const stored = await records(indexedDB, [main, backup])
  assert.deepEqual(Array.from((stored.get(main) as { contents: Uint8Array }).contents), Array.from(replacement))
  assert.deepEqual(Array.from((stored.get(backup) as { contents: Uint8Array }).contents), Array.from(prior))
})

test("restore never overwrites an existing recovery copy", async () => {
  const indexedDB = new IDBFactory()
  const main = `${root}/saves/yellow/slot2.lua`
  const backup = `${main}.bak`
  const prior = new TextEncoder().encode("current-main")
  const recovery = new TextEncoder().encode("known-recovery")
  const replacement = new TextEncoder().encode("replacement")
  await seed(indexedDB, { [main]: prior, [backup]: recovery })
  const sha256 = Buffer.from(await webcrypto.subtle.digest("SHA-256", replacement)).toString("hex")

  const result = await run(indexedDB, "restore-save", {
    saveId: "slot2",
    bytes: replacement.length,
    sha256,
    base64: Buffer.from(replacement).toString("base64"),
  })
  assert.equal(result.ok, true)

  const stored = await records(indexedDB, [main, backup])
  assert.deepEqual(Array.from((stored.get(main) as { contents: Uint8Array }).contents), Array.from(replacement))
  assert.deepEqual(Array.from((stored.get(backup) as { contents: Uint8Array }).contents), Array.from(recovery))
})

test("save deletion is scoped and cache deletion preserves saves", async () => {
  const indexedDB = new IDBFactory()
  const slot = `${root}/saves/yellow/slot2.lua`
  const cache = `${root}/yellow/data/generated/maps.lua`
  const other = `${root}/saves/red/slot1.lua`
  await seed(indexedDB, {
    [slot]: new Uint8Array([1]),
    [`${slot}.bak`]: new Uint8Array([2]),
    [`${slot}.tmp`]: new Uint8Array([3]),
    [cache]: new Uint8Array([4]),
    [other]: new Uint8Array([5]),
  })

  const deletedSave = await run(indexedDB, "delete-save", { saveId: "slot2" })
  assert.equal(deletedSave.deleted, 3)
  let stored = await records(indexedDB, [slot, `${slot}.bak`, `${slot}.tmp`, cache, other])
  assert.equal(stored.has(slot), false)
  assert.equal(stored.has(cache), true)
  assert.equal(stored.has(other), true)

  const deletedCache = await run(indexedDB, "delete-cache")
  assert.equal(deletedCache.deleted, 1)
  stored = await records(indexedDB, [cache, other])
  assert.equal(stored.has(cache), false)
  assert.equal(stored.has(other), true)
})
