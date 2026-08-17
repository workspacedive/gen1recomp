(() => {
  "use strict"

  const lines = []
  const errors = []
  const consume = (value, error = false) => {
    const text = String(value)
    lines.push(text)
    if (error) errors.push(text)
  }

  window.Module = {
    print: (value) => consume(value),
    printErr: (value) => consume(value, true),
  }
  window.addEventListener("error", (event) => consume(event.message, true))
  window.addEventListener("unhandledrejection", (event) => consume(event.reason, true))

  window.setTimeout(async () => {
    const canvas = document.getElementById("canvas")
    const spinner = document.getElementById("spinner")
    const visible = getComputedStyle(canvas).display !== "none"
    const report = {
      schemaVersion: 1,
      status: visible && spinner.className !== "error" && errors.length === 0 ? "pass" : "fail",
      observedAt: new Date().toISOString(),
      canvas: { width: canvas.width, height: canvas.height, visible },
      spinner: spinner.className,
      loveFactory: typeof window.Love,
      lines,
      errors,
      scope: "ROM-free launcher boot outside Scripting",
    }
    document.documentElement.dataset.probeStatus = report.status
    try {
      await fetch("/__probe_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      })
    } catch (error) {
      console.error("Could not publish launcher report", error)
    }
  }, 10000)
})()
