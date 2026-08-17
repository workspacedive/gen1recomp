import { err, ok, type Result } from "../../contracts/src/result.js"
import {
  ActivationCoordinator,
  type ActivationError,
  type ActivationSet,
  type ActivationStore,
} from "./activation-journal.js"
import {
  planSystemUpdate,
  type SystemUpdatePlan,
  type UpdatePlanError,
} from "./system-update-planner.js"
import type { CatalogRelease, UpdateCatalog } from "./update-catalog.js"

export type PackageOperation = "download" | "integrity" | "archive" | "staging" | "self_test"

export type SystemUpdateProgress =
  | { readonly stage: "planning" }
  | { readonly stage: "preparing"; readonly transactionId: string }
  | {
      readonly stage: "package"
      readonly operation: PackageOperation
      readonly componentId: string
      readonly version: string
      readonly completedBytes?: number
      readonly totalBytes?: number
    }
  | { readonly stage: "activating"; readonly transactionId: string }
  | { readonly stage: "health_check"; readonly transactionId: string }
  | { readonly stage: "recovering"; readonly transactionId: string }
  | { readonly stage: "completed"; readonly transactionId: string; readonly candidate: ActivationSet }

export type PackagePortError = {
  readonly code: "download" | "integrity" | "archive" | "staging" | "self_test" | "health_check"
  readonly componentId: string | null
  readonly message: string
  readonly retryable: boolean
}

export interface SystemUpdatePackagePort {
  stagePackage(
    transactionId: string,
    catalog: UpdateCatalog,
    release: CatalogRelease,
    progress: (progress: Omit<Extract<SystemUpdateProgress, { stage: "package" }>, "componentId" | "version">) => void,
  ): Promise<Result<void, PackagePortError>>
  testPackage(
    transactionId: string,
    release: CatalogRelease,
  ): Promise<Result<void, PackagePortError>>
  healthCheck(candidate: ActivationSet): Promise<Result<void, PackagePortError>>
  cleanup(transactionId: string, outcome: "committed" | "discarded"): Promise<void>
}

export type UpdateCancellation = {
  isCancelled(): boolean
}

export type SystemUpdateError = {
  readonly code: "busy" | "cancelled" | "plan" | "activation" | "package" | "recovery"
  readonly stage: SystemUpdateProgress["stage"]
  readonly componentId: string | null
  readonly message: string
  readonly retryable: boolean
  readonly cause: UpdatePlanError | ActivationError | PackagePortError | null
}

export type SystemUpdateResult = {
  readonly transactionId: string
  readonly plan: SystemUpdatePlan
  readonly active: ActivationSet
}

function updateError(
  code: SystemUpdateError["code"],
  stage: SystemUpdateError["stage"],
  message: string,
  options?: {
    readonly componentId?: string | null
    readonly retryable?: boolean
    readonly cause?: UpdatePlanError | ActivationError | PackagePortError | null
  },
): Result<never, SystemUpdateError> {
  return err({
    code,
    stage,
    componentId: options?.componentId ?? null,
    message,
    retryable: options?.retryable ?? false,
    cause: options?.cause ?? null,
  })
}

function activationFailure(
  stage: SystemUpdateError["stage"],
  failure: ActivationError,
): Result<never, SystemUpdateError> {
  return updateError("activation", stage, failure.message, {
    retryable: failure.code === "storage" || failure.code === "busy" || failure.code === "stale_state",
    cause: failure,
  })
}

export class SystemUpdateOrchestrator {
  readonly #activation: ActivationCoordinator
  readonly #packages: SystemUpdatePackagePort
  #busy = false

  public constructor(store: ActivationStore, packages: SystemUpdatePackagePort) {
    this.#activation = new ActivationCoordinator(store)
    this.#packages = packages
  }

  public get busy(): boolean {
    return this.#busy
  }

  public async recover(
    transactionIdForCleanup: string | null = null,
  ): Promise<Result<ActivationSet, SystemUpdateError>> {
    if (this.#busy) return updateError("busy", "recovering", "another update operation is active", { retryable: true })
    this.#busy = true
    try {
      const recovered = await this.#activation.recover()
      if (!recovered.ok) {
        return updateError("recovery", "recovering", recovered.error.message, {
          retryable: recovered.error.code === "storage",
          cause: recovered.error,
        })
      }
      if (transactionIdForCleanup !== null) {
        try {
          await this.#packages.cleanup(transactionIdForCleanup, "discarded")
        } catch {
          // The active pointer is already safe. Stale staging is reclaimable maintenance work.
        }
      }
      return ok(recovered.value.active)
    } finally {
      this.#busy = false
    }
  }

  public async execute(
    input: {
      readonly transactionId: string
      readonly catalog: UpdateCatalog
      readonly installed: ActivationSet
      readonly requestedComponentIds: readonly string[]
      readonly providedApis: Readonly<Record<string, string>>
      readonly cancellation?: UpdateCancellation
    },
    onProgress: (progress: SystemUpdateProgress) => void = () => undefined,
  ): Promise<Result<SystemUpdateResult, SystemUpdateError>> {
    if (this.#busy) return updateError("busy", "planning", "another update operation is active", { retryable: true })
    this.#busy = true
    let prepared = false
    try {
      onProgress({ stage: "planning" })
      const plan = planSystemUpdate(
        input.catalog,
        input.installed,
        input.requestedComponentIds,
        input.providedApis,
      )
      if (!plan.ok) {
        return updateError("plan", "planning", plan.error.message, {
          componentId: plan.error.componentId,
          cause: plan.error,
        })
      }
      if (input.cancellation?.isCancelled() === true) {
        return updateError("cancelled", "planning", "update was cancelled before staging", { retryable: true })
      }

      onProgress({ stage: "preparing", transactionId: input.transactionId })
      const prepare = await this.#activation.prepare(
        input.transactionId,
        plan.value.candidate,
        input.installed,
      )
      if (!prepare.ok) return activationFailure("preparing", prepare.error)
      prepared = true

      for (const release of plan.value.packages) {
        if (input.cancellation?.isCancelled() === true) {
          return await this.#abort(input.transactionId, "cancelled", "package", "update was cancelled before activation", null, onProgress)
        }
        const staged = await this.#packages.stagePackage(
          input.transactionId,
          input.catalog,
          release,
          (progress) => onProgress({
            ...progress,
            componentId: release.manifest.id,
            version: release.manifest.version,
          }),
        )
        if (!staged.ok) {
          return await this.#abort(
            input.transactionId,
            "package",
            "package",
            staged.error.message,
            staged.error,
            onProgress,
          )
        }
      }

      const verified = await this.#activation.markVerified()
      if (!verified.ok) {
        return await this.#abort(input.transactionId, "activation", "package", verified.error.message, verified.error, onProgress)
      }
      for (const release of plan.value.packages) {
        onProgress({
          stage: "package",
          operation: "self_test",
          componentId: release.manifest.id,
          version: release.manifest.version,
        })
        const tested = await this.#packages.testPackage(input.transactionId, release)
        if (!tested.ok) {
          return await this.#abort(
            input.transactionId,
            "package",
            "package",
            tested.error.message,
            tested.error,
            onProgress,
          )
        }
      }
      const markedTested = await this.#activation.markTested()
      if (!markedTested.ok) {
        return await this.#abort(input.transactionId, "activation", "package", markedTested.error.message, markedTested.error, onProgress)
      }
      if (input.cancellation?.isCancelled() === true) {
        return await this.#abort(input.transactionId, "cancelled", "package", "update was cancelled before activation", null, onProgress)
      }

      onProgress({ stage: "activating", transactionId: input.transactionId })
      const activated = await this.#activation.activate()
      if (!activated.ok) {
        return await this.#abort(input.transactionId, "activation", "activating", activated.error.message, activated.error, onProgress)
      }

      onProgress({ stage: "health_check", transactionId: input.transactionId })
      const healthy = await this.#packages.healthCheck(plan.value.candidate)
      if (!healthy.ok) {
        return await this.#abort(
          input.transactionId,
          "package",
          "health_check",
          healthy.error.message,
          healthy.error,
          onProgress,
        )
      }
      const committed = await this.#activation.commit()
      if (!committed.ok) {
        return await this.#abort(input.transactionId, "activation", "health_check", committed.error.message, committed.error, onProgress)
      }

      try {
        await this.#packages.cleanup(input.transactionId, "committed")
      } catch {
        // Committed versions remain valid; cleanup can be retried by maintenance.
      }
      onProgress({ stage: "completed", transactionId: input.transactionId, candidate: plan.value.candidate })
      return ok({ transactionId: input.transactionId, plan: plan.value, active: plan.value.candidate })
    } finally {
      if (!prepared) {
        // No transaction-specific cleanup is needed before prepare succeeds.
      }
      this.#busy = false
    }
  }

  async #abort(
    transactionId: string,
    code: "cancelled" | "activation" | "package",
    stage: SystemUpdateError["stage"],
    message: string,
    cause: ActivationError | PackagePortError | null,
    onProgress: (progress: SystemUpdateProgress) => void,
  ): Promise<Result<never, SystemUpdateError>> {
    onProgress({ stage: "recovering", transactionId })
    const recovered = await this.#activation.recover()
    try {
      await this.#packages.cleanup(transactionId, "discarded")
    } catch {
      // Recovery result remains authoritative; stale staging can be reclaimed later.
    }
    if (!recovered.ok) {
      return updateError("recovery", "recovering", recovered.error.message, {
        retryable: recovered.error.code === "storage",
        cause: recovered.error,
      })
    }
    return updateError(code, stage, message, {
      componentId: cause !== null && "componentId" in cause ? cause.componentId : null,
      retryable: code === "cancelled" || (cause !== null && "retryable" in cause && cause.retryable),
      cause,
    })
  }
}
