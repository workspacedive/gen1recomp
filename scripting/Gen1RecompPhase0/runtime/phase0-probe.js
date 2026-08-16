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

const bridge = window.__gen1recompPhase0
const config = window.__gen1recompRuntimeConfig
const sessionId = `scripting-phase0-${Date.now()}-${Math.random().toString(16).slice(2)}`
bridge.started = true

const bindings = new DomLoveJsBrowserBindings(window, document)
const surface = new BrowserLoveJsGameSurface(
  bindings,
  () => ({
    ok: true,
    value: { uri: "gen1recomp.love", args: ["--scripting-phase0"] },
  }),
  {
    startupTimeoutMs: 45_000,
    shutdownTimeoutMs: 10_000,
    pollIntervalMs: 25,
    pauseVerificationMs: 500,
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
  { timeoutMs: 5000 },
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
  storageNamespace: "phase0-probe",
  query: {},
}

function resultValue(result) {
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

async function finish(report) {
  bridge.finished = true
  window.__gen1recompPhase0Report = report
  const passed = report.status === "pass"
  bridge.setStatus(
    passed ? "pass" : "fail",
    passed ? "Runtime lifecycle passed" : "Runtime lifecycle failed",
    passed
      ? "Boot, suspend flush, resume, stop flush, and disposal completed. Dismiss to return."
      : "Dismiss and review the attributed diagnostic report.",
  )
  await bridge.send(report)
}

async function run() {
  const report = {
    schemaVersion: 1,
    purpose: "physical-scripting-phase0",
    sessionId,
    observedAt: new Date().toISOString(),
    runtimeRevision: config.runtimeRevision,
    payload: config.payload,
    environment: {
      userAgent: navigator.userAgent,
      crossOriginIsolated: window.crossOriginIsolated,
    },
    boot: null,
    suspend: null,
    resume: null,
    stop: null,
    frames: {},
    surface: null,
    moduleDone: false,
    lines: bridge.evidence.lines,
    errors: bridge.evidence.errors,
    status: "fail",
  }

  const booted = await runtime.boot(request)
  report.boot = resultValue(booted)
  if (!booted.ok) return finish(report)

  await bindings.delay(1000)
  report.frames.running = window.Module?.Browser?.mainLoop?.currentFrameNumber ?? null
  const canvas = document.getElementById("canvas")
  report.surface = {
    width: canvas?.width ?? null,
    height: canvas?.height ?? null,
    visible: canvas !== null && getComputedStyle(canvas).display !== "none",
  }

  const suspended = await runtime.suspend("scripting-phase0")
  report.suspend = resultValue(suspended)
  report.frames.suspended = window.Module?.Browser?.mainLoop?.currentFrameNumber ?? null
  if (!suspended.ok) return finish(report)

  const resumed = await runtime.resume()
  report.resume = resultValue(resumed)
  report.frames.resumed = window.Module?.Browser?.mainLoop?.currentFrameNumber ?? null
  if (!resumed.ok) return finish(report)

  const stopped = await runtime.stop()
  report.stop = resultValue(stopped)
  report.frames.stopped = window.Module?.Browser?.mainLoop?.currentFrameNumber ?? null
  report.moduleDone = window.Module?.done === true
  report.status = stopped.ok && report.moduleDone && bridge.evidence.errors.length === 0
    ? "pass"
    : "fail"
  return finish(report)
}

void run().catch((error) => {
  bridge.evidence.errors.push(String(error))
  void finish({
    schemaVersion: 1,
    purpose: "physical-scripting-phase0",
    sessionId,
    observedAt: new Date().toISOString(),
    status: "error",
    message: String(error),
    lines: bridge.evidence.lines,
    errors: bridge.evidence.errors,
  })
})
