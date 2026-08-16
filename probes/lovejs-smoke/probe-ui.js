(() => {
  "use strict"

  const rawLines = []
  const seenResults = new Set()
  const rawLog = document.getElementById("raw-log")
  const results = document.getElementById("probe-results")
  const statusDot = document.getElementById("status-dot")
  const statusTitle = document.getElementById("status-title")
  const statusDetail = document.getElementById("status-detail")

  function setStatus(status, title, detail) {
    statusDot.className = `status-dot ${status}`
    statusTitle.textContent = title
    statusDetail.textContent = detail
    document.documentElement.dataset.probeStatus = status
  }

  async function publish(status, detail) {
    const diagnosticCanvas = document.createElement("canvas")
    const report = {
      schemaVersion: 1,
      status,
      detail,
      lines: [...rawLines],
      userAgent: navigator.userAgent,
      crossOriginIsolated: window.crossOriginIsolated,
      webAssembly: typeof WebAssembly === "object",
      webgl1: diagnosticCanvas.getContext("webgl") !== null,
      webgl2: diagnosticCanvas.getContext("webgl2") !== null,
      observedAt: new Date().toISOString(),
    }
    try {
      await fetch("/__probe_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      })
    } catch (error) {
      nativeError("Could not publish local probe report", error)
    }
  }

  function appendResult(name, passed, detail) {
    const key = `${name}|${passed}|${detail}`
    if (seenResults.has(key)) return
    seenResults.add(key)
    const item = document.createElement("li")
    item.className = passed ? "pass" : "fail"
    const label = document.createElement("strong")
    label.textContent = name
    const description = document.createElement("span")
    description.textContent = detail
    item.append(label, description)
    results.append(item)
  }

  function consume(value, isError = false) {
    const line = String(value)
    rawLines.push(line)
    rawLog.textContent = rawLines.join("\n")
    rawLog.scrollTop = rawLog.scrollHeight

    if (line.startsWith("PROBE|")) {
      const [, name, state, ...detail] = line.split("|")
      appendResult(name || "unknown", state === "PASS", detail.join("|"))
    } else if (line.startsWith("PROBE_COMPLETE|")) {
      const [, state, detail = ""] = line.split("|")
      const passed = state === "PASS"
      setStatus(
        passed ? "pass" : "fail",
        passed ? "Runtime smoke test passed" : "Runtime loaded with failed checks",
        detail,
      )
      void publish(passed ? "pass" : "fail", detail)
    } else if (isError) {
      setStatus("fail", "Runtime error", line)
      void publish("error", line)
    }
  }

  const nativeLog = console.log.bind(console)
  const nativeError = console.error.bind(console)
  console.log = (...values) => {
    nativeLog(...values)
    values.forEach((value) => consume(value))
  }
  console.error = (...values) => {
    nativeError(...values)
    values.forEach((value) => consume(value, true))
  }

  window.Module = {
    print: (value) => consume(value),
    printErr: (value) => consume(value, true),
  }

  window.addEventListener("error", (event) => {
    consume(event.message || "Unknown window error", true)
  })
  window.addEventListener("unhandledrejection", (event) => {
    consume(`Unhandled rejection: ${String(event.reason)}`, true)
  })

  document.getElementById("copy-log").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(rawLines.join("\n"))
      setStatus("pass", "Probe log copied", "Paste it into the device report without editing.")
    } catch (error) {
      consume(`Could not copy log: ${String(error)}`, true)
    }
  })

  setStatus("pending", "Starting WebAssembly runtime…", "Waiting for structured Lua probe output.")
})()
