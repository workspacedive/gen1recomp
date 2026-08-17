(() => {
  "use strict"

  const result = (value) => { window.__gen1recompMaintenanceResult = value }
  const fail = (token, error) => result({ ok: false, token, deleted: 0, error: String(error) })
  const gameIds = new Set(["red", "blue", "yellow", "gold"])
  const saveRoot = "/home/web_user/.local/share/love/pokemon-love2d"
  let started = false

  function validSession(session) {
    return session?.schemaVersion === 1 && session?.mode === "maintenance"
      && session?.operation === "delete-cache" && typeof session?.token === "string"
      && gameIds.has(session?.gameId)
  }

  function deleteCache(gameId) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("/home/web_user", 21)
      let creationAborted = false
      request.onerror = () => {
        if (creationAborted) resolve(0)
        else reject(request.error ?? new Error("could not open private runtime storage"))
      }
      request.onupgradeneeded = () => {
        // Deletion must never create or migrate love.js storage. An absent DB
        // means there is no cache; an older schema belongs to its runtime.
        creationAborted = true
        request.transaction.abort()
      }
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction(["FILE_DATA"], "readwrite")
        const store = transaction.objectStore("FILE_DATA")
        const prefix = `${saveRoot}/${gameId}`
        let deleted = 0
        transaction.onerror = () => reject(transaction.error ?? new Error("private cache deletion failed"))
        transaction.oncomplete = () => {
          database.close()
          resolve(deleted)
        }
        const cursorRequest = store.openCursor()
        cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error("private cache scan failed"))
        cursorRequest.onsuccess = (event) => {
          const cursor = event.target.result
          if (cursor == null) return
          if (typeof cursor.key === "string" && (cursor.key === prefix || cursor.key.startsWith(`${prefix}/`))) {
            cursor.delete()
            deleted += 1
          }
          cursor.continue()
        }
      }
    })
  }

  window.__gen1recompMaintenanceStart = (session) => {
    if (started || !validSession(session)) return false
    started = true
    void deleteCache(session.gameId).then((deleted) => {
      result({ ok: true, token: session.token, deleted })
    }).catch((error) => fail(session.token, error))
    return true
  }
})()
