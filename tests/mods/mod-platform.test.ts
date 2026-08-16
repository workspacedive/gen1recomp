import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizeGitHubRepository,
  parseGen1RecompModManifest,
} from "../../components/mods/src/mod-manifest.js"
import {
  locateModRoot,
  validateModPackageInventory,
  verifyManifestFiles,
} from "../../components/mods/src/mod-package.js"
import { parseGitHubModRelease } from "../../components/mods/src/github-release.js"

const potatoLikeManifest = {
  id: "potato_voxel",
  name: "PotatoVoxel",
  version: "1.7.4",
  log_url: "https://logs.example.test/project/logs",
  api: 2,
  entry: "main.lua",
  profile: "content",
  category: "GRAPHICS",
  game_version: "0.0.0-dev || >=0.1.37 <2.0.0",
  priority: 100,
  dependencies: [],
  optional_dependencies: [],
  conflicts: ["DRAMATIC_SHAPE", "BATTLE_ART_VOXEL_FORK"],
  permissions: ["engine_internals", "network"],
  affects_link: false,
  github: "ShaneMcGovernIE/potato_voxel",
  description: "Performance-oriented voxel renderer.",
}

const packagePolicy = {
  archive: {
    maximumEntries: 64,
    maximumPathDepth: 8,
    maximumPathLength: 200,
    maximumFileBytes: 2_000_000,
    maximumTotalBytes: 4_000_000,
    maximumCompressionRatio: 100,
  },
  maximumRootFiles: 32,
}

test("manifest parser accepts a current API-2 GitHub mod with scoped high-risk permissions", () => {
  const parsed = parseGen1RecompModManifest(potatoLikeManifest)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.value.id, "potato_voxel")
  assert.equal(parsed.value.github, "ShaneMcGovernIE/potato_voxel")
  assert.deepEqual(parsed.value.permissions, ["engine_internals", "network"])
  assert.deepEqual(parsed.value.conflicts.map(({ id }) => id), ["DRAMATIC_SHAPE", "BATTLE_ART_VOXEL_FORK"])
  assert.equal(parsed.value.affectsLink, false)
})

test("manifest parser handles dependency sources, game scopes, and user-owned imports", () => {
  const parsed = parseGen1RecompModManifest({
    ...potatoLikeManifest,
    id: "consumer_mod",
    github: "https://github.com/example/consumer_mod.git",
    dependencies: [
      "helper@^1.2.0#example/helper",
      { id: "gold_helper", range: ">=2 <3", games: ["gen2"], github: "example/gold_helper" },
      "shared_helper@^1.0.0",
    ],
    dependency_sources: { shared_helper: "example/shared_helper" },
    optional_imports: [{
      id: "bonus",
      name: "Optional source",
      file: "bonus.bin",
      md5: ["a".repeat(32)],
      max_size: 1024,
    }],
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.value.github, "example/consumer_mod")
  assert.equal(parsed.value.dependencies[0]?.github, "example/helper")
  assert.deepEqual(parsed.value.dependencies[1]?.games, ["gen2"])
  assert.equal(parsed.value.dependencies[2]?.github, "example/shared_helper")
  assert.equal(parsed.value.optionalImports[0]?.maximumSize, 1024)
})

test("manifest parser fails closed on unknown fields, unsafe entry, permission, and log disclosure mismatch", () => {
  assert.equal(parseGen1RecompModManifest({ ...potatoLikeManifest, surprise: true }).ok, false)
  assert.equal(parseGen1RecompModManifest({ ...potatoLikeManifest, entry: "../main.lua" }).ok, false)
  assert.equal(parseGen1RecompModManifest({ ...potatoLikeManifest, permissions: ["root"] }).ok, false)
  const noNetwork = parseGen1RecompModManifest({ ...potatoLikeManifest, permissions: ["engine_internals"] })
  assert.equal(noNetwork.ok, false)
  if (!noNetwork.ok) assert.equal(noNetwork.error.code, "invalid_permission")
  assert.equal(normalizeGitHubRepository("https://evil.example/owner/repo").ok, false)
})

test("archive inventory accepts root and single-folder package shapes", () => {
  const root = validateModPackageInventory([
    { path: "manifest.json", kind: "file", compressedSize: 80, uncompressedSize: 120 },
    { path: "main.lua", kind: "file", compressedSize: 100, uncompressedSize: 220 },
    { path: "lib/render.lua", kind: "file", compressedSize: 200, uncompressedSize: 500 },
  ], packagePolicy)
  assert.equal(root.ok, true)
  if (root.ok) {
    assert.equal(root.value.rootPrefix, "")
    assert.equal(verifyManifestFiles(root.value, {
      entry: "main.lua",
      optionsSchema: null,
      assetsTransforms: null,
    }).ok, true)
  }

  const wrapped = locateModRoot(["potato_voxel/manifest.json", "potato_voxel/main.lua"])
  assert.deepEqual(wrapped, { ok: true, value: "potato_voxel" })
})

test("archive inventory rejects ambiguous roots, ROM/patch/native content, symlinks, and missing manifest files", () => {
  assert.equal(locateModRoot(["a/manifest.json", "b/file.lua"]).ok, false)
  for (const path of ["baseroms/game.gbc", "patches/game.bps", "lib/native.dylib", "compiled.luac", ".github/workflows/release.yml"]) {
    const result = validateModPackageInventory([
      { path: "manifest.json", kind: "file", compressedSize: 10, uncompressedSize: 10 },
      { path: "main.lua", kind: "file", compressedSize: 10, uncompressedSize: 10 },
      { path, kind: "file", compressedSize: 10, uncompressedSize: 10 },
    ], packagePolicy)
    assert.equal(result.ok, false, path)
    if (!result.ok) assert.equal(result.error.code, "forbidden_content")
  }
  assert.equal(validateModPackageInventory([
    { path: "manifest.json", kind: "file", compressedSize: 10, uncompressedSize: 10 },
    { path: "main.lua", kind: "symlink", compressedSize: 0, uncompressedSize: 0 },
  ], packagePolicy).ok, false)
  const valid = validateModPackageInventory([
    { path: "manifest.json", kind: "file", compressedSize: 10, uncompressedSize: 10 },
  ], packagePolicy)
  assert.equal(valid.ok, true)
  if (valid.ok) assert.equal(verifyManifestFiles(valid.value, {
    entry: "main.lua",
    optionsSchema: null,
    assetsTransforms: null,
  }).ok, false)
})

const githubRelease = {
  tag_name: "v1.7.4",
  name: "1.7.4",
  body: "Fixes and performance improvements.",
  draft: false,
  prerelease: false,
  published_at: "2026-08-16T22:17:02Z",
  assets: [{
    id: 517277663,
    name: "potato_voxel-1.7.4.zip",
    state: "uploaded",
    content_type: "application/zip",
    size: 641004,
    digest: `sha256:${"2".repeat(64)}`,
    browser_download_url: "https://github.com/ShaneMcGovernIE/potato_voxel/releases/download/v1.7.4/potato_voxel-1.7.4.zip",
  }],
}

const githubPolicy = {
  maximumAssetBytes: 64 * 1024 * 1024,
  allowPrerelease: false,
  requireGitHubDigest: true,
}

test("GitHub release parser binds repository, semantic tag, exact asset, size, URL, and digest", () => {
  const result = parseGitHubModRelease(githubRelease, "ShaneMcGovernIE/potato_voxel", "potato_voxel", githubPolicy)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.version, "1.7.4")
  assert.equal(result.value.asset.id, 517277663)
  assert.equal(result.value.asset.sha256, "2".repeat(64))
})

test("GitHub release parser rejects missing digest, prerelease, cross-repository URL, and ambiguous ZIPs", () => {
  const noDigest = structuredClone(githubRelease)
  delete (noDigest.assets[0] as Partial<typeof githubRelease.assets[0]>).digest
  assert.equal(parseGitHubModRelease(noDigest, "ShaneMcGovernIE/potato_voxel", "potato_voxel", githubPolicy).ok, false)
  assert.equal(parseGitHubModRelease({ ...githubRelease, prerelease: true }, "ShaneMcGovernIE/potato_voxel", "potato_voxel", githubPolicy).ok, false)
  const escaped = structuredClone(githubRelease)
  escaped.assets[0]!.browser_download_url = "https://github.com/evil/repo/releases/download/v1.7.4/potato_voxel-1.7.4.zip"
  assert.equal(parseGitHubModRelease(escaped, "ShaneMcGovernIE/potato_voxel", "potato_voxel", githubPolicy).ok, false)
  const ambiguous = { ...githubRelease, assets: [
    { ...githubRelease.assets[0], name: "first.zip" },
    { ...githubRelease.assets[0], id: 2, name: "second.zip" },
  ] }
  assert.equal(parseGitHubModRelease(ambiguous, "ShaneMcGovernIE/potato_voxel", null, githubPolicy).ok, false)
})
