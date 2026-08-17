import { valid } from "semver"

import { isRecord } from "../../contracts/src/json.js"
import { err, ok, type Result } from "../../contracts/src/result.js"
import { normalizeGitHubRepository } from "./mod-manifest.js"

export type GitHubReleaseAsset = {
  readonly id: number
  readonly name: string
  readonly size: number
  readonly sha256: string
  readonly contentType: string
  readonly downloadURL: string
}

export type GitHubModRelease = {
  readonly repository: string
  readonly tag: string
  readonly version: string
  readonly name: string
  readonly body: string
  readonly publishedAt: string
  readonly prerelease: boolean
  readonly asset: GitHubReleaseAsset
}

export type GitHubReleasePolicy = {
  readonly maximumAssetBytes: number
  readonly allowPrerelease: boolean
  readonly requireGitHubDigest: boolean
}

export type GitHubReleaseError = {
  readonly code:
    | "invalid_repository"
    | "invalid_release"
    | "draft"
    | "prerelease"
    | "invalid_version"
    | "missing_asset"
    | "ambiguous_asset"
    | "missing_digest"
    | "unsafe_url"
    | "size"
  readonly message: string
}

function releaseError(
  code: GitHubReleaseError["code"],
  message: string,
): Result<never, GitHubReleaseError> {
  return err({ code, message })
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false
  const date = new Date(value)
  return Number.isFinite(date.getTime())
}

function parseAsset(
  value: unknown,
  repository: string,
  policy: GitHubReleasePolicy,
): Result<GitHubReleaseAsset, GitHubReleaseError> {
  if (!isRecord(value)
    || !Number.isSafeInteger(value["id"])
    || typeof value["name"] !== "string"
    || value["state"] !== "uploaded"
    || !Number.isSafeInteger(value["size"])
    || (value["size"] as number) <= 0
    || typeof value["browser_download_url"] !== "string") {
    return releaseError("invalid_release", "GitHub release asset has an invalid shape")
  }
  if ((value["size"] as number) > policy.maximumAssetBytes) {
    return releaseError("size", `GitHub release asset exceeds ${policy.maximumAssetBytes} bytes`)
  }
  const digest = value["digest"]
  if (policy.requireGitHubDigest && (typeof digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(digest))) {
    return releaseError("missing_digest", "GitHub release asset has no immutable SHA-256 digest")
  }
  const sha256 = typeof digest === "string" && /^sha256:[a-f0-9]{64}$/.test(digest)
    ? digest.slice("sha256:".length)
    : ""
  const [owner, repo] = repository.split("/")
  let url: URL
  try {
    url = new URL(value["browser_download_url"])
  } catch {
    return releaseError("unsafe_url", "GitHub release asset URL is invalid")
  }
  const prefix = `/${owner}/${repo}/releases/download/`
  if (url.protocol !== "https:" || url.hostname !== "github.com" || !url.pathname.toLowerCase().startsWith(prefix.toLowerCase()) || url.username !== "" || url.password !== "") {
    return releaseError("unsafe_url", "GitHub release asset URL left the selected repository")
  }
  return ok({
    id: value["id"] as number,
    name: value["name"],
    size: value["size"] as number,
    sha256,
    contentType: typeof value["content_type"] === "string" ? value["content_type"] : "application/octet-stream",
    downloadURL: url.toString(),
  })
}

function pickAsset(
  values: readonly unknown[],
  repository: string,
  version: string,
  modId: string | null,
  policy: GitHubReleasePolicy,
): Result<GitHubReleaseAsset, GitHubReleaseError> {
  const parsed: GitHubReleaseAsset[] = []
  for (const candidate of values) {
    if (!isRecord(candidate) || typeof candidate["name"] !== "string" || !candidate["name"].toLowerCase().endsWith(".zip")) continue
    const asset = parseAsset(candidate, repository, policy)
    if (!asset.ok) return asset
    parsed.push(asset.value)
  }
  if (parsed.length === 0) return releaseError("missing_asset", "GitHub release has no installable ZIP asset")
  if (modId !== null) {
    const exact = parsed.find(({ name }) => name === `${modId}-${version}.zip`)
    if (exact !== undefined) return ok(exact)
    const prefix = parsed.filter(({ name }) => name.toLowerCase().startsWith(modId.toLowerCase()))
    if (prefix.length === 1) return ok(prefix[0]!)
  }
  if (parsed.length === 1) return ok(parsed[0]!)
  return releaseError("ambiguous_asset", "GitHub release has multiple ZIP assets and no unambiguous mod package")
}

export function parseGitHubModRelease(
  value: unknown,
  repositoryInput: string,
  modId: string | null,
  policy: GitHubReleasePolicy,
): Result<GitHubModRelease, GitHubReleaseError> {
  const normalized = normalizeGitHubRepository(repositoryInput)
  if (!normalized.ok || normalized.value === null) {
    return releaseError("invalid_repository", "GitHub repository must be owner/repo")
  }
  const repository = normalized.value
  if (!isRecord(value) || typeof value["tag_name"] !== "string" || !Array.isArray(value["assets"])) {
    return releaseError("invalid_release", "GitHub release response is invalid")
  }
  if (value["draft"] === true) return releaseError("draft", "draft GitHub releases cannot be installed")
  const prerelease = value["prerelease"] === true
  if (prerelease && !policy.allowPrerelease) return releaseError("prerelease", "prerelease channel is disabled")
  const version = value["tag_name"].replace(/^[vV]/, "")
  if (valid(version) === null) return releaseError("invalid_version", "GitHub release tag is not canonical semantic versioning")
  const asset = pickAsset(value["assets"], repository, version, modId, policy)
  if (!asset.ok) return asset
  const publishedAt = value["published_at"] ?? value["created_at"]
  if (!canonicalTimestamp(publishedAt)) return releaseError("invalid_release", "GitHub release date is invalid")
  return ok({
    repository,
    tag: value["tag_name"],
    version,
    name: typeof value["name"] === "string" && value["name"].trim().length > 0 ? value["name"] : value["tag_name"],
    body: typeof value["body"] === "string" ? value["body"] : "",
    publishedAt,
    prerelease,
    asset: asset.value,
  })
}
