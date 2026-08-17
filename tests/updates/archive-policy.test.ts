import assert from "node:assert/strict"
import test from "node:test"

import {
  validateArchiveEntries,
  type ArchiveLimits,
} from "../../components/updates/src/archive-policy.js"

const limits: ArchiveLimits = {
  maximumEntries: 10,
  maximumPathDepth: 8,
  maximumPathLength: 128,
  maximumFileBytes: 1024,
  maximumTotalBytes: 2048,
  maximumCompressionRatio: 100,
}

test("archive policy accepts bounded regular files and directories", () => {
  const result = validateArchiveEntries([
    { path: "mod/", kind: "directory", compressedSize: 0, uncompressedSize: 0 },
    { path: "mod/manifest.json", kind: "file", compressedSize: 30, uncompressedSize: 80 },
    { path: "mod/main.lua", kind: "file", compressedSize: 20, uncompressedSize: 50 },
  ], limits)
  assert.deepEqual(result, { ok: true, value: { files: 2, totalBytes: 130 } })
})

test("archive policy rejects traversal, absolute, Windows, and decomposed paths", () => {
  for (const path of ["../escape", "/absolute", "C:/drive", "mod\\file", "mod/e\u0301.lua", "control\u0001/file"]) {
    const result = validateArchiveEntries([
      { path, kind: "file", compressedSize: 1, uncompressedSize: 1 },
    ], limits)
    assert.equal(result.ok, false, path)
    if (!result.ok) assert.equal(result.error.code, "invalid_path")
  }
})

test("archive policy rejects case-insensitive collisions and symbolic links", () => {
  const collision = validateArchiveEntries([
    { path: "mod/Main.lua", kind: "file", compressedSize: 1, uncompressedSize: 1 },
    { path: "mod/main.lua", kind: "file", compressedSize: 1, uncompressedSize: 1 },
  ], limits)
  assert.equal(collision.ok, false)
  if (!collision.ok) assert.equal(collision.error.code, "path_collision")

  const symlink = validateArchiveEntries([
    { path: "mod/current", kind: "symlink", compressedSize: 0, uncompressedSize: 0 },
  ], limits)
  assert.equal(symlink.ok, false)
  if (!symlink.ok) assert.equal(symlink.error.code, "symlink")
})

test("archive policy rejects a file that is also an ancestor path", () => {
  const result = validateArchiveEntries([
    { path: "mods", kind: "file", compressedSize: 1, uncompressedSize: 1 },
    { path: "mods/example/main.lua", kind: "file", compressedSize: 1, uncompressedSize: 1 },
  ], limits)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, "path_collision")
})

test("archive policy rejects expansion bombs and aggregate overflow", () => {
  const expansion = validateArchiveEntries([
    { path: "huge.lua", kind: "file", compressedSize: 1, uncompressedSize: 101 },
  ], limits)
  assert.equal(expansion.ok, false)
  if (!expansion.ok) assert.equal(expansion.error.code, "compression_ratio")

  const overflow = validateArchiveEntries([
    { path: "one.bin", kind: "file", compressedSize: 20, uncompressedSize: 1024 },
    { path: "two.bin", kind: "file", compressedSize: 20, uncompressedSize: 1024 },
    { path: "three.bin", kind: "file", compressedSize: 20, uncompressedSize: 1 },
  ], limits)
  assert.equal(overflow.ok, false)
  if (!overflow.ok) assert.equal(overflow.error.code, "archive_too_large")
})
