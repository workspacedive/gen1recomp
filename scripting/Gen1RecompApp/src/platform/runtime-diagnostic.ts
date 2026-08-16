import { PRODUCT } from "../config/product"
import type { SystemUpdateService } from "../data/system-update-service"

export type RuntimeDiagnosticResult = {
  readonly ready: boolean
  readonly usedUpdatedComponents: boolean
  readonly errors: readonly string[]
}

export async function runRuntimeDiagnostic(
  updates: SystemUpdateService,
): Promise<RuntimeDiagnosticResult> {
  const state = await updates.loadState()
  const packaged = `${FileManager.scriptsDirectory}/${PRODUCT.projectDirectoryName}/${PRODUCT.packagedRuntimeDirectory}`
  let runtimeRoot = state.activeRuntimeRoot ?? packaged
  let usedUpdatedComponents = state.activeRuntimeRoot != null
  const entry = `${runtimeRoot}/index.html`
  if (usedUpdatedComponents) {
    const configPath = `${runtimeRoot}/runtime-config.js`
    let compatible = false
    try {
      compatible = await FileManager.exists(entry) && await FileManager.exists(configPath)
        && (await FileManager.readAsString(configPath)).includes("\"hostSessionProtocol\":1")
    } catch {
      compatible = false
    }
    if (!compatible) {
      runtimeRoot = packaged
      usedUpdatedComponents = false
    }
  }
  if (!await FileManager.exists(`${runtimeRoot}/index.html`)) throw new Error("runtime_missing")

  const controller = new WebViewController({ ephemeral: false })
  const errors: string[] = []
  let ready = false
  try {
    await controller.addScriptMessageHandler("gen1recompLog", (entry?: { level?: string; message?: string }) => {
      const message = entry?.message ?? "empty runtime log"
      if (entry?.level === "error") {
        errors.push(message)
        console.error(`[Gen1Recomp Native] ${message}`)
      } else if (entry?.level === "warn") {
        console.warn(`[Gen1Recomp Native] ${message}`)
      } else {
        console.log(`[Gen1Recomp Native] ${message}`)
      }
      return { accepted: true }
    })
    await controller.addScriptMessageHandler("gen1recompEvent", (event?: { type?: string; stage?: string; message?: string }) => {
      if (event?.type === "preview.ready") ready = true
      if (event?.type === "preview.error") errors.push(`${event.stage ?? "runtime"}: ${event.message ?? "unknown error"}`)
      return { accepted: true }
    })
    if (!await controller.loadFile(`${runtimeRoot}/index.html`, runtimeRoot) || !await controller.waitForLoad()) {
      throw new Error("runtime_load_failed")
    }
    const started = await controller.evaluateJavaScript<boolean>(
      "return window.__gen1recompStart({schemaVersion:1,mode:'diagnostic'})",
    )
    if (started !== true) throw new Error("runtime_session_rejected")
    await controller.present({ fullscreen: true, navigationTitle: "Gen1Recomp Runtime" })
    // Scripting resolves present only after dismissal. Evaluating JavaScript here would target a destroyed
    // page on affected builds, so Preview 0.1.4's post-dismiss flush is intentionally not repeated.
  } catch (error) {
    errors.push(String(error))
  } finally {
    controller.dispose()
  }
  if (usedUpdatedComponents && !ready) await updates.rollbackAfterRuntimeFailure()
  return { ready, usedUpdatedComponents, errors }
}
