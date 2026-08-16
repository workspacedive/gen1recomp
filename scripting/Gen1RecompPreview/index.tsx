import { Script } from "scripting"

const PROJECT_DIRECTORY_NAME = "Gen1Recomp Preview"
const LOG_HANDLER = "gen1recompLog"
const EVENT_HANDLER = "gen1recompEvent"
const LOG_PREFIX = "[Gen1Recomp Preview]"

function log(level: "info" | "warn" | "error", message: unknown): void {
  const text = `${LOG_PREFIX} ${String(message)}`
  if (level === "error") console.error(text)
  else if (level === "warn") console.warn(text)
  else console.log(text)
}

function escapeHTML(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

async function presentMessage(
  controller: WebViewController,
  title: string,
  detail: unknown,
): Promise<void> {
  await controller.loadHTML(`<!doctype html>
<html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body { font: -apple-system-body; padding: 24px; color: CanvasText; background: Canvas; } code { overflow-wrap: anywhere; }</style>
<h1>${escapeHTML(title)}</h1><p>${escapeHTML(detail)}</p></html>`)
  await controller.present({ navigationTitle: "Gen1Recomp Preview" })
}

async function saveDiagnostics(events: unknown[]): Promise<string> {
  const directory = `${FileManager.documentsDirectory}/Gen1Recomp Diagnostics`
  await FileManager.createDirectory(directory, true)
  const timestamp = new Date().toISOString().replaceAll(":", "-")
  const path = `${directory}/preview-${timestamp}.json`
  await FileManager.writeAsString(path, JSON.stringify({
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    events,
  }, null, 2))
  return path
}

async function run(): Promise<void> {
  const controller = new WebViewController({ ephemeral: false })
  const events: unknown[] = []
  try {
    await controller.addScriptMessageHandler(LOG_HANDLER, (entry?: {
      level?: string
      message?: string
    }) => {
      const level = entry?.level === "error"
        ? "error"
        : entry?.level === "warn" ? "warn" : "info"
      log(level, entry?.message ?? "empty WebView log")
      return { accepted: true }
    })
    await controller.addScriptMessageHandler(EVENT_HANDLER, (event: unknown) => {
      events.push(event)
      log("info", `event ${JSON.stringify(event)}`)
      return { accepted: true }
    })

    const projectDirectory = `${FileManager.scriptsDirectory}/${PROJECT_DIRECTORY_NAME}`
    const runtimeDirectory = `${projectDirectory}/runtime`
    const entryPath = `${runtimeDirectory}/index.html`
    log("info", `loading local runtime ${entryPath}`)
    if (!await FileManager.exists(entryPath)) {
      await presentMessage(controller, "Runtime bundle missing", entryPath)
      return
    }
    if (!await controller.loadFile(entryPath, runtimeDirectory)) {
      await presentMessage(controller, "Runtime page failed to load", entryPath)
      return
    }
    if (!await controller.waitForLoad()) {
      await presentMessage(controller, "Runtime load did not complete", entryPath)
      return
    }

    log("info", "presenting interactive ROM-free launcher")
    await controller.present({
      fullscreen: true,
      navigationTitle: "Gen1Recomp Preview",
    })

    log("info", "preview dismissed; requesting runtime flush and shutdown")
    try {
      const shutdown = await controller.evaluateJavaScript<unknown>(
        "return window.__gen1recompShutdown ? await window.__gen1recompShutdown() : { ok: false, error: 'shutdown bridge unavailable' }",
      )
      events.push({ type: "native.shutdown", result: shutdown })
      log("info", `shutdown ${JSON.stringify(shutdown)}`)
    } catch (error) {
      events.push({ type: "native.shutdown", error: String(error) })
      log("error", `shutdown evaluation failed: ${String(error)}`)
    }

    const reportPath = await saveDiagnostics(events)
    log("info", `diagnostics saved to ${reportPath}`)
    await presentMessage(
      controller,
      "Preview closed safely",
      `Diagnostics: ${reportPath}`,
    )
  } catch (error) {
    log("error", error)
    try {
      await presentMessage(controller, "Preview failed", error)
    } catch (presentationError) {
      log("error", `could not present failure: ${String(presentationError)}`)
    }
  } finally {
    controller.dispose()
    Script.exit()
  }
}

void run()
