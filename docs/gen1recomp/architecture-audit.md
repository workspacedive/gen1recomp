# Gen1Recomp Architecture and Evidence Audit

**Audit date:** 2026-08-16
**Scope:** all Gen1Recomp research/specification deliverables, `forensics.json`, binding `agent.md`/`skills.md`, and the first host-independent contract/update modules
**Result:** internally consistent after the corrections listed below; Scripting runtime feasibility remains unproven

## 1. Binding-constraint cross-check

| Constraint | Audit result |
|---|---|
| Scripting, never Scriptable | Pass. Gen1Recomp documents use the Scripting TS/TSX/WebView surface and do not introduce Scriptable APIs. |
| Not a Game Boy emulator | Pass. The architecture preserves ROM import/extraction into data consumed by handwritten game logic. No CPU, instruction, bus, PPU or emulator-core layer exists. |
| Research and boundaries before broad code | Pass. Forensics, Android, technology, architecture, compatibility, UX and probe specifications preceded the host-independent contracts. No game port/runtime integration has started. |
| Scripting code outside core | Pass. The target dependency direction uses ports/brokers; current TypeScript code imports no upstream Lua/core files. |
| Kernel/LÖVE independently replaceable | Pass as design, not yet as artifact. The documents prohibit extraction/core changes before characterization; no Kernel/LÖVE source was modified. |
| Honest mod isolation | Pass. Documents consistently describe language/application-level capability control and explicitly deny OS/process sandboxing. |
| Game UI separate from platform UI | Pass. Original 160×144 LÖVE Game UI and native TSX Platform UI have separate state/ownership rules. |
| Verified staged update and rollback | Pass at host-independent unit level only. Integrity contracts, archive preflight, dependency resolution and logical activation recovery exist; durable Scripting storage behavior is still a device gate. |
| No invented APIs or performance | Pass. Metal, native library loading, PCM, game controllers, raw touch identity and resource metrics remain unavailable/unverified. No parity or frame-rate result is claimed. |

`agent.md` and `skills.md` were inspected and were not modified by this work.

## 2. Forensic fact cross-check

The narrative claims were checked against `docs/gen1recomp/forensics.json`, the pinned source trees and `research/gen1recomp-lock.json`:

| Fact | Machine/source evidence | Result |
|---|---|---|
| Release baseline | revision `73fbaaa25093338585923b8b9809f2fea7fc59dc` | Match |
| Dev baseline | revision `9469e399262e4e989902b61b449dd353c1fded3b`; game source differs only in iOS app-repo metadata | Match |
| Full tracked source inventory | 7,808 files / 207,696,353 bytes | Match |
| Project surface excluding major vendored trees | 1,744 files / 31,477,048 bytes | Match |
| Runtime versions | LÖVE 11.5 generally, Android 11.5a, iOS configuration 12.0; LuaJIT/Lua 5.1 semantics | Match |
| Core data versions | shell 1, Mod API 2, link protocol 2, save format 4, cache `rom-cache-v5` | Match |
| Source-built Android-oriented payload | 483 entries, 451 Lua, 15,936,729 uncompressed bytes, SHA-256 `ac7eace…` | Match; still labelled local/non-official |
| Official Android APK | 24,620,835 bytes, SHA-256 `fc9220…` from GitHub metadata | Match; binary not downloaded or executed |
| Baseline tests | 172 engine suites and 23 executed Modkit suites in the recorded quick baseline | Match recorded execution; ROM/device tiers remain unrun |

The empty release-download placeholder remains explicitly classified as a failed transfer, never as an analyzed artifact.

## 3. Native iOS dependency reconstruction

The v0.1.96 source script clones mutable `main` for both native iOS dependencies. GitHub records release workflow run `31924312648`, job `95109713326`, with the iOS build step from `2026-08-16T03:34:13Z` through `03:35:48Z`. GitHub commit history at the exact step start gives:

- `love2d/love`: `853f1cad4bb65d63f02dbcd3fa31b0c622d3abbc`;
- `love2d/love-apple-dependencies`: `a5522634f1e581a1ebab73bf3ab4bd7a853b7a3e`.

Both were still their respective `main` tips at `2026-08-16T09:47:14Z`. The lock file now records this provenance. Confidence is high but not absolute: the release Actions log archive and IPA could not be transferred, so the revisions are time-reconstructed rather than read from build output or binary metadata. The tagged source is still not intrinsically reproducible because it does not pin these refs.

## 4. Document-by-document audit

| Document | Cross-check outcome |
|---|---|
| `phase-0-spec.md` | Hypotheses and no-go gates agree with the technology evidence; open checkboxes correctly remain open. |
| `source-forensics.md` | Counts/versions match `forensics.json`; iOS dependency section now distinguishes source-level non-pinning from reconstructed release-time revisions. |
| `android-analysis.md` | Official metadata, failed transfer and local payload are kept separate; no APK runtime result is claimed. |
| `technology-evaluation.md` | General iOS/WebKit capability is not promoted to Scripting support; the conditional WebView direction remains accurate. |
| `web-runtime-analysis.md` / `web-runtime-surface.json` | Reproducibly inventories the broad LÖVE/Lua surface while labelling lexical false positives and refusing support/performance conclusions. |
| `target-architecture.md` | Host envelopes now use JSON values rather than unconstrained `unknown`; manifest integrity and journal records now match implemented contracts. |
| `compatibility-matrix.md` | Implemented host-independent contracts are distinguished from interfaces and unavailable backends; iOS reconstruction status is explicit. |
| `ui-ux.md` | Original Game UI and native Platform UI remain separate; no inaccessible overlay or guessed active version is required. |
| `scripting-capability-probes.md` | Every decisive runtime/render/audio/input/storage claim still requires an exact app/iOS/device report. |
| `device-connection.md` | Uses an isolated trusted LAN workflow and does not publicly expose the reviewed unauthenticated sync service. |

## 5. Contract/schema alignment

Implemented definitions:

- Host protocol version `1`, closed method/event/error sets, finite JSON payloads and fail-closed parsers;
- component manifest schema version `1`, closed fields, safe relative artifact path, SHA-256/size, dependencies, capabilities, migrations and self-tests;
- platform/runtime/renderer/input ports without concrete Scripting capability claims;
- JSON Schema 2020-12 equivalents for host messages and manifests;
- archive entry policy rejecting traversal, absolute/Windows/decomposed paths, case-insensitive collisions, symlinks, unsafe sizes and expansion limits;
- SemVer resolver with newest-compatible selection, backtracking, optional constraints, cycle rejection and dependency-first order;
- named API compatibility evaluation that attributes missing, malformed and unsatisfied ranges;
- upstream mod-permission mapping and least-privilege capability decisions without raw filesystem grants or sandbox claims;
- recoverable activation journal with conservative rollback for every phase that may have changed the active pointer.

The archive module validates an adapter-provided entry inventory; it is not itself a ZIP parser/extractor. File-kind allowlists and ROM-content distribution checks remain responsibilities of the component/mod policy layer. The activation store is abstract; no atomic or durable Scripting filesystem behavior is claimed.

## 6. Verification boundary

Current local verification covers TypeScript compilation, pure unit tests, JSON Schema compilation/validation, Python acquisition behavior and npm dependency audit. It does **not** cover:

- Scripting-synchronized declarations;
- Scripting runtime execution;
- physical iPhone/iPad WebView behavior;
- local WASM, WebGL, Web Audio or persistent Emscripten storage;
- simultaneous touch/controller behavior;
- Gen1Recomp `.love` boot, ROM import, game render/audio, mods or saves in Scripting;
- visual/audio golden parity or performance budgets.

A static audit of pinned `scripting-cli@1.5.0` found a local Express/Socket.IO synchronization service but no authentication/pairing-token layer in the inspected server/router paths. It is therefore not exposed through Arena's public preview proxy. Exact app-synchronized declarations require a trusted local-network session on the user's machine.

Therefore the current implementation is architecture groundwork, not a playable app and not evidence that the preferred runtime will pass Phase 0.
