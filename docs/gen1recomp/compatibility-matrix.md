# Component Versioning and Compatibility Matrix

**Status:** baseline design; rows marked unverified cannot be activated
**Date:** 2026-08-17

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
| ROM cache | `rom-cache-v10` | per-version complete marker + required generated-file set | pinned v0.1.96 `RomImporter.lua`; Native 0.4.0 mirrors this readiness gate |
| Game/platform UI | coupled to engine `0.1.96` | direct core/render imports | source graph |

## 2. Target independent components

Versions below are contract starting points, not claims of completed artifacts.

| Component | Package version | API version | State |
|---|---:|---:|---|
| Host protocol | 0.1.0 | 1.0.0 | strict types, parser and JSON Schema implemented; no host transport yet |
| Component/update contracts | 0.2.0 | manifest/catalog schema 1 | strict catalog trust, archive preflight, dependency/API planner, manual orchestrator, activation journal and recovery implemented host-independently |
| Scripting host | 0.4.1-native | 1.0.0 | persistent verified game library, direct game session, cache maintenance, component/mod management; Native 0.2.0 runtime physically passed, 0.4.0 reached canonical Yellow extraction; 0.4.1 completion and 0.3.0 file/GitHub paths pending |
| iOS/Scripting platform adapter | 0.4.1-spike | 1.0.0 | physical local-file WebView path passed; current DocumentPicker/Crypto.sha1/Data/WebView evaluate contracts implemented; same-session canonical import proven; App Group relaunch/extraction/cache durability and file/GitHub behavior pending device proof |
| Runtime manager | 0.0.1-spike | 1.0.0 | host-independent lifecycle/concurrency manager implemented over injected evidence verifier and `LuaRuntimePort`; no Scripting transport/backend |
| Lua runtime adapter | love.js PUC Lua 5.1 | 1.0.0 | physical Scripting startup passed; no LuaJIT/FFI; complete touch/audio/persistence live-activation profile remains blocked |
| Renderer port | 0.1.0 | 1.0.0 | strict interface and viewport helper; no Scripting backend |
| LÖVE host compatibility | 0.1.0-spike | 1.0.0 | BitOp parity-tested; unusable worker capability normalized before core; Fetch/Update/Mod Job/Import/ChipAudio fallbacks characterized; explicit Emscripten flush adapter implemented |
| LÖVE distribution | selected pinned 11.5 web | 11.5.0 | physical Scripting launcher startup passed; no-worker mode required; real-title/audio/input/save/performance pending |
| Kernel façade | 0.1.0 | 1.0.0 | façade/characterization work pending |
| Gen1Recomp core payload | 0.1.96 | upstream internal contract | pinned ROM-free source-built payload; outside-browser launcher boot passed |
| Mod API adapter | 0.2.0 | 2.0.0 | strict API-1/2 manifest/GitHub/archive package management and scoped capability policy implemented; native consent/profile/runtime injection and Lua façade validation pending |
| Platform UI | 0.4.1-native | 1.0.0 | five-tab navigation, dynamic native game cards/import states/save counts/cache deletion, manual components and inactive mods implemented; adaptive and physical validation pending |
| Individual mods | own semver | manifest API 1/2 | install only after runtime parity |

Component/API versions use canonical `X.Y.Z` semantic versions in target manifests. This is separate from compact upstream integers (shell/Mod API/link) and the HostProtocol envelope discriminator `protocol: 1`.

## 3. Candidate compatibility matrix

| Host | Runtime | LÖVE | Kernel/Core | Mod API | Result |
|---|---|---|---|---|---|
| native Android shell | LuaJIT/Lua 5.1 | 11.5a | Gen1Recomp 0.1.96 | 1/2 | **upstream supported** |
| native iOS shell | LuaJIT interpreter semantics | 12.0 development | Gen1Recomp 0.1.96 | 1/2 | **released upstream IPA exists; reproducibility risk** |
| Scripting main JS runtime | none documented | none | Gen1Recomp 0.1.96 | none | **incompatible** |
| Scripting TimelineCanvas | no Lua runtime yet | custom incomplete façade | Gen1Recomp 0.1.96 | none | **diagnostic only** |
| Scripting WebView | love.js PUC Lua 5.1 + BitOp shim | pinned love.js 11.5 | Gen1Recomp 0.1.96 | target 1/2 | **physical ROM-free startup passed; Native 0.4.0 physically reached canonical Yellow extraction then exposed missing global BitOp; Native 0.4.1 corrects the adapter; completion/game/touch/audio/save parity unverified** |
| Scripting WebView | Wasmoon Lua 5.4 | custom LÖVE façade | Gen1Recomp 0.1.96 | unknown | **not recommended: semantic mismatch/high effort** |
| Scripting + external native IPA | native upstream | native upstream | Gen1Recomp 0.1.96 | 1/2 | **runtime works separately; not hosted inside Scripting** |

## 4. Activation rules

A component set is runnable only when all are true:

1. every manifest/schema/API major parses;
2. every dependency semver range matches;
3. host protocol major matches;
4. a closed functional report from the current boot session matches the required host and exact runtime revision, and every required operation passes;
5. LÖVE compatibility reports required modules and shader level; namespace/symbol presence alone cannot satisfy this rule;
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

1. No connected Scripting app/version-specific declarations or reported Scripting app build.
2. Runtime startup is verified, but real ROM extraction/game boot, audible audio, simultaneous input, save persistence and pre-dismiss flush are not.
3. Native 0.4.0 physically proved DocumentPicker, canonical Yellow SHA-1, pending registry/retry and importer entry; Native 0.4.1 extraction completion, App Group relaunch and IDBFS durability remain unverified, as do Native 0.3.0 component/mod/GitHub paths.
4. No controller API in reviewed Scripting docs.
5. No direct Metal API in reviewed Scripting docs.
6. Heavy upstream cross-component/direct-LÖVE coupling.
7. Existing native iOS build still fetches mutable LÖVE/Apple dependency `main` branches; the v0.1.96 build-time tips were reconstructed, but the build does not itself pin or attest them.
8. The Mods package tab is enabled but every install remains inactive; discovery freshness, dependency auto-install, capability consent, profile/load order, payload injection and runtime rollback remain blockers for game activation.
