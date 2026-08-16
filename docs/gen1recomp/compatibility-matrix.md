# Component Versioning and Compatibility Matrix

**Status:** baseline design; rows marked unverified cannot be activated
**Date:** 2026-08-16

## 1. Observed upstream matrix

| Package | Version/API | Dependency | Evidence/status |
|---|---|---|---|
| Gen1Recomp release | `0.1.96` | packaged `.love` | GitHub release/tag verified |
| native shell contract | `1` | payload `minShell <= 1` | `Version.lua` |
| payload host | `love` | exact host-family match | `Version.lua` / updater |
| LÖVE desktop/Android | 11.5 / love-android 11.5a | LuaJIT/LÖVE APIs | source/build docs |
| LÖVE iOS | 12.0 development main | iOS 13+, SDL3/Apple dependencies | source build; **unreleased; refs unpinned in source**. v0.1.96 build-time tips reconstructed as LÖVE `853f1cad…` / Apple deps `a552263…`, not artifact-attested |
| Lua API semantics | LuaJIT / Lua 5.1 | `setfenv`, `bit`, optional FFI/JIT | source scan |
| Mod API | `2` (absent manifest = v1 compatibility) | engine `modApi >= requested` | `Version.lua`, manifest loader |
| Link protocol | `2` | handshake/fingerprint | `Version.lua` |
| Save format | `4` | migrations/validation | `Version.lua`, SaveData |
| ROM cache | `rom-cache-v5` | complete marker + version tree | `Version.lua`, importer |
| Game/platform UI | coupled to engine `0.1.96` | direct core/render imports | source graph |

## 2. Target independent components

Versions below are contract starting points, not claims of completed artifacts.

| Component | Package version | API version | State |
|---|---:|---:|---|
| Host protocol | 0.1.0 | 1.0.0 | strict types, parser and JSON Schema implemented; no host transport yet |
| Component/update contracts | 0.1.0 | manifest schema 1 | manifest parser/schema, safe archive preflight, dependency resolver and activation journal implemented host-independently |
| Scripting host | 0.0.1-spike | 1.0.0 | pending connected-app `.d.ts` |
| iOS/Scripting platform adapter | 0.0.1-spike | 1.0.0 | interface only; pending device probes |
| Runtime manager | 0.0.1-spike | 1.0.0 | state/interface only; backend manager pending |
| Lua runtime adapter | candidate love.js PUC Lua 5.1 | 1.0.0 | outside-browser smoke passed; no LuaJIT/FFI; Scripting pending |
| Renderer port | 0.1.0 | 1.0.0 | strict interface and viewport helper; no Scripting backend |
| LÖVE host compatibility | 0.1.0-spike | 1.0.0 | pure-Lua BitOp overlay parity-tested; explicit serialized Emscripten flush adapter implemented; broader compatibility pending |
| LÖVE distribution | candidate 11.5 web | 11.5.0 | pinned outside-browser smoke/launcher passed; worker-thread creation unavailable; Scripting/device not validated |
| Kernel façade | 0.1.0 | 1.0.0 | façade/characterization work pending |
| Gen1Recomp core payload | 0.1.96 | upstream internal contract | pinned ROM-free source-built payload; outside-browser launcher boot passed |
| Mod API adapter | 0.1.0 | 2.0.0 | scoped permission/capability policy implemented; Lua façade and v1 behavior integration pending |
| Platform UI | 0.0.1-spike | 1.0.0 | UX spec only |
| Individual mods | own semver | manifest API 1/2 | install only after runtime parity |

Component/API versions use canonical `X.Y.Z` semantic versions in target manifests. This is separate from compact upstream integers (shell/Mod API/link) and the HostProtocol envelope discriminator `protocol: 1`.

## 3. Candidate compatibility matrix

| Host | Runtime | LÖVE | Kernel/Core | Mod API | Result |
|---|---|---|---|---|---|
| native Android shell | LuaJIT/Lua 5.1 | 11.5a | Gen1Recomp 0.1.96 | 1/2 | **upstream supported** |
| native iOS shell | LuaJIT interpreter semantics | 12.0 development | Gen1Recomp 0.1.96 | 1/2 | **released upstream IPA exists; reproducibility risk** |
| Scripting main JS runtime | none documented | none | Gen1Recomp 0.1.96 | none | **incompatible** |
| Scripting TimelineCanvas | no Lua runtime yet | custom incomplete façade | Gen1Recomp 0.1.96 | none | **diagnostic only** |
| Scripting WebView | love.js PUC Lua 5.1 candidate + BitOp shim | love.js 11.5 candidate | Gen1Recomp 0.1.96 | target 1/2 | **outside-browser 23-check smoke and ROM-free launcher boot passed; Scripting remains unverified** |
| Scripting WebView | Wasmoon Lua 5.4 | custom LÖVE façade | Gen1Recomp 0.1.96 | unknown | **not recommended: semantic mismatch/high effort** |
| Scripting + external native IPA | native upstream | native upstream | Gen1Recomp 0.1.96 | 1/2 | **runtime works separately; not hosted inside Scripting** |

## 4. Activation rules

A component set is runnable only when all are true:

1. every manifest/schema/API major parses;
2. every dependency semver range matches;
3. host protocol major matches;
4. runtime reports required Lua features;
5. LÖVE compatibility reports required modules and shader level;
6. kernel façade major matches core adapter;
7. Mod API provided is at least each enabled mod's request;
8. save/cache migration path exists;
9. all artifacts match size and SHA-256;
10. required self-tests pass before active-pointer switch.

Unknown means incompatible until proven — never “probably supported.”

## 5. Deprecation policy

- Minor versions may add optional fields/methods.
- Major versions change semantics and require an explicit adapter or refusal.
- A deprecated symbol remains functional through its API major, logs one attributed warning per owner/session, and names its replacement.
- Compatibility adapters are separately versioned and tested; they are not hidden branches in core.
- Removal requires a new major and a migration/rollback note.
- Mod API v1 remains an explicit compatibility adapter under Mod API 2, matching upstream behavior.

## 6. Per-component release contract

Every release includes:

```text
manifest.json
artifact(s)
SHA-256 file manifest
CHANGELOG.md
COMPATIBILITY.md
tests/self-test descriptor
migration descriptor (if needed)
rollback metadata
license/provenance
```

No component is independently updateable merely because it has a directory. It becomes independently updateable only after its public interface is versioned, consumers depend exclusively on that interface, and compatibility tests prove replacement.

## 7. Immediate compatibility blockers

1. No connected Scripting app/version-specific declarations.
2. No verified Lua/LÖVE runtime in Scripting.
3. No verified WebView local WASM/WebGL/audio/input behavior.
4. No controller API in reviewed Scripting docs.
5. No direct Metal API in reviewed Scripting docs.
6. Heavy upstream cross-component/direct-LÖVE coupling.
7. Existing iOS build still fetches mutable LÖVE/Apple dependency `main` branches; the v0.1.96 build-time tips were reconstructed, but the build does not itself pin or attest them.
8. Existing mod replacement is not a full old-version rollback transaction.
