window.__gen1recompPreview.log("info", "runtime identity 0.4.1 / 041")
if (window.__gen1recompPreview.installEmbeddedPackages()) {
  let launched = false
  window.__gen1recompStart = (session) => {
    if (launched) return false
    launched = true
    window.__gen1recompHostSession = session
    window.__gen1recompPreview.loadBundle("preview-bundle.js")
    return true
  }
}
