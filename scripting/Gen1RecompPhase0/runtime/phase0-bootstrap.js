(() => {
  "use strict"

  const evidence = { lines: [], errors: [] }
  const consume = (value, isError = false) => {
    const text = String(value)
    evidence.lines.push(text)
    if (isError) evidence.errors.push(text)
  }
  const send = async (report) => {
    const handler = window.webkit?.messageHandlers?.gen1recompProbe
    if (handler) await handler.postMessage(report)
  }
  const setStatus = (result, title, detail) => {
    const status = document.getElementById("status")
    const titleNode = document.getElementById("status-title")
    const detailNode = document.getElementById("status-detail")
    status.dataset.result = result
    document.documentElement.dataset.probeStatus = result
    titleNode.textContent = title
    detailNode.textContent = detail
  }

  const failBundle = (stage, message) => {
    const probe = window.__gen1recompPhase0
    if (probe.started || probe.finished) return
    const report = {
      schemaVersion: 1,
      status: "error",
      observedAt: new Date().toISOString(),
      stage,
      message,
      lines: evidence.lines,
      errors: evidence.errors,
    }
    probe.finished = true
    setStatus("fail", "Runtime script failed", message)
    void send(report)
  }
  const loadBundle = (source) => {
    const script = document.createElement("script")
    script.src = source
    script.async = false
    script.onerror = () => failBundle("bundle-load", `Could not load ${source}`)
    script.onload = () => window.setTimeout(() => {
      if (!window.__gen1recompPhase0.started) {
        failBundle(
          "bundle-execution",
          `${source} loaded but did not execute; likely WebKit syntax/runtime incompatibility`,
        )
      }
    }, 250)
    document.body.appendChild(script)
  }

  window.__gen1recompPhase0 = {
    evidence,
    send,
    setStatus,
    loadBundle,
    started: false,
    finished: false,
  }
  window.Module = {
    print: (value) => consume(value),
    printErr: (value) => consume(value, true),
  }
  window.addEventListener("error", (event) => consume(event.message, true))
  window.addEventListener("unhandledrejection", (event) => consume(event.reason, true))

  window.setTimeout(() => {
    const probe = window.__gen1recompPhase0
    if (probe.started || probe.finished) return
    failBundle("bundle-timeout", "The local Phase-0 bundle did not start")
  }, 5000)
})()
