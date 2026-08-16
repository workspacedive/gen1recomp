import { err, ok, type Result } from "../../../components/contracts/src/result.js"

export type PersistenceOperation = "populate" | "flush"

export type PersistenceState =
  | { readonly status: "idle" }
  | { readonly status: "syncing"; readonly operation: PersistenceOperation; readonly reason: string }
  | { readonly status: "failed"; readonly operation: PersistenceOperation; readonly reason: string; readonly message: string }

export type PersistenceError = {
  readonly code: "sync_failed" | "timeout"
  readonly operation: PersistenceOperation
  readonly reason: string
  readonly message: string
}

export interface EmscriptenFileSystem {
  syncfs(populate: boolean, callback: (error?: unknown) => void): void
}

export type LoveJsPersistenceOptions = {
  readonly timeoutMs: number
}

export class LoveJsPersistenceAdapter {
  readonly #fileSystem: EmscriptenFileSystem
  readonly #timeoutMs: number
  #tail: Promise<void> = Promise.resolve()
  #state: PersistenceState = { status: "idle" }

  public constructor(
    fileSystem: EmscriptenFileSystem,
    options: LoveJsPersistenceOptions,
  ) {
    if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) {
      throw new RangeError("timeoutMs must be a positive safe integer")
    }
    this.#fileSystem = fileSystem
    this.#timeoutMs = options.timeoutMs
  }

  public state(): PersistenceState {
    return { ...this.#state }
  }

  public populate(reason = "runtime-start"): Promise<Result<void, PersistenceError>> {
    return this.#schedule("populate", reason)
  }

  public flush(reason: string): Promise<Result<void, PersistenceError>> {
    if (reason.trim().length === 0) {
      return Promise.resolve(err({
        code: "sync_failed",
        operation: "flush",
        reason,
        message: "flush reason is required",
      }))
    }
    return this.#schedule("flush", reason)
  }

  #schedule(
    operation: PersistenceOperation,
    reason: string,
  ): Promise<Result<void, PersistenceError>> {
    const result = this.#tail.then(() => this.#sync(operation, reason))
    this.#tail = result.then(() => undefined, () => undefined)
    return result
  }

  async #sync(
    operation: PersistenceOperation,
    reason: string,
  ): Promise<Result<void, PersistenceError>> {
    this.#state = { status: "syncing", operation, reason }
    const result = await new Promise<Result<void, PersistenceError>>((resolve) => {
      let settled = false
      const finish = (value: Result<void, PersistenceError>): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve(value)
      }
      const timeout = setTimeout(() => {
        finish(err({
          code: "timeout",
          operation,
          reason,
          message: `${operation} did not complete within ${this.#timeoutMs} ms`,
        }))
      }, this.#timeoutMs)
      try {
        this.#fileSystem.syncfs(operation === "populate", (error?: unknown) => {
          if (error !== undefined && error !== null) {
            finish(err({
              code: "sync_failed",
              operation,
              reason,
              message: String(error),
            }))
            return
          }
          finish(ok(undefined))
        })
      } catch (cause: unknown) {
        finish(err({
          code: "sync_failed",
          operation,
          reason,
          message: String(cause),
        }))
      }
    })
    this.#state = result.ok
      ? { status: "idle" }
      : {
          status: "failed",
          operation,
          reason,
          message: result.error.message,
        }
    return result
  }
}
