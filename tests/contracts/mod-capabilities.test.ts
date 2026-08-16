import assert from "node:assert/strict"
import test from "node:test"

import {
  mapUpstreamModPermissions,
  ModCapabilityPolicy,
  parseUpstreamModPermissions,
  type ModCapability,
} from "../../components/contracts/src/mod-capabilities.js"

test("upstream permissions map to scoped capabilities without raw filesystem", () => {
  const parsed = parseUpstreamModPermissions([
    "network",
    "filesystem",
    "steps",
    "background",
    "engine_internals",
  ])
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const mapped = mapUpstreamModPermissions(parsed.value)
  assert.deepEqual([...mapped.capabilities].sort(), [
    "background:compute",
    "legacy:engine-internals",
    "network:https",
    "steps:read",
  ])
  assert.equal(mapped.disclosures.length, 1)
  assert.match(mapped.disclosures[0] ?? "", /no raw host filesystem/)
})

test("unknown and duplicate upstream permissions fail closed", () => {
  assert.equal(parseUpstreamModPermissions(["network", "raw_socket"]).ok, false)
  assert.deepEqual(parseUpstreamModPermissions(["network", "network"]), {
    ok: false,
    error: "duplicate permission: network",
  })
})

test("baseline capability needs no consent but optional capability does", () => {
  const declared = new Set<ModCapability>(["network:https"])
  const available = new Set<ModCapability>(["network:https"])
  const withoutGrant = new ModCapabilityPolicy({
    declared,
    available,
    granted: new Set(),
    legacyInternalsEnabled: false,
  })
  declared.clear()
  available.clear()
  assert.deepEqual(withoutGrant.authorize("events:subscribe"), {
    allowed: true,
    capability: "events:subscribe",
    source: "baseline",
  })
  assert.deepEqual(withoutGrant.authorize("network:https"), {
    allowed: false,
    capability: "network:https",
    reason: "not_granted",
  })

  const granted = new ModCapabilityPolicy({
    declared: new Set<ModCapability>(["network:https"]),
    available: new Set<ModCapability>(["network:https"]),
    granted: new Set<ModCapability>(["network:https"]),
    legacyInternalsEnabled: false,
  })
  assert.equal(granted.authorize("network:https").allowed, true)
})

test("undeclared, unavailable, and legacy capabilities have distinct denial reasons", () => {
  const policy = new ModCapabilityPolicy({
    declared: new Set<ModCapability>(["steps:read", "legacy:engine-internals"]),
    available: new Set<ModCapability>(["legacy:engine-internals"]),
    granted: new Set<ModCapability>(["steps:read"]),
    legacyInternalsEnabled: false,
  })
  assert.deepEqual(policy.authorize("network:https"), {
    allowed: false,
    capability: "network:https",
    reason: "undeclared",
  })
  assert.deepEqual(policy.authorize("steps:read"), {
    allowed: false,
    capability: "steps:read",
    reason: "unavailable",
  })
  assert.deepEqual(policy.authorize("legacy:engine-internals"), {
    allowed: false,
    capability: "legacy:engine-internals",
    reason: "legacy_disabled",
  })
})
