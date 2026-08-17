import { err, ok, type Result } from "../../contracts/src/result.js"

export type ArchiveEntry = {
  readonly path: string
  readonly kind: "file" | "directory" | "symlink"
  readonly uncompressedSize: number
  readonly compressedSize: number
}

export type ArchiveLimits = {
  readonly maximumEntries: number
  readonly maximumPathDepth: number
  readonly maximumPathLength: number
  readonly maximumFileBytes: number
  readonly maximumTotalBytes: number
  readonly maximumCompressionRatio: number
}

export type ArchiveRejection = {
  readonly code:
    | "invalid_limit"
    | "too_many_entries"
    | "invalid_path"
    | "path_collision"
    | "symlink"
    | "invalid_size"
    | "file_too_large"
    | "archive_too_large"
    | "compression_ratio"
  readonly entry: string | null
  readonly message: string
}

function rejection(
  code: ArchiveRejection["code"],
  message: string,
  entry: string | null = null,
): Result<never, ArchiveRejection> {
  return err({ code, entry, message })
}

function validateLimits(limits: ArchiveLimits): Result<void, ArchiveRejection> {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      return rejection("invalid_limit", `${name} must be a positive safe integer`)
    }
  }
  return ok(undefined)
}

function validatePath(path: string, limits: ArchiveLimits): Result<string, ArchiveRejection> {
  if (
    path.length === 0 ||
    path.length > limits.maximumPathLength ||
    /[\u0000-\u001f\u007f]/.test(path) ||
    path.includes("\\") ||
    path.startsWith("/") ||
    /^[A-Za-z]:/.test(path) ||
    path !== path.normalize("NFC")
  ) {
    return rejection("invalid_path", "entry path is not a safe normalized relative path", path)
  }
  const components = path.split("/")
  if (
    components.length > limits.maximumPathDepth ||
    components.some((component) => component === "" || component === "." || component === "..")
  ) {
    return rejection("invalid_path", "entry path has invalid components or excessive depth", path)
  }
  return ok(components.join("/"))
}

export function validateArchiveEntries(
  entries: readonly ArchiveEntry[],
  limits: ArchiveLimits,
): Result<{ readonly totalBytes: number; readonly files: number }, ArchiveRejection> {
  const validLimits = validateLimits(limits)
  if (!validLimits.ok) return validLimits
  if (entries.length > limits.maximumEntries) {
    return rejection("too_many_entries", `archive contains ${entries.length} entries`)
  }

  const paths = new Set<string>()
  const pathKinds = new Map<string, ArchiveEntry["kind"]>()
  let totalBytes = 0
  let files = 0
  for (const entry of entries) {
    const policyPath = entry.kind === "directory" && entry.path.endsWith("/")
      ? entry.path.slice(0, -1)
      : entry.path
    const parsedPath = validatePath(policyPath, limits)
    if (!parsedPath.ok) return parsedPath
    const collisionKey = parsedPath.value.toLocaleLowerCase("en-US")
    if (paths.has(collisionKey)) {
      return rejection("path_collision", "entry collides under case-insensitive lookup", entry.path)
    }
    paths.add(collisionKey)
    pathKinds.set(collisionKey, entry.kind)

    if (entry.kind === "symlink") {
      return rejection("symlink", "symbolic links are not accepted", entry.path)
    }
    if (
      !Number.isSafeInteger(entry.uncompressedSize) ||
      entry.uncompressedSize < 0 ||
      !Number.isSafeInteger(entry.compressedSize) ||
      entry.compressedSize < 0
    ) {
      return rejection("invalid_size", "entry sizes must be non-negative safe integers", entry.path)
    }
    if (entry.kind === "directory" && (entry.uncompressedSize !== 0 || entry.compressedSize !== 0)) {
      return rejection("invalid_size", "directory entries must have zero sizes", entry.path)
    }
    if (entry.kind === "file") {
      files += 1
      if (entry.uncompressedSize > limits.maximumFileBytes) {
        return rejection("file_too_large", "entry exceeds the configured file limit", entry.path)
      }
      totalBytes += entry.uncompressedSize
      if (!Number.isSafeInteger(totalBytes) || totalBytes > limits.maximumTotalBytes) {
        return rejection("archive_too_large", "archive exceeds the configured total limit", entry.path)
      }
      const ratio = entry.compressedSize === 0
        ? entry.uncompressedSize === 0 ? 1 : Number.POSITIVE_INFINITY
        : entry.uncompressedSize / entry.compressedSize
      if (ratio > limits.maximumCompressionRatio) {
        return rejection("compression_ratio", "entry exceeds the configured expansion ratio", entry.path)
      }
    }
  }
  for (const path of pathKinds.keys()) {
    const components = path.split("/")
    for (let depth = 1; depth < components.length; depth += 1) {
      const ancestor = components.slice(0, depth).join("/")
      if (pathKinds.get(ancestor) === "file") {
        return rejection("path_collision", "file entry is also an ancestor of another archive entry", path)
      }
    }
  }
  return ok({ totalBytes, files })
}
