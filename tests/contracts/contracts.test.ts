import assert from "node:assert/strict"
import test from "node:test"

import {
  isJsonValue,
  parseComponentManifest,
  parseHostMessage,
  pixelPerfectViewport,
} from "../../components/contracts/src/index.js"

const SHA256 = "a".repeat(64)

test("component manifest accepts a pinned runtime component", () => {
  const parsed = parseComponentManifest({
    schemaVersion: 1,
    id: "org.gen1recomp.runtime.lovejs",
    kind: "runtime",
    version: "0.1.0",
    apiVersion: "1.0.0",
    artifact: {
      path: "runtime/lovejs.zip",
      size: 123,
      integrity: { algorithm: "sha256", digest: SHA256 },
    },
    dependencies: [
      { id: "org.gen1recomp.host-protocol", range: "^1.0.0" },
    ],
    compatibility: { hostProtocol: "^1.0.0", loveApi: "11.5.x" },
    capabilities: ["lua51", "webgl1"],
    migrations: [],
    selfTests: [{ id: "boot", entry: "tests/boot.js", timeoutMs: 5000 }],
  })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.value.kind, "runtime")
    assert.equal(parseComponentManifest({ ...parsed.value, apiVersion: "1.0" }).ok, false)
  }
})

test("component manifest rejects a traversing artifact path", () => {
  const parsed = parseComponentManifest({
    schemaVersion: 1,
    id: "org.gen1recomp.runtime.bad",
    kind: "runtime",
    version: "0.1.0",
    apiVersion: "1.0.0",
    artifact: {
      path: "../escape.zip",
      size: 1,
      integrity: { algorithm: "sha256", digest: SHA256 },
    },
    dependencies: [],
    compatibility: {},
    capabilities: [],
    migrations: [],
    selfTests: [],
  })
  assert.equal(parsed.ok, false)
})

test("host protocol rejects unsupported protocol versions", () => {
  const parsed = parseHostMessage({
    kind: "request",
    protocol: 2,
    requestId: "r-1",
    method: "host.capabilities",
    payload: null,
  })
  assert.deepEqual(parsed, { ok: false, error: "unsupported protocol: 2" })
})

test("host protocol accepts a known request with JSON payload", () => {
  const parsed = parseHostMessage({
    kind: "request",
    protocol: 1,
    requestId: "r-1",
    method: "storage.read",
    payload: { namespace: "save", relativePath: "red/slot-1.lua" },
  })
  assert.equal(parsed.ok, true)
})

test("runtime parsers reject unknown fields and non-JSON object instances", () => {
  const host = parseHostMessage({
    kind: "event",
    protocol: 1,
    event: "lifecycle.resume",
    payload: null,
    undocumented: true,
  })
  assert.equal(host.ok, false)
  assert.equal(isJsonValue(new Date()), false)
  assert.equal(isJsonValue({ finite: 1, values: [true, null] }), true)
  const cycle: { self?: unknown } = {}
  cycle.self = cycle
  assert.equal(isJsonValue(cycle), false)
})

test("pixel-perfect viewport uses centered integer scaling", () => {
  assert.deepEqual(pixelPerfectViewport(1179, 2556), {
    drawableWidth: 1179,
    drawableHeight: 2556,
    logicalWidth: 160,
    logicalHeight: 144,
    integerScale: 7,
    offsetX: 29,
    offsetY: 774,
  })
})

test("pixel-perfect viewport refuses fractional or undersized pixel surfaces", () => {
  assert.throws(() => pixelPerfectViewport(1179.5, 2556), TypeError)
  assert.throws(() => pixelPerfectViewport(159, 144), RangeError)
})
