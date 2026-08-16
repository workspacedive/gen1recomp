import { valid } from "semver"

import { COMPONENT_ID_PATTERN } from "../../contracts/src/component-manifest.js"
import { hasOnlyKeys, isRecord } from "../../contracts/src/json.js"
import { err, ok, type Result } from "../../contracts/src/result.js"

export type ActivationSet = Readonly<Record<string, string>>

export type ActivationPhase =
  | "prepared"
  | "verified"
  | "tested"
  | "activating"
  | "activated"
  | "rollingBack"

export type ActivationJournal = {
  readonly schemaVersion: 1
  readonly transactionId: string
  readonly phase: ActivationPhase
  readonly previous: ActivationSet
  readonly candidate: ActivationSet
}

export type ActivationError = {
  readonly code: "busy" | "missing_journal" | "invalid_phase" | "invalid_journal" | "storage"
  readonly message: string
}

export type RecoveryResult =
  | { readonly action: "none"; readonly active: ActivationSet }
  | { readonly action: "discarded_staging"; readonly transactionId: string; readonly active: ActivationSet }
  | { readonly action: "rolled_back"; readonly transactionId: string; readonly active: ActivationSet }

export type ActivationStoreKey = "active" | "knownGood" | "previous" | "journal"

export interface ActivationStore {
  read(key: ActivationStoreKey): Promise<unknown | null>
  write(key: ActivationStoreKey, value: unknown): Promise<void>
  remove(key: ActivationStoreKey): Promise<void>
}

const PHASES: ReadonlySet<string> = new Set<ActivationPhase>([
  "prepared",
  "verified",
  "tested",
  "activating",
  "activated",
  "rollingBack",
])

function activationError(
  code: ActivationError["code"],
  message: string,
): Result<never, ActivationError> {
  return err({ code, message })
}

function parseActivationSet(value: unknown): Result<ActivationSet, ActivationError> {
  if (!isRecord(value)) return activationError("invalid_journal", "activation set must be an object")
  const output: Record<string, string> = {}
  for (const [id, version] of Object.entries(value)) {
    if (
      !COMPONENT_ID_PATTERN.test(id) ||
      typeof version !== "string" ||
      valid(version) === null
    ) {
      return activationError("invalid_journal", "activation set IDs and versions must be canonical component identifiers/semantic versions")
    }
    output[id] = version
  }
  return ok(output)
}

export function parseActivationJournal(value: unknown): Result<ActivationJournal, ActivationError> {
  if (!isRecord(value) || value["schemaVersion"] !== 1) {
    return activationError("invalid_journal", "journal schemaVersion must be 1")
  }
  if (!hasOnlyKeys(value, new Set([
    "schemaVersion",
    "transactionId",
    "phase",
    "previous",
    "candidate",
  ]))) {
    return activationError("invalid_journal", "journal has unknown fields")
  }
  if (typeof value["transactionId"] !== "string" || value["transactionId"].trim().length === 0) {
    return activationError("invalid_journal", "journal transactionId is required")
  }
  if (typeof value["phase"] !== "string" || !PHASES.has(value["phase"])) {
    return activationError("invalid_journal", "journal phase is unsupported")
  }
  const previous = parseActivationSet(value["previous"])
  if (!previous.ok) return previous
  const candidate = parseActivationSet(value["candidate"])
  if (!candidate.ok) return candidate
  return ok({
    schemaVersion: 1,
    transactionId: value["transactionId"],
    phase: value["phase"] as ActivationPhase,
    previous: previous.value,
    candidate: candidate.value,
  })
}

async function readSet(
  store: ActivationStore,
  key: "active" | "knownGood" | "previous",
): Promise<Result<ActivationSet, ActivationError>> {
  try {
    const value = await store.read(key)
    return value === null ? ok({}) : parseActivationSet(value)
  } catch (cause: unknown) {
    return activationError("storage", `could not read ${key}: ${String(cause)}`)
  }
}

async function readJournal(
  store: ActivationStore,
): Promise<Result<ActivationJournal | null, ActivationError>> {
  try {
    const value = await store.read("journal")
    return value === null ? ok(null) : parseActivationJournal(value)
  } catch (cause: unknown) {
    return activationError("storage", `could not read journal: ${String(cause)}`)
  }
}

async function writeJournal(
  store: ActivationStore,
  journal: ActivationJournal,
): Promise<Result<void, ActivationError>> {
  try {
    await store.write("journal", journal)
    return ok(undefined)
  } catch (cause: unknown) {
    return activationError("storage", `could not write journal: ${String(cause)}`)
  }
}

export class ActivationCoordinator {
  readonly #store: ActivationStore

  public constructor(store: ActivationStore) {
    this.#store = store
  }

  public async prepare(
    transactionId: string,
    candidate: ActivationSet,
  ): Promise<Result<ActivationJournal, ActivationError>> {
    if (transactionId.trim().length === 0) {
      return activationError("invalid_journal", "transactionId is required")
    }
    const existing = await readJournal(this.#store)
    if (!existing.ok) return existing
    if (existing.value !== null) {
      return activationError("busy", `transaction ${existing.value.transactionId} is incomplete`)
    }
    const previous = await readSet(this.#store, "active")
    if (!previous.ok) return previous
    const validCandidate = parseActivationSet(candidate)
    if (!validCandidate.ok) return validCandidate
    const journal: ActivationJournal = {
      schemaVersion: 1,
      transactionId,
      phase: "prepared",
      previous: previous.value,
      candidate: validCandidate.value,
    }
    const written = await writeJournal(this.#store, journal)
    return written.ok ? ok(journal) : written
  }

  public markVerified(): Promise<Result<ActivationJournal, ActivationError>> {
    return this.#transition("prepared", "verified")
  }

  public markTested(): Promise<Result<ActivationJournal, ActivationError>> {
    return this.#transition("verified", "tested")
  }

  public async activate(): Promise<Result<ActivationJournal, ActivationError>> {
    const journal = await this.#expect("tested")
    if (!journal.ok) return journal
    const activating = { ...journal.value, phase: "activating" } as const
    const marked = await writeJournal(this.#store, activating)
    if (!marked.ok) return marked
    try {
      await this.#store.write("active", activating.candidate)
    } catch (cause: unknown) {
      return activationError("storage", `could not write active set: ${String(cause)}`)
    }
    const activated = { ...activating, phase: "activated" } as const
    const completed = await writeJournal(this.#store, activated)
    return completed.ok ? ok(activated) : completed
  }

  public async commit(): Promise<Result<void, ActivationError>> {
    const journal = await this.#expect("activated")
    if (!journal.ok) return journal
    try {
      await this.#store.write("previous", journal.value.previous)
      await this.#store.write("knownGood", journal.value.candidate)
      await this.#store.remove("journal")
      return ok(undefined)
    } catch (cause: unknown) {
      return activationError("storage", `could not commit activation: ${String(cause)}`)
    }
  }

  public async recover(): Promise<Result<RecoveryResult, ActivationError>> {
    const journal = await readJournal(this.#store)
    if (!journal.ok) return journal
    if (journal.value === null) {
      const active = await readSet(this.#store, "active")
      return active.ok ? ok({ action: "none", active: active.value }) : active
    }
    const record = journal.value
    if (record.phase === "prepared" || record.phase === "verified" || record.phase === "tested") {
      try {
        await this.#store.remove("journal")
        return ok({
          action: "discarded_staging",
          transactionId: record.transactionId,
          active: record.previous,
        })
      } catch (cause: unknown) {
        return activationError("storage", `could not discard staging journal: ${String(cause)}`)
      }
    }
    return this.#rollback(record)
  }

  async #transition(
    expected: ActivationPhase,
    next: ActivationPhase,
  ): Promise<Result<ActivationJournal, ActivationError>> {
    const journal = await this.#expect(expected)
    if (!journal.ok) return journal
    const updated: ActivationJournal = { ...journal.value, phase: next }
    const written = await writeJournal(this.#store, updated)
    return written.ok ? ok(updated) : written
  }

  async #expect(expected: ActivationPhase): Promise<Result<ActivationJournal, ActivationError>> {
    const journal = await readJournal(this.#store)
    if (!journal.ok) return journal
    if (journal.value === null) return activationError("missing_journal", "no activation is in progress")
    if (journal.value.phase !== expected) {
      return activationError(
        "invalid_phase",
        `expected ${expected}, found ${journal.value.phase}`,
      )
    }
    return ok(journal.value)
  }

  async #rollback(
    journal: ActivationJournal,
  ): Promise<Result<RecoveryResult, ActivationError>> {
    const rollingBack: ActivationJournal = { ...journal, phase: "rollingBack" }
    const marked = await writeJournal(this.#store, rollingBack)
    if (!marked.ok) return marked
    try {
      await this.#store.write("active", rollingBack.previous)
      await this.#store.write("knownGood", rollingBack.previous)
      await this.#store.remove("journal")
      return ok({
        action: "rolled_back",
        transactionId: rollingBack.transactionId,
        active: rollingBack.previous,
      })
    } catch (cause: unknown) {
      return activationError("storage", `could not restore known-good activation: ${String(cause)}`)
    }
  }
}
