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

  window.__gen1recompPreview = {
    evidence,
    log,
    event,
    setStatus,
    started: false,
    ready: false,
  }
  window.Module = {
    print: (value) => log("info", value),
    printErr: (value) => log("error", value),
  }
  window.addEventListener("error", (eventValue) => log("error", eventValue.message))
  window.addEventListener("unhandledrejection", (eventValue) => log("error", eventValue.reason))

  window.setTimeout(() => {
    const preview = window.__gen1recompPreview
    if (preview.started || preview.ready) return
    const message = "The local preview module did not start"
    setStatus("fail", "Runtime module failed", message)
    log("error", message)
    void event({ type: "preview.error", stage: "module-load", message })
  }, 8000)
})()
