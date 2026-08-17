import { satisfies, valid, validRange } from "semver"

import type { ComponentManifest } from "../../contracts/src/component-manifest.js"

export type CompatibilityCheck = {
  readonly componentId: string
  readonly componentVersion: string
  readonly api: string
  readonly required: string
  readonly provided: string | null
  readonly status:
    | "matched"
    | "missing"
    | "invalid_requirement"
    | "invalid_provided"
    | "unsatisfied"
}

export type CompatibilityReport = {
  readonly compatible: boolean
  readonly checks: readonly CompatibilityCheck[]
}

export function evaluateCompatibility(
  manifests: readonly ComponentManifest[],
  providedApis: Readonly<Record<string, string>>,
): CompatibilityReport {
  const checks: CompatibilityCheck[] = []
  for (const manifest of [...manifests].sort((left, right) =>
    left.id.localeCompare(right.id) || left.version.localeCompare(right.version),
  )) {
    for (const [api, required] of Object.entries(manifest.compatibility).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const provided = Object.hasOwn(providedApis, api) ? providedApis[api] ?? null : null
      let status: CompatibilityCheck["status"]
      if (validRange(required) === null) {
        status = "invalid_requirement"
      } else if (provided === null) {
        status = "missing"
      } else if (valid(provided) === null) {
        status = "invalid_provided"
      } else if (!satisfies(provided, required)) {
        status = "unsatisfied"
      } else {
        status = "matched"
      }
      checks.push({
        componentId: manifest.id,
        componentVersion: manifest.version,
        api,
        required,
        provided,
        status,
      })
    }
  }
  return {
    compatible: checks.every(({ status }) => status === "matched"),
    checks,
  }
}
