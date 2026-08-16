# Static Web-Runtime Compatibility Surface

**Source:** Gen1Recomp v0.1.96 revision `73fbaaa25093338585923b8b9809f2fea7fc59dc`
**Machine report:** `docs/gen1recomp/web-runtime-surface.json`
**Method:** lexical scan of `main.lua`, `conf.lua` and 345 `src/**/*.lua` files (347 total)
**Evidence:** static only; comments/strings and guarded branches can contribute references

## 1. Why this audit exists

The love.js candidate cannot be evaluated by testing one rectangle alone. Gen1Recomp directly uses a broad LÖVE/Lua surface. This inventory converts that surface into named probes before any full payload attempt. It does not claim that love.js supports or fails an API.

The reproducible scan found:

- 126 distinct `love.<module>.<member>` lexical references / 1,867 occurrences;
- 105 distinct direct call forms / 1,490 occurrences;
- 30 LÖVE callback definitions;
- 270 distinct literal `require` targets;
- 41 distinct guarded `pcall(require, ...)` targets;
- 13 high-priority Web/runtime members.

Direct calls and all member references are reported separately because code such as `pcall(love.thread.newThread, ...)` is a real dependency but not syntactically a direct call. Counts are navigation aids, not performance measurements.

## 2. Rendering surface

The scan found 41 distinct directly called `love.graphics` members. The highest lexical call counts include `setColor` (396), `draw` (177), `rectangle` (114), `newQuad` (87), `setShader` (33), push/pop transforms (24 each), `setScissor` (21) and `setCanvas` (16).

High-priority references include:

| Member | References / files | Direct call forms | Required probe |
|---|---:|---:|---|
| `love.graphics.newCanvas` | 15 / 11 | 3 | render target creation, format, context loss and repeated switching |
| `love.graphics.newShader` | 12 / 6 | 1 | shader compile/translation and attributed errors |
| `love.graphics.setCanvas` | reported in full inventory | 16 | nested pass/state restoration |
| images/quads/sprite batches/meshes | multiple | multiple | decode, filtering, batching and geometry behavior |

Therefore a Canvas2D rectangle pass would not establish parity. The candidate must preserve render targets, shaders, scissor/transforms, nearest-neighbor filtering and high-volume quad/image drawing. No Metal inference follows from any result.

## 3. Filesystem/import/update surface

Fifteen distinct `love.filesystem` members are called. The surface includes reads/writes, metadata, directory enumeration/creation/removal, Lua loading, source/save-directory inspection, symlink configuration and mount/unmount.

Notable direct calls include `getInfo` (40), `remove` (32), `read` (25), `getSaveDirectory` (19), `getDirectoryItems` (11), `createDirectory` (10), `write` (7), `mount` (4) and `unmount` (2).

This makes persistence and archive mounting first-order gates. A session MEMFS write is insufficient. Tests must distinguish:

1. in-memory same-session behavior;
2. Emscripten/IndexedDB flush semantics;
3. Scripting WebView exit/relaunch persistence;
4. staged component/save recovery;
5. user ROM release after private cache generation.

Host/network updater behavior should be brokered by the control plane rather than assuming browser `curl`, shell or raw host paths.

## 4. Lua semantics and native modules

The core statically references Lua 5.1-specific behavior:

- `loadstring`: 9 occurrences across 7 files;
- `setfenv`: 6 occurrences across 4 files;
- global `unpack`: 16 occurrences across 6 files;
- literal `require("bit")`: 11 occurrences across 11 files.

These are compatibility requirements, not optional optimizations. The smoke probe therefore tests Lua 5.1, `setfenv`, `loadstring` and `bit` explicitly.

FFI is referenced through 11 guarded loads across the seven files already identified by source forensics, plus two literal `require("ffi")` occurrences in platform/network code. Static analysis alone cannot prove every execution path is safely guarded. love.js is still described as PUC Lua 5.1 without LuaJIT/FFI; each native path must be disabled or replaced by an adapter without changing game rules.

Socket/ENet references are isolated around link/network functionality (`socket` direct/guarded and guarded `enet`). Their presence does not authorize raw networking in the target. Link play and mod HTTP remain separate broker/capability work.

## 5. Threads and audio

High-priority member references include:

- `love.thread.newThread`: 10 references across 5 files;
- `love.thread.getChannel`: 26 references across 11 files;
- four worker entrypoints requiring `love.thread` (chip audio, mod job, network fetch, update check);
- `love.audio.newQueueableSource`: 2 references;
- `love.audio.newSource`: 7 references;
- `love.sound.newSoundData`: 7 references.

Upstream has several explicit no-thread fallbacks, but fallback existence is not equivalent to web parity. In particular, chip synthesis/audio scheduling, import responsiveness, bounded mod jobs and network/update work require independent tests. The smoke test's `audio.module` result only establishes namespace presence; audible user-gesture playback, queue scheduling, interruption and sustained behavior remain device gates.

## 6. Input and lifecycle

The runtime defines 30 LÖVE callbacks including touch press/move/release, gamepad/joystick, keyboard, mouse, focus, visibility, low-memory, resize, quit, update and draw. Direct polling also references touch positions/touch sets, joystick count and keyboard state.

A host that only maps a tap gesture is insufficient. Physical-device tests must prove simultaneous D-pad/action input, pointer cancellation, rotation/background release recovery and no stuck keys. Gamepad support remains unavailable until a real host/backend exposes and passes it.

## 7. Probe order derived from the surface

1. Lua 5.1 + `bit` + expected LuaJIT/FFI absence.
2. 160×144 canvas, images/quads and nearest filtering.
3. render-target switching, scissor/transforms, mesh/sprite-batch and shader compile.
4. session filesystem, then durable persistence and mount/unmount behavior.
5. queueable/generated audio after user gesture.
6. simultaneous touch/cancellation and lifecycle callbacks.
7. thread/channel capability and each upstream fallback path.
8. network/link refusal and broker replacement behavior.
9. minimal ROM-free Gen1Recomp fixture boot.
10. only then the source-built ROM-free full launcher payload; user ROM import remains later.

Any non-replaceable failure in graphics, audio, input, storage or memory remains a Phase-0 no-go. The inventory is not permission to rewrite the game in TypeScript or move per-frame work over HostProtocol.
