window.__gen1recompPreview.log("info", "runtime identity 0.5.2 / 052")
if (window.__gen1recompPreview.installEmbeddedPackages()) {
  let launched = false
  window.__gen1recompStart = (session) => {
    if (launched) return false
    launched = true
    window.__gen1recompHostSession = session
    window.__gen1recompPreview.launchPending = true
    const requestedAt = performance.now()
    let stableGeometry = ""
    let stableSince = requestedAt
    const launchWhenVisible = () => {
      const width = Math.round(window.innerWidth)
      const height = Math.round(window.innerHeight)
      const geometry = `${width}x${height}`
      const valid = Math.min(width, height) >= 240 && Math.max(width, height) >= 320
      if (geometry !== stableGeometry) {
        stableGeometry = geometry
        stableSince = performance.now()
      }
      if (valid && performance.now() - stableSince >= 250) {
        window.__gen1recompPreview.launchPending = false
        window.__gen1recompPreview.log("info", `visible viewport ${geometry}; starting runtime`)
        window.__gen1recompPreview.loadBundle("preview-bundle.js")
        return
      }
      if (performance.now() - requestedAt >= 15_000) {
        window.__gen1recompPreview.launchPending = false
        const message = `WebView viewport remained ${width}x${height}`
        window.__gen1recompPreview.failed = true
        window.__gen1recompPreview.setStatus("fail", "Viewport unavailable", message)
        window.__gen1recompPreview.log("error", `viewport-timeout: ${message}`)
        void window.__gen1recompPreview.event({ type: "preview.error", stage: "viewport-timeout", message })
        return
      }
      window.setTimeout(launchWhenVisible, 25)
    }
    launchWhenVisible()
    return true
  }
}
