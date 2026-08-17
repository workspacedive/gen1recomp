export interface LoveJsInterruptibleMainLoop {
  readonly currentFrameNumber: number
  pause(): void
  resume(): void
}

export interface LoveJsInterruptionBindings {
  now(): number
  visible(): boolean
  mainLoop(): LoveJsInterruptibleMainLoop | null
  flush(reason: string): void
  log(level: "info" | "warn", message: string): void
  event(value: Readonly<Record<string, unknown>>): void
  delay(callback: () => void, milliseconds: number): void
}

export interface LoveJsInterruptionRecovery {
  suspend(reason: string): void
  resume(reason: string): void
  pageHide(persisted: boolean): void
  close(): void
}

/** Pairs host interruptions with an explicit Emscripten main-loop pause/resume. */
export function createLoveJsInterruptionRecovery(
  bindings: LoveJsInterruptionBindings,
): LoveJsInterruptionRecovery {
  let active = true
  let pausedByHost = false
  let suspendedAt: number | null = null

  const suspend = (reason: string): void => {
    if (!active) return
    bindings.flush(`game-${reason}`)
    const loop = bindings.mainLoop()
    if (pausedByHost || loop === null) return
    loop.pause()
    pausedByHost = true
    suspendedAt = bindings.now()
    bindings.log("info", `lifecycle suspended ${reason} at frame ${loop.currentFrameNumber}`)
    bindings.event({
      type: "preview.lifecycle",
      state: "suspended",
      reason,
      frame: loop.currentFrameNumber,
    })
  }

  const resume = (reason: string): void => {
    if (!active) return
    const loop = bindings.mainLoop()
    const frame = loop?.currentFrameNumber ?? null
    if (pausedByHost && loop !== null) {
      loop.resume()
      pausedByHost = false
      const hiddenMs = suspendedAt === null ? null : Math.round(bindings.now() - suspendedAt)
      suspendedAt = null
      bindings.log("info", `lifecycle resumed ${reason} after ${hiddenMs}ms at frame ${frame}`)
      bindings.event({
        type: "preview.lifecycle",
        state: "resumed",
        reason,
        frame,
        hiddenMs,
      })
    }
    bindings.delay(() => {
      if (!active || !bindings.visible() || frame === null) return
      const current = bindings.mainLoop()
      if (current !== null && current.currentFrameNumber <= frame) {
        current.resume()
        bindings.log("warn", `lifecycle watchdog restarted stalled loop at frame ${frame}`)
        bindings.event({
          type: "preview.lifecycle",
          state: "watchdog-restart",
          reason,
          frame,
        })
      }
    }, 750)
  }

  return {
    suspend,
    resume,
    pageHide(persisted: boolean): void {
      if (persisted) suspend("pagehide-persisted")
      else active = false
    },
    close(): void { active = false },
  }
}
