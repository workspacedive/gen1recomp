import {
  BrowserLoveJsGameSurface,
  DomLoveJsBrowserBindings,
} from "/.tmp/ts/runtime/adapters/lovejs/browser-surface.js"
import {
  LoveJsPersistenceAdapter,
} from "/.tmp/ts/runtime/adapters/lovejs/persistence.js"
import {
  LoveJsRuntimePort,
} from "/.tmp/ts/runtime/adapters/lovejs/runtime-port.js"

const evidence = window.__loveJsSurfaceEvidence
const bindings = new DomLoveJsBrowserBindings(window, document)
const surface = new BrowserLoveJsGameSurface(
  bindings,
  () => ({
    ok: true,
    value: { uri: "gen1recomp.love", args: ["--runtime-surface-probe"] },
  }),
  {
    startupTimeoutMs: 30_000,
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
  sessionId: "outside-browser-surface-1",
  payloadVirtualPath: "components/core/0.1.96/gen1recomp.love",
  storageNamespace: "surface-probe",
  query: {},
}

function resultValue(result) {
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

async function publish(report) {
  window.__loveJsSurfaceReport = report
  document.documentElement.dataset.probeStatus = report.status
  try {
    await fetch("/__probe_report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    })
  } catch (error) {
    evidence.errors.push(`report publish failed: ${String(error)}`)
  }
}

async function run() {
  const manifestResponse = await fetch(
    "/research/downloads/gen1recomp/lovejs-launcher/launcher-manifest.json",
  )
  if (!manifestResponse.ok) throw new Error("launcher manifest could not be loaded")
  const manifest = await manifestResponse.json()
  const report = {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    scope: "pinned love.js browser surface lifecycle outside Scripting",
    runtimeRevision: manifest.runtimeRevision,
    payload: {
      sha256: manifest.preparedPayload.sha256,
      bytes: manifest.preparedPayload.size,
      entries: manifest.preparedPayload.entries,
    },
    environment: {
      userAgent: navigator.userAgent,
      crossOriginIsolated: window.crossOriginIsolated,
    },
    boot: null,
    suspend: null,
    resume: null,
    stop: null,
    frames: {},
    lines: evidence.lines,
    errors: evidence.errors,
    status: "fail",
  }

  const booted = await runtime.boot(request)
  report.boot = resultValue(booted)
  if (!booted.ok) return publish(report)

  await bindings.delay(1000)
  report.frames.running = window.Module?.Browser?.mainLoop?.currentFrameNumber ?? null
  const canvas = document.getElementById("canvas")
  report.surface = {
    width: canvas?.width ?? null,
    height: canvas?.height ?? null,
    visible: canvas !== null && getComputedStyle(canvas).display !== "none",
  }

  const suspended = await runtime.suspend("browser-probe")
  report.suspend = resultValue(suspended)
  report.frames.suspended = window.Module?.Browser?.mainLoop?.currentFrameNumber ?? null
  if (!suspended.ok) return publish(report)

  const resumed = await runtime.resume()
  report.resume = resultValue(resumed)
  report.frames.resumed = window.Module?.Browser?.mainLoop?.currentFrameNumber ?? null
  if (!resumed.ok) return publish(report)

  const stopped = await runtime.stop()
  report.stop = resultValue(stopped)
  report.frames.stopped = window.Module?.Browser?.mainLoop?.currentFrameNumber ?? null
  report.moduleDone = window.Module?.done === true
  report.status = stopped.ok && report.moduleDone && evidence.errors.length === 0
    ? "pass"
    : "fail"
  return publish(report)
}

void run().catch((error) => {
  evidence.errors.push(`surface probe threw: ${String(error)}`)
  void publish({
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    scope: "pinned love.js browser surface lifecycle outside Scripting",
    status: "error",
    error: String(error),
    lines: evidence.lines,
    errors: evidence.errors,
  })
})
