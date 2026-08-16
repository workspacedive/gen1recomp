export type NativeModPermission = "network" | "filesystem" | "engine_internals" | "steps" | "background"

export type InstalledMod = {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly api: 1 | 2
  readonly entry: string
  readonly category: string
  readonly profile: "content" | "overhaul" | "total_conversion"
  readonly description: string
  readonly github: string | null
  readonly permissions: readonly NativeModPermission[]
  readonly conflicts: readonly string[]
  readonly dependencies: readonly string[]
  readonly packagePath: string
  readonly packageSha256: string
  readonly source: "manual" | "github"
  readonly releaseTag: string | null
  readonly previousVersion: string | null
  readonly enabled: boolean
  readonly installedAt: string
  readonly updatedAt: string
}

export type ModRegistry = {
  readonly schemaVersion: 1
  readonly mods: readonly InstalledMod[]
  readonly updatedAt: string
}

export type GitHubAvailableUpdate = {
  readonly modId: string
  readonly repository: string
  readonly version: string
  readonly tag: string
  readonly assetName: string
  readonly assetSize: number
  readonly assetSha256: string
  readonly downloadURL: string
  readonly notes: string
  readonly publishedAt: string
}

export type ModSnapshot = {
  readonly mods: readonly InstalledMod[]
  readonly updates: Readonly<Record<string, GitHubAvailableUpdate>>
  readonly checkedAt: string | null
}

export type ModOperationStage =
  | "github"
  | "download"
  | "integrity"
  | "archive"
  | "manifest"
  | "installing"
  | "registry"

export type ModViewState =
  | { readonly status: "loading" }
  | { readonly status: "content"; readonly snapshot: ModSnapshot }
  | { readonly status: "working"; readonly previous: ModSnapshot; readonly stage: ModOperationStage; readonly label: string | null }
  | { readonly status: "success"; readonly snapshot: ModSnapshot; readonly message: string }
  | { readonly status: "error"; readonly previous: ModSnapshot; readonly message: string; readonly canRetry: boolean }
