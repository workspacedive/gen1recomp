import assert from "node:assert/strict"
import test from "node:test"

import { planLoveJsViewport } from "../../runtime/adapters/lovejs/viewport.js"

test("iPhone portrait fills the long viewport without a Retina fill-rate multiplier", () => {
  assert.deepEqual(planLoveJsViewport(430, 800, 3), {
    cssWidth: 430,
    cssHeight: 800,
    width: 640,
    height: 1191,
    gameScale: 4,
    orientation: "portrait",
    devicePixelRatio: 3,
  })
})

test("iPhone landscape keeps the 144-pixel game edge at integer scale", () => {
  assert.deepEqual(planLoveJsViewport(932, 430, 3), {
    cssWidth: 932,
    cssHeight: 430,
    width: 1248,
    height: 576,
    gameScale: 4,
    orientation: "landscape",
    devicePixelRatio: 3,
  })
})

test("iPad layouts use a larger bounded game scale", () => {
  assert.deepEqual(planLoveJsViewport(1024, 1366, 2), {
    cssWidth: 1024,
    cssHeight: 1366,
    width: 800,
    height: 1067,
    gameScale: 5,
    orientation: "portrait",
    devicePixelRatio: 2,
  })
  assert.deepEqual(planLoveJsViewport(1366, 1024, 2), {
    cssWidth: 1366,
    cssHeight: 1024,
    width: 960,
    height: 720,
    gameScale: 5,
    orientation: "landscape",
    devicePixelRatio: 2,
  })
})

test("native-pixel quality maps Retina viewports one-to-one", () => {
  assert.deepEqual(planLoveJsViewport(440, 956, 3, "native-pixels"), {
    cssWidth: 440,
    cssHeight: 956,
    width: 1320,
    height: 2868,
    gameScale: 8,
    orientation: "portrait",
    devicePixelRatio: 3,
  })
  assert.deepEqual(planLoveJsViewport(1024, 1366, 2, "native-pixels"), {
    cssWidth: 1024,
    cssHeight: 1366,
    width: 2048,
    height: 2732,
    gameScale: 12,
    orientation: "portrait",
    devicePixelRatio: 2,
  })
})

test("invalid or extreme host geometry fails closed", () => {
  assert.throws(() => planLoveJsViewport(1, 10_000, 1), /unsupported viewport geometry/)
  assert.equal(planLoveJsViewport(430.4, 799.7, Number.NaN).devicePixelRatio, 1)
})
