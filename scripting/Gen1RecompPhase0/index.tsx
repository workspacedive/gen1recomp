import { Script } from "scripting"

const PROJECT_DIRECTORY_NAME = "Gen1Recomp Phase 0"
const MESSAGE_HANDLER = "gen1recompProbe"

function escapeHTML(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

async function presentFailure(
  controller: WebViewController,
  title: string,
  detail: unknown,
): Promise<void> {
  await controller.loadHTML(`<!doctype html>
<html lang="en">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { font: -apple-system-body; padding: 24px; color: CanvasText; background: Canvas; }
code { overflow-wrap: anywhere; }
</style>
<h1>${escapeHTML(title)}</h1>
<p>${escapeHTML(detail)}</p>
<p>Dismiss this view and export the non-personal diagnostic result.</p>
</html>`)
  await controller.present({
    fullscreen: true,
    navigationTitle: "Gen1Recomp Phase 0",
  })
}

async function run(): Promise<void> {
  const controller = new WebViewController({ ephemeral: false })
  let latestReport: unknown = null
  try {
    await controller.addScriptMessageHandler(MESSAGE_HANDLER, (report: unknown) => {
      latestReport = report
      return { accepted: true }
    })

    const projectDirectory = `${FileManager.scriptsDirectory}/${PROJECT_DIRECTORY_NAME}`
    const runtimeDirectory = `${projectDirectory}/runtime`
    const entryPath = `${runtimeDirectory}/index.html`
    if (!await FileManager.exists(entryPath)) {
      await presentFailure(controller, "Runtime bundle missing", entryPath)
      return
    }

    const loaded = await controller.loadFile(entryPath, runtimeDirectory)
    if (!loaded || !await controller.waitForLoad()) {
      await presentFailure(controller, "Runtime page failed to load", entryPath)
      return
    }

    await controller.present({
      fullscreen: true,
      navigationTitle: "Gen1Recomp Phase 0",
    })

    if (latestReport == null) {
      console.warn("Gen1Recomp Phase 0 closed before a diagnostic report arrived")
    } else {
      const diagnosticsDirectory = `${FileManager.documentsDirectory}/Gen1Recomp Diagnostics`
      await FileManager.createDirectory(diagnosticsDirectory, true)
      const timestamp = new Date().toISOString().replaceAll(":", "-")
      const reportPath = `${diagnosticsDirectory}/phase0-${timestamp}.json`
      await FileManager.writeAsString(reportPath, JSON.stringify(latestReport, null, 2))
      await controller.loadHTML(`<!doctype html>
<html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body { font: -apple-system-body; padding: 24px; color: CanvasText; background: Canvas; } code { overflow-wrap: anywhere; }</style>
<h1>Diagnostic report saved</h1><p>The report contains synthetic runtime measurements and no ROM data.</p><code>${escapeHTML(reportPath)}</code></html>`)
      await controller.present({
        navigationTitle: "Gen1Recomp Diagnostics",
      })
    }
  } catch (error) {
    console.error("Gen1Recomp Phase 0 failed", String(error))
    try {
      await presentFailure(controller, "Probe failed", error)
    } catch (presentationError) {
      console.error("Could not present probe failure", String(presentationError))
    }
  } finally {
    controller.dispose()
    Script.exit()
  }
}

void run()
