(() => {
  "use strict"

  const DB_NAME = "/home/web_user"
  const DB_VERSION = 21
  const STORE_NAME = "FILE_DATA"
  const SAVE_MAX_BYTES = 8 * 1024 * 1024
  const SAVE_MAX_COUNT = 128
  const FILE_MODE = 33206
  const DIRECTORY_MODE = 16895
  const saveRoot = "/home/web_user/.local/share/love/pokemon-love2d"
  const identities = Object.freeze({
    red: { saveSuffix: "" },
    blue: { saveSuffix: "_blue" },
    yellow: { saveSuffix: "_yellow" },
    gold: { saveSuffix: "_gold" },
  })
  const operations = new Set(["delete-cache", "list-saves", "read-save", "restore-save", "delete-save"])
  let started = false

  const result = (value) => { window.__gen1recompMaintenanceResult = value }
  const fail = (session, error) => result({
    ok: false,
    token: typeof session?.token === "string" ? session.token : "invalid",
    operation: typeof session?.operation === "string" ? session.operation : "invalid",
    error: String(error instanceof Error ? error.message : error),
  })

  function isSaveId(value) {
    return value === "legacy" || (typeof value === "string" && /^slot[1-9][0-9]*$/.test(value))
  }

  function validSession(session) {
    if (session?.schemaVersion !== 1 || session?.mode !== "maintenance"
        || typeof session?.token !== "string" || session.token.length < 8
        || !operations.has(session?.operation)
        || !Object.prototype.hasOwnProperty.call(identities, session?.gameId)) return false
    if (session.operation === "read-save" || session.operation === "delete-save") {
      return isSaveId(session.saveId)
    }
    if (session.operation === "restore-save") {
      return isSaveId(session.saveId)
        && Number.isSafeInteger(session.bytes) && session.bytes > 0 && session.bytes <= SAVE_MAX_BYTES
        && typeof session.sha256 === "string" && /^[0-9a-f]{64}$/.test(session.sha256)
        && typeof session.base64 === "string" && session.base64.length <= Math.ceil(SAVE_MAX_BYTES / 3) * 4
    }
    return session.saveId == null && session.bytes == null && session.sha256 == null && session.base64 == null
  }

  function savePaths(gameId, saveId) {
    if (!Object.prototype.hasOwnProperty.call(identities, gameId) || !isSaveId(saveId)) {
      throw new Error("invalid save identity")
    }
    const main = saveId === "legacy"
      ? `${saveRoot}/save${identities[gameId].saveSuffix}.lua`
      : `${saveRoot}/saves/${gameId}/${saveId}.lua`
    return { main, backup: `${main}.bak`, temporary: `${main}.tmp` }
  }

  function entryBytes(entry) {
    const value = entry?.contents
    let bytes = null
    if (value instanceof Uint8Array) bytes = value
    else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value)
    else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    if (bytes == null || bytes.length < 1 || bytes.length > SAVE_MAX_BYTES) return null
    return new Uint8Array(bytes)
  }

  function modifiedAt(value) {
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  function compareSaveIds(left, right) {
    if (left === right) return 0
    if (left === "legacy") return -1
    if (right === "legacy") return 1
    return Number(left.slice(4)) - Number(right.slice(4))
  }

  function bytesToBase64(bytes) {
    let binary = ""
    const chunk = 32768
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)))
    }
    return btoa(binary)
  }

  function base64ToBytes(value) {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
      throw new Error("backup payload is not canonical base64")
    }
    const binary = atob(value)
    if (binary.length < 1 || binary.length > SAVE_MAX_BYTES) throw new Error("backup payload size is invalid")
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes
  }

  async function sha256(bytes) {
    if (typeof crypto?.subtle?.digest !== "function") throw new Error("Web Crypto SHA-256 is unavailable")
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
    return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("")
  }

  function openStorage() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      let creationAborted = false
      request.onerror = () => {
        if (creationAborted) resolve(null)
        else reject(request.error ?? new Error("could not open private runtime storage"))
      }
      request.onupgradeneeded = () => {
        // Maintenance never creates or migrates love.js storage. An absent or
        // older database belongs to the runtime that owns that schema.
        creationAborted = true
        request.transaction.abort()
      }
      request.onsuccess = () => resolve(request.result)
    })
  }

  function readRecords(database, paths) {
    return new Promise((resolve, reject) => {
      const values = new Map()
      const transaction = database.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      transaction.onerror = () => reject(transaction.error ?? new Error("private save read failed"))
      transaction.oncomplete = () => resolve(values)
      for (const path of paths) {
        const request = store.get(path)
        request.onerror = () => reject(request.error ?? new Error("private save read failed"))
        request.onsuccess = () => { if (request.result != null) values.set(path, request.result) }
      }
    })
  }

  async function readSave(database, gameId, saveId) {
    const paths = savePaths(gameId, saveId)
    const records = await readRecords(database, [paths.main, paths.temporary, paths.backup])
    for (const path of [paths.main, paths.temporary, paths.backup]) {
      const entry = records.get(path)
      const bytes = entryBytes(entry)
      if (bytes != null) {
        return {
          id: saveId,
          bytes: bytes.length,
          modifiedAt: modifiedAt(entry.timestamp),
          sha256: await sha256(bytes),
          base64: bytesToBase64(bytes),
        }
      }
    }
    return null
  }

  function listSaves(database, gameId) {
    return new Promise((resolve, reject) => {
      const saves = []
      const legacy = savePaths(gameId, "legacy").main
      const slotPrefix = `${saveRoot}/saves/${gameId}/`
      const transaction = database.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      transaction.onerror = () => reject(transaction.error ?? new Error("private save scan failed"))
      transaction.oncomplete = () => resolve(saves.sort((left, right) => compareSaveIds(left.id, right.id)))
      const request = store.openCursor()
      request.onerror = () => reject(request.error ?? new Error("private save scan failed"))
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor == null) return
        let id = null
        if (cursor.key === legacy) id = "legacy"
        else if (typeof cursor.key === "string" && cursor.key.startsWith(slotPrefix)) {
          const match = /^(slot[1-9][0-9]*)\.lua$/.exec(cursor.key.slice(slotPrefix.length))
          if (match != null) id = match[1]
        }
        const bytes = id == null ? null : entryBytes(cursor.value)
        if (id != null && bytes != null) {
          if (saves.length >= SAVE_MAX_COUNT) {
            reject(new Error("private save count exceeds the supported limit"))
            return
          }
          saves.push({ id, bytes: bytes.length, modifiedAt: modifiedAt(cursor.value.timestamp) })
        }
        cursor.continue()
      }
    })
  }

  function deletePaths(database, paths) {
    return new Promise((resolve, reject) => {
      let deleted = 0
      const transaction = database.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      transaction.onerror = () => reject(transaction.error ?? new Error("private deletion failed"))
      transaction.oncomplete = () => resolve(deleted)
      for (const path of paths) {
        const get = store.getKey(path)
        get.onerror = () => reject(get.error ?? new Error("private deletion scan failed"))
        get.onsuccess = () => {
          if (get.result === undefined) return
          store.delete(path)
          deleted += 1
        }
      }
    })
  }

  function deleteCache(database, gameId) {
    return new Promise((resolve, reject) => {
      const prefix = `${saveRoot}/${gameId}`
      let deleted = 0
      const transaction = database.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      transaction.onerror = () => reject(transaction.error ?? new Error("private cache deletion failed"))
      transaction.oncomplete = () => resolve(deleted)
      const request = store.openCursor()
      request.onerror = () => reject(request.error ?? new Error("private cache scan failed"))
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor == null) return
        if (typeof cursor.key === "string" && (cursor.key === prefix || cursor.key.startsWith(`${prefix}/`))) {
          cursor.delete()
          deleted += 1
        }
        cursor.continue()
      }
    })
  }

  function restoreSave(database, gameId, saveId, bytes) {
    const paths = savePaths(gameId, saveId)
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const timestamp = new Date()
      transaction.onerror = () => reject(transaction.error ?? new Error("private save restore failed"))
      transaction.oncomplete = () => resolve()

      if (saveId !== "legacy") {
        for (const directory of [`${saveRoot}/saves`, `${saveRoot}/saves/${gameId}`]) {
          const getDirectory = store.get(directory)
          getDirectory.onerror = () => reject(getDirectory.error ?? new Error("private save directory read failed"))
          getDirectory.onsuccess = () => {
            if (getDirectory.result == null) store.put({ timestamp, mode: DIRECTORY_MODE }, directory)
          }
        }
      }

      let currentReady = false
      let backupReady = false
      let currentRecord = null
      let backupRecord = null
      const writeWhenReady = () => {
        if (!currentReady || !backupReady) return
        // Never overwrite an existing recovery copy: the host cannot decide
        // whether current main or .bak is semantically healthier. If no .bak
        // exists, preserve current main byte-for-byte before replacement.
        if (backupRecord == null && currentRecord != null) store.put(currentRecord, paths.backup)
        store.put({ timestamp, mode: FILE_MODE, contents: new Uint8Array(bytes) }, paths.main)
        store.delete(paths.temporary)
      }
      const getCurrent = store.get(paths.main)
      getCurrent.onerror = () => reject(getCurrent.error ?? new Error("private save main read failed"))
      getCurrent.onsuccess = () => {
        currentRecord = getCurrent.result ?? null
        currentReady = true
        writeWhenReady()
      }
      const getBackup = store.get(paths.backup)
      getBackup.onerror = () => reject(getBackup.error ?? new Error("private save recovery read failed"))
      getBackup.onsuccess = () => {
        backupRecord = getBackup.result ?? null
        backupReady = true
        writeWhenReady()
      }
    })
  }

  async function run(session) {
    const database = await openStorage()
    if (session.operation === "delete-cache") {
      const deleted = database == null ? 0 : await deleteCache(database, session.gameId)
      database?.close()
      return { ok: true, token: session.token, operation: session.operation, deleted }
    }
    if (session.operation === "list-saves") {
      const saves = database == null ? [] : await listSaves(database, session.gameId)
      database?.close()
      return { ok: true, token: session.token, operation: session.operation, saves }
    }
    if (database == null) throw new Error("private runtime storage does not exist")
    if (session.operation === "read-save") {
      const file = await readSave(database, session.gameId, session.saveId)
      database.close()
      if (file == null) throw new Error("save file does not exist")
      return { ok: true, token: session.token, operation: session.operation, file }
    }
    if (session.operation === "delete-save") {
      const paths = savePaths(session.gameId, session.saveId)
      const deleted = await deletePaths(database, [paths.main, paths.backup, paths.temporary])
      const saves = await listSaves(database, session.gameId)
      database.close()
      return { ok: true, token: session.token, operation: session.operation, deleted, saves }
    }
    const bytes = base64ToBytes(session.base64)
    if (bytes.length !== session.bytes || await sha256(bytes) !== session.sha256) {
      database.close()
      throw new Error("backup payload integrity mismatch")
    }
    await restoreSave(database, session.gameId, session.saveId, bytes)
    const file = await readSave(database, session.gameId, session.saveId)
    const saves = await listSaves(database, session.gameId)
    database.close()
    if (file == null || file.bytes !== session.bytes || file.sha256 !== session.sha256) {
      throw new Error("restored save readback mismatch")
    }
    return { ok: true, token: session.token, operation: session.operation, file, saves }
  }

  window.__gen1recompMaintenanceStart = (session) => {
    if (started || !validSession(session)) return false
    started = true
    void run(session).then(result).catch((error) => fail(session, error))
    return true
  }
})()
