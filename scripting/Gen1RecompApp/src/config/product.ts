export const PRODUCT = {
  projectDirectoryName: "Gen1Recomp Native 020",
  version: "0.2.0",
  build: "020",
  privateDirectoryName: "Gen1Recomp",
  packagedRuntimeDirectory: "runtime-v020",
  runtimeShellDirectory: "runtime-shell-v020",
  systemCatalogURL: "https://raw.githubusercontent.com/workspacedive/gen1recomp/main/updates/catalog/stable.json",
  systemCatalogId: "org.gen1recomp.system",
  systemCatalogSequence: 1,
  artifactBaseURL: "https://raw.githubusercontent.com/workspacedive/gen1recomp/main/updates/artifacts/",
  catalogMaximumCharacters: 1_000_000,
  artifactMaximumBytes: 32 * 1024 * 1024,
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
    installedVersion: "0.1.96",
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
] as const
