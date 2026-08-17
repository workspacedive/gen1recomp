import {
  BrowserLoveJsGameSurface,
  DomLoveJsBrowserBindings,
} from "../../../runtime/adapters/lovejs/browser-surface.ts"
import {
  LoveJsPersistenceAdapter,
} from "../../../runtime/adapters/lovejs/persistence.ts"
import {
  LoveJsRuntimePort,
} from "../../../runtime/adapters/lovejs/runtime-port.ts"
import {
  planLoveJsViewport,
} from "../../../runtime/adapters/lovejs/viewport.ts"

const bridge = window.__gen1recompPreview
const config = window.__gen1recompRuntimeConfig
const sessionId = `scripting-${Date.now()}-${Math.random().toString(16).slice(2)}`
const identities = Object.freeze({
  red: { size: 1048576, sha1: "ea9bcae617fdf159b045185467ae58b2e4a48b9a", saveSuffix: "" },
  blue: { size: 1048576, sha1: "d7037c83e1ae5b39bde3c30787637ba1d4c48ce2", saveSuffix: "_blue" },
  yellow: { size: 1048576, sha1: "cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1", saveSuffix: "_yellow" },
  gold: { size: 2097152, sha1: "d8b8a3600a465308c9953dfa04f0081c05bdcb94", saveSuffix: "_gold" },
})
const saveRoot = "/home/web_user/.local/share/love/pokemon-love2d"
const pickedRomPath = `${saveRoot}/picked_rom.gb`
const gen1CacheFiles = [
  "data/generated/constants.lua",
  "data/generated/maps.lua",
  "data/generated/text.lua",
  "data/generated/field.lua",
  "data/generated/battle_anims.lua",
  "assets/generated/title/pokemon_logo.png",
  "assets/generated/fonts/font.png",
  "assets/generated/battle/front/pikachu.png",
  "assets/generated/battle/anims/move_anim_0.png",
  "assets/generated/battle/anims/move_anim_1.png",
  "assets/generated/audio/programs.bin",
  "assets/generated/trade/game_boy.png",
]
const requiredCacheFiles = Object.freeze({
  red: gen1CacheFiles,
  blue: gen1CacheFiles,
  yellow: [...gen1CacheFiles,
    "assets/generated/battle/trainers/jessie_james.png",
    "assets/generated/battle/profoakb.png",
    "assets/generated/pikachu/pikapic_1.png",
  ],
  gold: [
    "data/generated/constants.lua", "data/generated/maps.lua", "data/generated/roofs.lua",
    "data/generated/sprites.lua", "data/generated/scripts.lua", "data/generated/text.lua",
    "data/generated/pokemon.lua", "data/generated/tilesets.lua", "data/generated/audio.lua",
    "data/generated/marts.lua", "assets/generated/fonts/font.png",
    "assets/generated/fonts/frames.png", "assets/generated/title/pokemon_logo.png",
    "assets/generated/title/title_screen.png", "assets/generated/title/hooh.png",
    "assets/generated/title/hooh_5.png", "assets/generated/title/clouds.png",
    "assets/generated/title/copyright_splash.png", "data/generated/oak_speech.lua",
    "assets/generated/intro/oak.png", "assets/generated/intro/cal.png",
    "assets/generated/tilesets/johto.png", "assets/generated/tilesets/roofs/new_bark.png",
    "assets/generated/sprites/chris.png", "assets/generated/battle/front/chikorita.png",
    "assets/generated/battle/front/pikachu.png", "assets/generated/battle/front/marill.png",
    "assets/generated/battle/trainers/falkner.png", "assets/generated/audio/programs.bin",
  ],
})

bridge.started = true
bridge.log("info", `session ${sessionId}`)
bridge.log("info", `love.js ${config.runtimeRevision}`)
bridge.log("info", `payload ${config.payload.sha256}`)

function decodeBase64(value) {
  const binary = atob(value)
  const output = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index)
  return output
}

const nativeViewport = planLoveJsViewport(
  window.innerWidth,
  window.innerHeight,
  window.devicePixelRatio,
)

function installNativeViewport() {
  window.Module.env = {
    ...(window.Module.env ?? {}),
    POKEPORT_VIEW_WIDTH: String(nativeViewport.width),
    POKEPORT_VIEW_HEIGHT: String(nativeViewport.height),
  }
  bridge.log(
    "info",
    `viewport ${nativeViewport.cssWidth}x${nativeViewport.cssHeight} CSS -> `
      + `${nativeViewport.width}x${nativeViewport.height} canvas, `
      + `scale ${nativeViewport.gameScale}, ${nativeViewport.orientation}, `
      + `DPR ${nativeViewport.devicePixelRatio}`,
  )
}

function startPerformanceTelemetry() {
  let phase = "startup"
  let previous = null
  let startedAt = performance.now()
  let intervals = []
  let longTaskCount = 0
  let longTaskTotalMs = 0
  let longTaskMaxMs = 0
  let longTaskSupported = false

  const observer = typeof PerformanceObserver === "function"
    ? new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTaskCount += 1
        longTaskTotalMs += entry.duration
        longTaskMaxMs = Math.max(longTaskMaxMs, entry.duration)
      }
    })
    : null
  if (observer != null) {
    try {
      observer.observe({ type: "longtask", buffered: true })
      longTaskSupported = true
    } catch {
      // WebKit does not currently have to expose the Long Tasks API. RAF gaps
      // below remain the portable measurement path.
    }
  }

  const sample = (now) => {
    if (previous != null) intervals.push(now - previous)
    previous = now
    window.requestAnimationFrame(sample)
  }
  window.requestAnimationFrame(sample)

  const percentile = (sorted, fraction) => {
    if (sorted.length === 0) return null
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
  }
  window.setInterval(() => {
    const endedAt = performance.now()
    const sorted = [...intervals].sort((left, right) => left - right)
    const report = {
      type: "preview.performance",
      sessionId,
      phase,
      startedAtMs: Math.round(startedAt),
      endedAtMs: Math.round(endedAt),
      durationMs: Math.round(endedAt - startedAt),
      animationFrames: sorted.length,
      intervalMs: {
        p50: percentile(sorted, 0.50),
        p95: percentile(sorted, 0.95),
        p99: percentile(sorted, 0.99),
        max: sorted.length === 0 ? null : sorted[sorted.length - 1],
      },
      gaps: {
        over25ms: sorted.filter((value) => value > 25).length,
        over50ms: sorted.filter((value) => value > 50).length,
        over100ms: sorted.filter((value) => value > 100).length,
        over250ms: sorted.filter((value) => value > 250).length,
      },
      longTasks: {
        supported: longTaskSupported,
        count: longTaskCount,
        totalMs: longTaskTotalMs,
        maxMs: longTaskMaxMs,
      },
      visibility: document.visibilityState,
      runtimeFrame: window.Module?.Browser?.mainLoop?.currentFrameNumber ?? null,
    }
    bridge.log("info", `performance ${JSON.stringify(report)}`)
    void bridge.event(report)
    startedAt = endedAt
    intervals = []
    longTaskCount = 0
    longTaskTotalMs = 0
    longTaskMaxMs = 0
  }, 10_000)

  return {
    ready() { phase = "runtime" },
  }
}

function loadHostSession() {
  const value = window.__gen1recompHostSession
  window.__gen1recompHostSession = null
  if (value?.schemaVersion === 1 && value?.mode === "diagnostic") return null
  if (value?.schemaVersion !== 1 || value?.mode !== "game" || typeof value?.token !== "string"
      || !Object.prototype.hasOwnProperty.call(identities, value?.gameId)
      || !Array.isArray(value?.arguments) || !value.arguments.every((item) => typeof item === "string")) {
    throw new Error("host session is invalid")
  }
  if (value.rom != null) {
    const identity = identities[value.gameId]
    if (value.rom?.size !== identity.size || value.rom?.sha1 !== identity.sha1
        || typeof value.rom?.base64 !== "string") throw new Error("host ROM session is invalid")
  }
  return value
}

function installRomInjection(hostSession, bytes) {
  const module = window.Module
  module.env = {
    ...(module.env ?? {}),
    POKEPORT_GAME: hostSession.gameId,
    POKEPORT_VERSION: hostSession.gameId,
    // love.js reports "Web", so upstream's mobile-only overlay would stay
    // hidden even inside iOS WKWebView. Use its documented host override;
    // touch events still travel through LÖVE's native touch callbacks.
    POKEPORT_TOUCH: "1",
    // Physical Native 045 telemetry shows periodic 50-105 ms gaps at the
    // no-worker synchronous music path's 8192-sample hand-off cadence.
    // Keep identical 44.1 kHz PCM synthesis, but opt into bounded slices.
    POKEPORT_AUDIO_SLICE: "1",
  }
  if (bytes == null) return
  module.env.POKEPORT_IMPORT_ROM = pickedRomPath

  let playerPrerun = null
  Object.defineProperty(module, "prerun", {
    configurable: true,
    get: () => () => {
      if (typeof playerPrerun === "function") playerPrerun()
      const fileSystem = module.FS
      const originalSync = fileSystem.syncfs.bind(fileSystem)
      let pendingBytes = bytes
      fileSystem.syncfs = (populate, callback) => {
        if (!populate || pendingBytes == null) {
          originalSync(populate, callback)
          return
        }
        originalSync(true, (error) => {
          if (error == null) {
            fileSystem.mkdirTree(saveRoot)
            fileSystem.writeFile(pickedRomPath, pendingBytes)
            pendingBytes = null
            sessionStorage.setItem(`gen1recomp-consumed-${hostSession.token}`, "1")
            void bridge.event({ type: "host.sessionConsumed", token: hostSession.token, gameId: hostSession.gameId })
          }
          callback(error)
        })
      }
    },
    set: (value) => { playerPrerun = value },
  })
}

function readMarker(gameId) {
  try {
    return window.Module.FS.readFile(`${saveRoot}/${gameId}/rom-cache.complete`, { encoding: "utf8" })
  } catch {
    return null
  }
}

function completeCacheExists(gameId, expectedMarker) {
  if (readMarker(gameId) !== expectedMarker) return false
  const fileSystem = window.Module.FS
  return requiredCacheFiles[gameId].every((relative) => {
    try {
      return fileSystem.isFile(fileSystem.stat(`${saveRoot}/${gameId}/${relative}`).mode)
    } catch {
      return false
    }
  })
}

function modifiedAt(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function discoverSaves(gameId) {
  const fileSystem = window.Module.FS
  const identity = identities[gameId]
  const saves = []
  const add = (id, path) => {
    try {
      const stat = fileSystem.stat(path)
      if (!fileSystem.isFile(stat.mode)) return
      saves.push({ id, bytes: stat.size, modifiedAt: modifiedAt(stat.mtime) })
    } catch {
      // A missing save is an ordinary empty library.
    }
  }
  add("legacy", `${saveRoot}/save${identity.saveSuffix}.lua`)
  const directory = `${saveRoot}/saves/${gameId}`
  try {
    for (const name of fileSystem.readdir(directory)) {
      const match = /^(slot[1-9][0-9]*)\.lua$/.exec(name)
      if (match != null) add(match[1], `${directory}/${name}`)
    }
  } catch {
    // No slot directory exists before the first save.
  }
  return saves.sort((left, right) => left.id.localeCompare(right.id))
}

function installPersistenceLifecycle(persistence) {
  let active = true
  const flush = (reason) => {
    if (!active) return
    void persistence.flush(reason).then((result) => {
      if (!result.ok) bridge.log("error", result.error.message)
    })
  }
  const timer = window.setInterval(() => flush("game-periodic"), 10_000)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush("game-hidden")
  })
  window.addEventListener("pagehide", () => {
    flush("game-pagehide")
    active = false
    window.clearInterval(timer)
  })
}

async function monitorGame(hostSession, hadRom, bindings, persistence) {
  const expected = `rom-cache-v10:${identities[hostSession.gameId].sha1}`
  if (!hadRom) {
    if (!completeCacheExists(hostSession.gameId, expected)) {
      await bridge.event({ type: "game.cacheMissing", token: hostSession.token, gameId: hostSession.gameId })
      return
    }
    await bridge.event({ type: "game.cacheReady", token: hostSession.token, gameId: hostSession.gameId })
    await bridge.event({
      type: "game.saves",
      token: hostSession.token,
      gameId: hostSession.gameId,
      saves: discoverSaves(hostSession.gameId),
    })
    installPersistenceLifecycle(persistence)
    return
  }

  // love.load has synchronously read the transfer before the browser surface
  // reports a running main loop. Remove it now so any later lifecycle flush
  // cannot persist ROM bytes, even if extraction fails or the view is closed.
  try { window.Module.FS.unlink(pickedRomPath) } catch { /* already consumed */ }
  while (window.Module?.done !== true) {
    if (completeCacheExists(hostSession.gameId, expected)) {
      const flushed = await persistence.flush("rom-import-complete")
      if (!flushed.ok) throw new Error(flushed.error.message)
      await bridge.event({ type: "game.cacheReady", token: hostSession.token, gameId: hostSession.gameId })
      await bridge.event({
        type: "game.saves",
        token: hostSession.token,
        gameId: hostSession.gameId,
        saves: discoverSaves(hostSession.gameId),
      })
      installPersistenceLifecycle(persistence)
      bridge.setStatus("ready", "Gen1Recomp ready", `${hostSession.gameId} private cache verified`)
      return
    }
    await bindings.delay(250)
  }
}

async function start() {
  installNativeViewport()
  const performanceTelemetry = startPerformanceTelemetry()
  const hostSession = loadHostSession()
  let romBytes = null
  if (hostSession != null) {
    const consumed = sessionStorage.getItem(`gen1recomp-consumed-${hostSession.token}`) === "1"
    if (hostSession.rom != null && !consumed) {
      romBytes = decodeBase64(hostSession.rom.base64)
      if (romBytes.length !== identities[hostSession.gameId].size) throw new Error("host ROM byte count is invalid")
      hostSession.rom.base64 = ""
    }
    installRomInjection(hostSession, romBytes)
  }

  const bindings = new DomLoveJsBrowserBindings(window, document)
  const surface = new BrowserLoveJsGameSurface(
    bindings,
    () => ({
      ok: true,
      value: {
        uri: "gen1recomp.love",
        args: hostSession?.arguments ?? ["--scripting-preview"],
      },
    }),
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

  const booted = await runtime.boot(request)
  if (!booted.ok) {
    bridge.setStatus("fail", "Runtime failed", booted.error.message)
    bridge.log("error", booted.error.message)
    await bridge.event({ type: "preview.error", stage: "boot", sessionId, error: booted.error })
    return
  }

  await bindings.delay(500)
  bridge.ready = true
  performanceTelemetry.ready()
  const canvas = document.getElementById("canvas")
  const event = {
    type: "preview.ready",
    sessionId,
    token: hostSession?.token,
    gameId: hostSession?.gameId,
    mode: hostSession == null ? "diagnostic" : "game",
    runtimeRevision: config.runtimeRevision,
    payload: config.payload,
    userAgent: navigator.userAgent,
    crossOriginIsolated: window.crossOriginIsolated,
    frame: window.Module?.Browser?.mainLoop?.currentFrameNumber ?? null,
    viewport: nativeViewport,
    surface: {
      width: canvas?.width ?? null,
      height: canvas?.height ?? null,
      cssWidth: canvas?.getBoundingClientRect().width ?? null,
      cssHeight: canvas?.getBoundingClientRect().height ?? null,
      visible: canvas !== null && getComputedStyle(canvas).display !== "none",
    },
  }
  bridge.setStatus(
    "ready",
    "Gen1Recomp ready",
    hostSession == null ? "ROM-free launcher diagnostic" : `${hostSession.gameId} game runtime`,
  )
  bridge.log("info", `ready frame ${event.frame}`)
  bridge.log(
    "info",
    `surface ${event.surface.width}x${event.surface.height} canvas -> `
      + `${event.surface.cssWidth}x${event.surface.cssHeight} CSS`,
  )
  await bridge.event(event)
  if (hostSession != null) void monitorGame(hostSession, romBytes != null, bindings, persistence).catch(async (error) => {
    bridge.log("error", String(error))
    await bridge.event({
      type: "preview.error",
      stage: "game-monitor",
      token: hostSession.token,
      gameId: hostSession.gameId,
      message: String(error),
    })
  })
}

void start().catch(async (error) => {
  const message = String(error)
  bridge.setStatus("fail", "Preview failed", message)
  bridge.log("error", message)
  await bridge.event({ type: "preview.error", stage: "uncaught", sessionId, message })
})
