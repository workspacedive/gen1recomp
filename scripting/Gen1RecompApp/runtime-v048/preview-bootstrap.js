(() => {
  "use strict"

  const evidence = { lines: [], errors: [] }
  const post = async (name, value) => {
    const handler = window.webkit?.messageHandlers?.[name]
    if (handler) await handler.postMessage(value)
  }
  const log = (level, value) => {
    const message = String(value).slice(0, 8000)
    evidence.lines.push(message)
    if (level === "error") evidence.errors.push(message)
    void post("gen1recompLog", { level, message })
  }
  const consoleValue = (value) => {
    if (value instanceof Error) return value.stack || value.message
    if (typeof value === "string") return value
    try { return JSON.stringify(value) } catch { return String(value) }
  }
  for (const [method, level] of [["log", "info"], ["warn", "warn"], ["error", "error"]]) {
    const original = typeof console?.[method] === "function" ? console[method].bind(console) : null
    if (original == null) continue
    console[method] = (...values) => {
      original(...values)
      log(level, values.map(consoleValue).join(" "))
    }
  }
  const originalAlert = typeof window.alert === "function" ? window.alert.bind(window) : null
  window.alert = (value) => {
    const message = consoleValue(value)
    log("error", `Web alert: ${message}`)
    if (message.includes("An error occurred before the game window could be initialised")) {
      const status = document.getElementById("status")
      if (status != null) status.dataset.result = "fail"
      return
    }
    if (originalAlert != null) originalAlert(value)
  }
  const setStatus = (result, title, detail) => {
    const status = document.getElementById("status")
    status.dataset.result = result
    document.getElementById("status-title").textContent = title
    document.getElementById("status-detail").textContent = detail
  }
  const event = (value) => post("gen1recompEvent", value)

  const failBundle = (stage, message) => {
    const preview = window.__gen1recompPreview
    if (preview.failed || preview.started) return
    preview.failed = true
    setStatus("fail", "Runtime script failed", message)
    log("error", `${stage}: ${message}`)
    void event({ type: "preview.error", stage, message })
  }
  const decodeBase64 = (value) => {
    const binary = atob(value)
    const output = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      output[index] = binary.charCodeAt(index)
    }
    return output
  }
  const installEmbeddedPackages = () => {
    const player = window.Player
    const encoded = window.__gen1recompEmbeddedPackages
    if (!player || !encoded) {
      failBundle("embedded-install", "Player or embedded package table is unavailable")
      return false
    }
    const decoded = Object.create(null)
    player.cache = false
    player.requestPkg = (uri) => new Promise((resolve, reject) => {
      if (decoded[uri]) {
        resolve({ data: decoded[uri], name: uri })
        return
      }
      const value = encoded[uri]
      if (typeof value !== "string") {
        const message = `embedded package unavailable: ${uri}`
        log("error", message)
        reject(message)
        return
      }
      try {
        const data = decodeBase64(value)
        decoded[uri] = data
        delete encoded[uri]
        log("info", `embedded package ready ${uri} (${data.length} bytes)`)
        resolve({ data, name: uri })
      } catch (error) {
        log("error", `embedded package decode failed ${uri}: ${String(error)}`)
        reject(error)
      }
    })
    log("info", "embedded package adapter installed")
    return true
  }
  const loadBundle = (source) => {
    log("info", `loading classic bundle ${source}`)
    const script = document.createElement("script")
    script.src = source
    script.async = false
    script.onerror = () => failBundle("bundle-load", `Could not load ${source}`)
    script.onload = () => {
      log("info", `classic bundle resource loaded ${source}`)
      window.setTimeout(() => {
        if (!window.__gen1recompPreview.started) {
          failBundle(
            "bundle-execution",
            `${source} loaded but did not execute; likely WebKit syntax/runtime incompatibility`,
          )
        }
      }, 250)
    }
    document.body.appendChild(script)
  }

  window.__gen1recompPreview = {
    evidence,
    log,
    event,
    setStatus,
    installEmbeddedPackages,
    loadBundle,
    started: false,
    ready: false,
    failed: false,
  }
  window.Module = {
    print: (value) => log("info", value),
    printErr: (value) => log("error", value),
  }
  window.addEventListener("error", (eventValue) => log("error", eventValue.message))
  window.addEventListener("unhandledrejection", (eventValue) => log("error", eventValue.reason))

  window.setTimeout(() => {
    const preview = window.__gen1recompPreview
    if (preview.started || preview.ready || preview.failed || preview.launchPending) return
    failBundle("bundle-timeout", "The local preview bundle did not start")
  }, 8000)
})()
