import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

test("runtime bundle waits for a stable visible WebView viewport", () => {
  let now = 0
  const timers: Array<() => void> = []
  const loaded: string[] = []
  const logs: string[] = []
  const preview = {
    installEmbeddedPackages: () => true,
    loadBundle: (path: string) => loaded.push(path),
    log: (_level: string, message: string) => logs.push(message),
    event: async () => undefined,
    setStatus: () => undefined,
    launchPending: false,
    failed: false,
  }
  const windowValue: Record<string, unknown> & {
    innerWidth: number
    innerHeight: number
    setTimeout: (callback: () => void) => number
  } = {
    innerWidth: 1,
    innerHeight: 1,
    setTimeout: (callback) => {
      timers.push(callback)
      return timers.length
    },
    __gen1recompPreview: preview,
  }
  const source = readFileSync(
    "scripting/Gen1RecompApp/runtime-shell-v046/preview-loader.js",
    "utf8",
  )
  vm.runInNewContext(source, {
    window: windowValue,
    performance: { now: () => now },
  })

  const start = windowValue["__gen1recompStart"] as (session: object) => boolean
  const session = { schemaVersion: 1, mode: "diagnostic" }
  assert.equal(start(session), true)
  assert.equal(start(session), false)
  assert.equal(preview.launchPending, true)
  assert.deepEqual(loaded, [])
  assert.equal(timers.length, 1)

  windowValue.innerWidth = 440
  windowValue.innerHeight = 900
  now = 100
  timers.shift()?.()
  assert.deepEqual(loaded, [])

  now = 300
  timers.shift()?.()
  assert.deepEqual(loaded, [])

  now = 351
  timers.shift()?.()
  assert.deepEqual(loaded, ["preview-bundle.js"])
  assert.equal(preview.launchPending, false)
  assert.equal(windowValue["__gen1recompHostSession"], session)
  assert.ok(logs.some((line) => line.includes("visible viewport 440x900")))
})
