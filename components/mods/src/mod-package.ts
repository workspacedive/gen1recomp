import { validateArchiveEntries, type ArchiveEntry, type ArchiveLimits } from "../../updates/src/archive-policy.js"
import { err, ok, type Result } from "../../contracts/src/result.js"

export type ModPackagePolicy = {
  readonly archive: ArchiveLimits
  readonly maximumRootFiles: number
}

export type ValidatedModPackage = {
  readonly rootPrefix: string
  readonly manifestPath: string
  readonly relativeFiles: readonly string[]
  readonly totalBytes: number
}

export type ModPackageError = {
  readonly code:
    | "archive_policy"
    | "missing_manifest"
    | "ambiguous_root"
    | "forbidden_content"
    | "too_many_files"
    | "missing_entry"
  readonly path: string | null
  readonly message: string
}

const FORBIDDEN_EXTENSIONS = new Set([
  ".gb", ".gbc", ".gba", ".nds", ".n64", ".z64", ".v64",
  ".ips", ".bps", ".ups", ".xdelta", ".ppf",
  ".exe", ".dll", ".dylib", ".so", ".luac",
])

function packageError(
  code: ModPackageError["code"],
  message: string,
  path: string | null = null,
): Result<never, ModPackageError> {
  return err({ code, path, message })
}

function extension(path: string): string {
  const file = path.slice(path.lastIndexOf("/") + 1).toLowerCase()
  const dot = file.lastIndexOf(".")
  return dot < 0 ? "" : file.slice(dot)
}

function hasForbiddenContent(relativePath: string): boolean {
  const parts = relativePath.toLowerCase().split("/")
  return parts.includes("baserom")
    || parts.includes("baseroms")
    || parts.includes("rom")
    || parts.includes("roms")
    || parts.includes(".git")
    || parts.includes(".github")
    || parts.includes(".gitignore")
    || parts.includes(".gitattributes")
    || FORBIDDEN_EXTENSIONS.has(extension(relativePath))
}

export function locateModRoot(paths: readonly string[]): Result<string, ModPackageError> {
  if (paths.includes("manifest.json")) return ok("")
  const roots = new Set<string>()
  const manifestRoots = new Set<string>()
  for (const path of paths) {
    const slash = path.indexOf("/")
    if (slash <= 0) continue
    const root = path.slice(0, slash)
    roots.add(root)
    if (path === `${root}/manifest.json`) manifestRoots.add(root)
  }
  if (roots.size === 1 && manifestRoots.size === 1) return ok([...manifestRoots][0]!)
  if (roots.size > 1) return packageError("ambiguous_root", "mod archive must contain files at root or one top-level mod folder")
  return packageError("missing_manifest", "mod archive has no manifest.json at an accepted root")
}

export function validateModPackageInventory(
  entries: readonly ArchiveEntry[],
  policy: ModPackagePolicy,
): Result<ValidatedModPackage, ModPackageError> {
  const archive = validateArchiveEntries(entries, policy.archive)
  if (!archive.ok) return packageError("archive_policy", archive.error.message, archive.error.entry)
  const filePaths = entries.filter(({ kind }) => kind === "file").map(({ path }) => path)
  if (filePaths.length > policy.maximumRootFiles) {
    return packageError("too_many_files", "mod package contains too many files")
  }
  const root = locateModRoot(filePaths)
  if (!root.ok) return root
  const prefix = root.value === "" ? "" : `${root.value}/`
  const relativeFiles = filePaths.map((path) => path.startsWith(prefix) ? path.slice(prefix.length) : path)
  for (const relative of relativeFiles) {
    if (relative === "" || hasForbiddenContent(relative)) {
      return packageError("forbidden_content", "mod package contains ROM, patch, native executable, bytecode, repository, or baserom content", relative)
    }
  }
  const manifestPath = `${prefix}manifest.json`
  if (!filePaths.includes(manifestPath)) return packageError("missing_manifest", "mod package manifest is missing", manifestPath)
  return ok({
    rootPrefix: root.value,
    manifestPath,
    relativeFiles: [...relativeFiles].sort(),
    totalBytes: archive.value.totalBytes,
  })
}

export function verifyManifestFiles(
  inventory: ValidatedModPackage,
  manifest: {
    readonly entry: string
    readonly optionsSchema: string | null
    readonly assetsTransforms: string | null
  },
): Result<void, ModPackageError> {
  const files = new Set(inventory.relativeFiles)
  for (const path of [manifest.entry, manifest.optionsSchema, manifest.assetsTransforms]) {
    if (path !== null && !files.has(path)) {
      return packageError("missing_entry", `manifest file is missing: ${path}`, path)
    }
  }
  return ok(undefined)
}
