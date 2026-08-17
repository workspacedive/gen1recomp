import assert from "node:assert/strict"
import test from "node:test"

import { createLoveJsInterruptionRecovery } from "../../runtime/adapters/lovejs/interruption.js"

test("host interruption pauses, flushes, resumes, and reports duration", () => {
  let now = 100
  let visible = false
  let frame = 42
  let pauses = 0
  let resumes = 0
  const flushes: string[] = []
  const events: Array<Readonly<Record<string, unknown>>> = []
  const delayed: Array<() => void> = []
  const recovery = createLoveJsInterruptionRecovery({
    now: () => now,
    visible: () => visible,
    mainLoop: () => ({
      currentFrameNumber: frame,
      pause: () => { pauses += 1 },
      resume: () => { resumes += 1 },
    }),
    flush: (reason) => flushes.push(reason),
    log: () => undefined,
    event: (value) => events.push(value),
    delay: (callback, milliseconds) => {
      assert.equal(milliseconds, 750)
      delayed.push(callback)
    },
  })

  recovery.suspend("hidden")
  recovery.suspend("blur")
  assert.equal(pauses, 1)
  assert.deepEqual(flushes, ["game-hidden", "game-blur"])
  now = 2_600
  visible = true
  recovery.resume("visible")
  assert.equal(resumes, 1)
  assert.equal(events[0]?.["state"], "suspended")
  assert.equal(events[1]?.["state"], "resumed")
  assert.equal(events[1]?.["hiddenMs"], 2_500)

  frame += 1
  delayed.shift()?.()
  assert.equal(resumes, 1)
})

test("visible watchdog restarts a loop that did not advance", () => {
  let resumes = 0
  const delayed: Array<() => void> = []
  const events: Array<Readonly<Record<string, unknown>>> = []
  const recovery = createLoveJsInterruptionRecovery({
    now: () => 0,
    visible: () => true,
    mainLoop: () => ({
      currentFrameNumber: 9,
      pause: () => undefined,
      resume: () => { resumes += 1 },
    }),
    flush: () => undefined,
    log: () => undefined,
    event: (value) => events.push(value),
    delay: (callback) => delayed.push(callback),
  })

  recovery.resume("focus")
  delayed.shift()?.()
  assert.equal(resumes, 1)
  assert.equal(events[0]?.["state"], "watchdog-restart")
  recovery.close()
  recovery.suspend("hidden")
  assert.equal(resumes, 1)
})
