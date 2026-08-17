export const PRODUCT = {
  projectDirectoryName: "Gen1Recomp Native 049",
  version: "0.4.9",
  build: "049",
  privateDirectoryName: "Gen1Recomp",
  packagedRuntimeDirectory: "runtime-v049",
  runtimeShellDirectory: "runtime-shell-v049",
  packagedPayloadSha256: "6ab3a495ecf6619831732eb9022d8da43a4473c958848adffc3a8c39de939943",
  systemCatalogURL: "https://raw.githubusercontent.com/workspacedive/gen1recomp/main/updates/catalog/stable.json",
  systemCatalogId: "org.gen1recomp.system",
  systemCatalogSequence: 5,
  artifactBaseURL: "https://raw.githubusercontent.com/workspacedive/gen1recomp/main/updates/artifacts/",
  catalogMaximumCharacters: 1_000_000,
  artifactMaximumBytes: 32 * 1024 * 1024,
  modArchiveMaximumBytes: 64 * 1024 * 1024,
  modExpandedMaximumBytes: 256 * 1024 * 1024,
  modMaximumEntries: 4096,
  githubAPIVersion: "2026-03-10",
  networkTimeoutSeconds: 20,
} as const

export const COMPONENTS = {
  runtime: {
    id: "org.gen1recomp.runtime.lovejs",
    label: "LÖVE / Lua Runtime",
    installedVersion: "0.1.0",
    kind: "runtime",
    files: [
      "player.js",
      "11.5/love.js",
      "11.5/love.wasm",
      "lua/normalize1.lua",
      "lua/normalize2.lua",
    ],
  },
  core: {
    id: "org.gen1recomp.core",
    label: "Gen1Recomp Core",
    installedVersion: "0.5.0",
    kind: "core",
    files: ["gen1recomp.love"],
  },
} as const

export type ProductComponentId = typeof COMPONENTS.runtime.id | typeof COMPONENTS.core.id

export const PROVIDED_APIS: Readonly<Record<string, string>> = {
  hostProtocol: "1.0.0",
  platformApi: "1.0.0",
  kernelApi: "1.0.0",
  loveApi: "11.5.0",
  modApi: "2.0.0",
}

export const RUNTIME_SHELL_FILES = [
  "index.html",
  "preview.css",
  "preview-bootstrap.js",
  "preview-loader.js",
  "preview-bundle.js",
  "runtime-config.js",
  "maintenance.html",
  "maintenance.js",
] as const
