(() => {
  "use strict"

  const evidence = { lines: [], errors: [] }
  const consume = (value, isError = false) => {
    const text = String(value)
    evidence.lines.push(text)
    if (isError) evidence.errors.push(text)
  }

  window.__loveJsSurfaceEvidence = evidence
  window.Module = {
    print: (value) => consume(value),
    printErr: (value) => consume(value, true),
  }
  window.addEventListener("error", (event) => consume(event.message, true))
  window.addEventListener("unhandledrejection", (event) => consume(event.reason, true))
})()
