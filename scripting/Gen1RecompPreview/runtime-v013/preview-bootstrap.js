(() => {
  "use strict"

  const evidence = { lines: [], errors: [] }
  const post = async (name, value) => {
    const handler = window.webkit?.messageHandlers?.[name]
    if (handler) await handler.postMessage(value)
  }
  const log = (level, value) => {
    const message = String(value)
    evidence.lines.push(message)
    if (level === "error") evidence.errors.push(message)
    void post("gen1recompLog", { level, message })
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
    if (preview.started || preview.ready || preview.failed) return
    failBundle("bundle-timeout", "The local preview bundle did not start")
  }, 8000)
})()
