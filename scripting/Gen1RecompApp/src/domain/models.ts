import { COMPONENTS, type ProductComponentId } from "../config/product"

export type SemanticVersion = {
  readonly major: number
  readonly minor: number
  readonly patch: number
}

export type CatalogDependency = {
  readonly id: ProductComponentId
  readonly range: string
  readonly optional: boolean
}

export type CatalogManifest = {
  readonly id: ProductComponentId
  readonly kind: "runtime" | "core"
  readonly version: string
  readonly artifact: {
    readonly path: string
    readonly size: number
    readonly sha256: string
  }
  readonly dependencies: readonly CatalogDependency[]
  readonly compatibility: Readonly<Record<string, string>>
}

export type CatalogRelease = {
  readonly manifest: CatalogManifest
  readonly publishedAt: string
  readonly notes: { readonly en: string; readonly de?: string }
}

export type SystemCatalog = {
  readonly id: string
  readonly sequence: number
  readonly generatedAt: string
  readonly artifactBaseURL: string
  readonly releases: readonly CatalogRelease[]
}

export type ActiveComponents = Readonly<Record<ProductComponentId, string>>

export type PersistentProductState = {
  readonly schemaVersion: 1
  readonly active: ActiveComponents
  readonly knownGood: ActiveComponents
  readonly previous: ActiveComponents | null
  readonly activeRuntimeRoot: string | null
  readonly knownGoodRuntimeRoot: string | null
  readonly previousRuntimeRoot: string | null
  readonly acceptedCatalogSequence: number
  readonly updatedAt: string
}

export type ComponentUpdateRow = {
  readonly id: ProductComponentId
  readonly label: string
  readonly installedVersion: string
  readonly availableVersion: string
  readonly release: CatalogRelease
  readonly updateAvailable: boolean
}

export type UpdateSnapshot = {
  readonly components: readonly ComponentUpdateRow[]
  readonly checkedAt: string | null
  readonly catalogSequence: number | null
}

export type UpdateMutationStage =
  | "catalog"
  | "planning"
  | "download"
  | "integrity"
  | "archive"
  | "staging"
  | "activation"
  | "health"

export type UpdateViewState =
  | { readonly status: "loading" }
  | { readonly status: "content"; readonly snapshot: UpdateSnapshot }
  | { readonly status: "checking"; readonly previous: UpdateSnapshot }
  | {
      readonly status: "installing"
      readonly previous: UpdateSnapshot
      readonly stage: UpdateMutationStage
      readonly componentLabel: string | null
    }
  | { readonly status: "success"; readonly snapshot: UpdateSnapshot; readonly message: string }
  | { readonly status: "error"; readonly previous: UpdateSnapshot; readonly message: string; readonly canRetry: boolean }

export type ProductTabId = "home" | "games" | "updates" | "mods" | "settings"

export type ProductTabDefinition = {
  readonly id: ProductTabId
  readonly titleKey: "tabHome" | "tabGames" | "tabUpdates" | "tabMods" | "tabSettings"
  readonly systemImage: string
  readonly enabled: boolean
}

export const PRODUCT_TABS: readonly ProductTabDefinition[] = [
  { id: "home", titleKey: "tabHome", systemImage: "house.fill", enabled: true },
  { id: "games", titleKey: "tabGames", systemImage: "square.grid.2x2.fill", enabled: true },
  { id: "updates", titleKey: "tabUpdates", systemImage: "arrow.down.circle.fill", enabled: true },
  { id: "mods", titleKey: "tabMods", systemImage: "puzzlepiece.extension.fill", enabled: true },
  { id: "settings", titleKey: "tabSettings", systemImage: "gearshape.fill", enabled: true },
]

export function defaultPersistentState(now: string): PersistentProductState {
  const active: ActiveComponents = {
    [COMPONENTS.runtime.id]: COMPONENTS.runtime.installedVersion,
    [COMPONENTS.core.id]: COMPONENTS.core.installedVersion,
  }
  return {
    schemaVersion: 1,
    active,
    knownGood: active,
    previous: null,
    activeRuntimeRoot: null,
    knownGoodRuntimeRoot: null,
    previousRuntimeRoot: null,
    acceptedCatalogSequence: 0,
    updatedAt: now,
  }
}

export function emptyUpdateSnapshot(state: PersistentProductState): UpdateSnapshot {
  return {
    checkedAt: null,
    catalogSequence: null,
    components: [
      {
        id: COMPONENTS.runtime.id,
        label: COMPONENTS.runtime.label,
        installedVersion: state.active[COMPONENTS.runtime.id],
        availableVersion: state.active[COMPONENTS.runtime.id],
        release: {
          manifest: {
            id: COMPONENTS.runtime.id,
            kind: "runtime",
            version: state.active[COMPONENTS.runtime.id],
            artifact: { path: "", size: 0, sha256: "" },
            dependencies: [],
            compatibility: {},
          },
          publishedAt: state.updatedAt,
          notes: { en: "" },
        },
        updateAvailable: false,
      },
      {
        id: COMPONENTS.core.id,
        label: COMPONENTS.core.label,
        installedVersion: state.active[COMPONENTS.core.id],
        availableVersion: state.active[COMPONENTS.core.id],
        release: {
          manifest: {
            id: COMPONENTS.core.id,
            kind: "core",
            version: state.active[COMPONENTS.core.id],
            artifact: { path: "", size: 0, sha256: "" },
            dependencies: [],
            compatibility: {},
          },
          publishedAt: state.updatedAt,
          notes: { en: "" },
        },
        updateAvailable: false,
      },
    ],
  }
}
