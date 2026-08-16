import {
  BrowserLoveJsGameSurface,
  DomLoveJsBrowserBindings,
} from "./modules/runtime/adapters/lovejs/browser-surface.js"
import {
  LoveJsPersistenceAdapter,
} from "./modules/runtime/adapters/lovejs/persistence.js"
import {
  LoveJsRuntimePort,
} from "./modules/runtime/adapters/lovejs/runtime-port.js"

const bridge = window.__gen1recompPreview
const config = window.__gen1recompRuntimeConfig
const sessionId = `scripting-preview-${Date.now()}-${Math.random().toString(16).slice(2)}`
bridge.started = true
bridge.log("info", `session ${sessionId}`)
bridge.log("info", `love.js ${config.runtimeRevision}`)
bridge.log("info", `payload ${config.payload.sha256}`)

const bindings = new DomLoveJsBrowserBindings(window, document)
const surface = new BrowserLoveJsGameSurface(
  bindings,
  () => ({ ok: true, value: { uri: "gen1recomp.love", args: ["--scripting-preview"] } }),
  {
    startupTimeoutMs: 60_000,
    shutdownTimeoutMs: 15_000,
    pollIntervalMs: 25,
    pauseVerificationMs: 250,
    resumeVerificationMs: 500,
  },
)
const persistence = new LoveJsPersistenceAdapter(
  {
    syncfs: (populate, callback) => {
      const fileSystem = window.Module?.FS
      if (typeof fileSystem?.syncfs !== "function") {
        callback(new Error("love.js filesystem is unavailable"))
        return
      }
      fileSystem.syncfs(populate, callback)
    },
  },
  { timeoutMs: 10_000 },
)
const runtime = new LoveJsRuntimePort(
  {
    id: "org.gen1recomp.runtime.lovejs",
    version: "0.1.0",
    apiVersion: "1.0.0",
    luaVersion: "5.1",
    loveVersion: "11.5.0",
    capabilities: new Set([
      "lua51",
      "bitLibrary",
      "webAssembly",
      "webgl2",
      "persistentStorage",
    ]),
  },
  surface,
  persistence,
  { startupPersistence: "surface" },
)

const request = {
  sessionId,
  payloadVirtualPath: "components/core/0.1.96/gen1recomp.love",
  storageNamespace: "preview",
  query: {},
}
let shutdownPromise = null

window.__gen1recompShutdown = () => {
  if (shutdownPromise !== null) return shutdownPromise
  bridge.log("info", "flush and shutdown requested")
  shutdownPromise = runtime.stop().then(async (result) => {
    bridge.log(result.ok ? "info" : "error", `shutdown ${JSON.stringify(result)}`)
    await bridge.event({ type: "preview.shutdown", sessionId, result })
    return result
  })
  return shutdownPromise
}

async function start() {
  const booted = await runtime.boot(request)
  if (!booted.ok) {
    bridge.setStatus("fail", "Runtime failed", booted.error.message)
    bridge.log("error", booted.error.message)
    await bridge.event({
      type: "preview.error",
      stage: "boot",
      sessionId,
      error: booted.error,
    })
    return
  }

  await bindings.delay(500)
  bridge.ready = true
  const canvas = document.getElementById("canvas")
  const event = {
    type: "preview.ready",
    sessionId,
    runtimeRevision: config.runtimeRevision,
    payload: config.payload,
    userAgent: navigator.userAgent,
    crossOriginIsolated: window.crossOriginIsolated,
    frame: window.Module?.Browser?.mainLoop?.currentFrameNumber ?? null,
    surface: {
      width: canvas?.width ?? null,
      height: canvas?.height ?? null,
      visible: canvas !== null && getComputedStyle(canvas).display !== "none",
    },
  }
  bridge.setStatus("ready", "Gen1Recomp ready", "ROM-free launcher preview")
  bridge.log("info", `ready frame ${event.frame}`)
  await bridge.event(event)
}

void start().catch(async (error) => {
  const message = String(error)
  bridge.setStatus("fail", "Preview failed", message)
  bridge.log("error", message)
  await bridge.event({ type: "preview.error", stage: "uncaught", sessionId, message })
})
