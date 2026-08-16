import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  evaluateLoveJsCapabilities,
  LOVEJS_OUTSIDE_BROWSER_PROFILE,
  LOVEJS_SCRIPTING_DEVICE_PROFILE,
  parseLoveJsCapabilityReport,
  verifyLoveJsCapabilityEvidence,
  type LoveJsCapabilityCheck,
  type LoveJsCapabilityReport,
  type LoveJsCheckId,
} from "../../runtime/adapters/lovejs/capabilities.js"

const PASS: LoveJsCapabilityCheck = { status: "pass", observed: true }
const OUTSIDE_BROWSER_EVIDENCE: unknown = JSON.parse(readFileSync(
  new URL(
    "../../../../docs/gen1recomp/runtime-capability-report.outside-browser.json",
    import.meta.url,
  ),
  "utf8",
))

function report(
  overrides: Partial<Record<LoveJsCheckId, LoveJsCapabilityCheck>> = {},
): LoveJsCapabilityReport {
  const checks: Record<LoveJsCheckId, LoveJsCapabilityCheck> = {
    "runtime.love11_5": PASS,
    "lua.version51": PASS,
    "lua.setfenv": PASS,
    "lua.loadstring": PASS,
    "lua.bit": PASS,
    "lua.coroutine": PASS,
    "web.wasm": PASS,
    "web.crossOriginIsolated": PASS,
    "graphics.webgl1": PASS,
    "graphics.webgl2": PASS,
    "graphics.canvas": PASS,
    "graphics.imageData": PASS,
    "graphics.shader": PASS,
    "loop.fixedStep": PASS,
    "storage.session": PASS,
    "storage.explicitSync": PASS,
    "audio.queueableBuffer": PASS,
    "input.touchNamespace": PASS,
    "input.simultaneousTouch": { status: "unavailable", observed: "not tested" },
    "input.joystickNamespace": PASS,
    "thread.channel": PASS,
    "thread.workerRoundtrip": {
      status: "unavailable",
      observed: "worker construction failed",
    },
    ...overrides,
  }
  return {
    schemaVersion: 1,
    purpose: "live-activation",
    sessionId: "session-1",
    runtimeRevision: "9355186de22db13bd88bf2a0db75d2925647d036",
    observedAt: "2026-08-16T11:22:42.019Z",
    environment: {
      host: "outside-browser",
      hostVersion: "HeadlessChromium/149.0.7827.0",
      osVersion: "Debian 12",
      renderer: "Google SwiftShader",
    },
    checks,
  }
}

test("capability parser and outside-browser profile accept archival normalized evidence", () => {
  const parsed = parseLoveJsCapabilityReport(OUTSIDE_BROWSER_EVIDENCE)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const evaluated = evaluateLoveJsCapabilities(
    parsed.value,
    LOVEJS_OUTSIDE_BROWSER_PROFILE,
  )
  assert.equal(evaluated.compatible, true)
  assert.equal(evaluated.issues.length, 0)
  assert.equal(evaluated.descriptor.capabilities.has("webAssembly"), true)
  assert.equal(evaluated.descriptor.capabilities.has("threadChannels"), true)
  assert.equal(evaluated.descriptor.capabilities.has("threads"), false)
  assert.equal(evaluated.descriptor.capabilities.has("rawMultiTouch"), false)
  assert.equal(evaluated.descriptor.capabilities.has("gameController"), false)
})

test("symbol presence cannot satisfy a profile expecting workers unavailable", () => {
  const evaluated = evaluateLoveJsCapabilities(
    report({ "thread.workerRoundtrip": PASS }),
    LOVEJS_OUTSIDE_BROWSER_PROFILE,
  )
  assert.equal(evaluated.compatible, false)
  assert.equal(evaluated.descriptor, null)
  assert.deepEqual(evaluated.issues.map(({ code, check }) => [code, check]), [
    ["capability_policy_mismatch", "thread.workerRoundtrip"],
  ])
})

test("outside-browser evidence cannot activate the Scripting device profile", () => {
  const evaluated = evaluateLoveJsCapabilities(
    report(),
    LOVEJS_SCRIPTING_DEVICE_PROFILE,
  )
  assert.equal(evaluated.compatible, false)
  assert.ok(evaluated.issues.some(({ code }) => code === "host_mismatch"))
  assert.ok(evaluated.issues.some(({ check }) => check === "input.simultaneousTouch"))
})

test("synthetic Scripting results remain blocked while declaration and device evidence is pending", () => {
  const candidate: LoveJsCapabilityReport = {
    ...report({ "input.simultaneousTouch": PASS }),
    environment: {
      host: "scripting-webview",
      hostVersion: "unverified",
      osVersion: "iOS unverified",
      renderer: null,
    },
  }
  const evaluated = evaluateLoveJsCapabilities(
    candidate,
    LOVEJS_SCRIPTING_DEVICE_PROFILE,
  )
  assert.equal(evaluated.compatible, false)
  assert.ok(evaluated.issues.some(({ code }) => code === "activation_blocked"))
})

test("parser rejects unknown checks, malformed timestamps, and non-JSON evidence", () => {
  const unknown = {
    ...report(),
    checks: { ...report().checks, "graphics.metal": PASS },
  }
  assert.equal(parseLoveJsCapabilityReport(unknown).ok, false)
  assert.equal(parseLoveJsCapabilityReport({ ...report(), observedAt: "not-a-date" }).ok, false)
  assert.equal(parseLoveJsCapabilityReport({
    ...report(),
    observedAt: "2026-02-31T00:00:00.000Z",
  }).ok, false)
  assert.equal(parseLoveJsCapabilityReport({ ...report(), sessionId: "../old" }).ok, false)
  assert.equal(parseLoveJsCapabilityReport({ ...report(), runtimeRevision: "main" }).ok, false)
  const cyclic: { self?: unknown } = {}
  cyclic.self = cyclic
  assert.equal(parseLoveJsCapabilityReport({
    ...report(),
    checks: { "runtime.love11_5": { status: "pass", observed: cyclic } },
  }).ok, false)
  const hostile = new Proxy({}, {
    get() { throw new Error("hostile getter") },
  })
  assert.equal(parseLoveJsCapabilityReport(hostile).ok, false)
})

test("verifier adapter returns explicit parser and policy errors", () => {
  const invalid = verifyLoveJsCapabilityEvidence(
    {},
    LOVEJS_OUTSIDE_BROWSER_PROFILE,
    "session-1",
  )
  assert.equal(invalid.ok, false)
  if (!invalid.ok) assert.equal(invalid.error.code, "invalid_payload")

  const denied = verifyLoveJsCapabilityEvidence(
    report(),
    LOVEJS_SCRIPTING_DEVICE_PROFILE,
    "session-1",
  )
  assert.equal(denied.ok, false)
  if (!denied.ok) {
    assert.equal(denied.error.code, "capability")
    assert.match(denied.error.message, /environment: required scripting-webview/)
  }

  const archived = verifyLoveJsCapabilityEvidence(
    OUTSIDE_BROWSER_EVIDENCE,
    LOVEJS_OUTSIDE_BROWSER_PROFILE,
    "archived-capture-20260816T112242019Z",
  )
  assert.equal(archived.ok, false)
  if (!archived.ok) assert.match(archived.error.message, /archival capability evidence/)

  const mismatchedSession = verifyLoveJsCapabilityEvidence(
    report(),
    LOVEJS_OUTSIDE_BROWSER_PROFILE,
    "other-session",
  )
  assert.equal(mismatchedSession.ok, false)
  if (!mismatchedSession.ok) assert.equal(mismatchedSession.error.code, "invalid_payload")

  const accepted = verifyLoveJsCapabilityEvidence(
    report(),
    LOVEJS_OUTSIDE_BROWSER_PROFILE,
    "session-1",
  )
  assert.equal(accepted.ok, true)
})
