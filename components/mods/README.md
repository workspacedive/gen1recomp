# Mod package primitives

Host-independent validation used by the native Mods package-management slice.

- `mod-manifest.ts` parses the upstream Gen1Recomp API-1/API-2 manifest surface, semantic versions/ranges, game-scoped dependencies, GitHub hints, conflicts, user-owned imports, profiles and permissions. Unknown fields and unsafe paths fail closed.
- `github-release.ts` binds a public GitHub repository, stable semantic release tag, uploaded ZIP asset, bounded size, repository-scoped HTTPS URL and GitHub-provided SHA-256 digest. Missing/ambiguous assets, prereleases and cross-repository URLs are rejected.
- `mod-package.ts` accepts the two upstream package shapes (`manifest.json` at root or under one top-level folder) and applies the common archive policy plus mod-specific rejection of ROMs, ROM patches, baseroms, repository internals, native libraries and Lua bytecode.

The Scripting adapter is `scripting/Gen1RecompApp/src/data/mod-service.ts`. It owns native fetch/redirects, DocumentPicker bytes, Archive extraction, private immutable versions and registry generations. Installation always writes `enabled: false`; these modules do not grant capabilities, inject a mod into the game payload or claim OS-level sandboxing.

The external PotatoVoxel checkout is research-only and ignored. Its audit is in `docs/research/potato-voxel-mod-audit.md`; no PotatoVoxel source or asset is present here.
