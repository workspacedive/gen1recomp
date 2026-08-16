# Android v0.1.96 Analysis

**Release:** <https://github.com/bryanthaboi/gen1recomp/releases/tag/v0.1.96>
**Release commit:** `73fbaaa25093338585923b8b9809f2fea7fc59dc`
**Expected APK:** `gen1recomp-0.1.96-android.apk`
**GitHub size/digest:** 24,620,835 bytes / `fc9220acc2e199aa5bea91cc8f173b90fbec1d5cc5a32cc3e262374339bcef21`

## 1. Acquisition result and evidence limit

The release metadata and GitHub-provided SHA-256 were retrieved through the GitHub API. The exact v0.1.96 APK was also confirmed as present on SourceForge's automated GitHub mirror.

The binary itself could not be transferred into this sandbox: both `gh` and direct `curl`/`wget` reached GitHub, followed the redirect, then the TLS connection to `release-assets.githubusercontent.com` was terminated before any payload bytes. Direct SourceForge binary connections were blocked in the same environment. Empty partial files were not treated as downloads.

Consequences:

- no claim that the official APK was extracted;
- no `aapt`/APK manifest decode;
- no DEX decompilation;
- no packaged `.so` inventory or signing-certificate result;
- all findings below are either source-derived or from a locally rebuilt payload and are labelled accordingly.

`tools/acquire_gen1recomp.py` can retry the pinned asset later and will accept it only when both size and SHA-256 match `research/gen1recomp-lock.json`.

## 2. Separate analysis directory

The working analysis used:

```text
research/downloads/gen1recomp/
├── source-v0.1.96/                  detached release worktree
├── upstream-dev/                    pinned dev checkout
├── wiki/                            pinned wiki checkout
├── release-v0.1.96/                release transfer target
└── android-v0.1.96/source-built/
    └── game.love                    locally rebuilt payload
```

The whole directory is Git-ignored because it contains large upstream and generated research artifacts. It is reproduced from the checked-in lock/tool rather than committed.

## 3. Rebuilt payload

From the exact release source:

```bash
scripts/build_android.sh --version 0.1.96 --package-only
```

Result:

| Property | Value |
|---|---:|
| SHA-256 | `ac7eace7af964834df9f235d0f82dfe35e31de3599c305596f860765b0c920d3` |
| archive bytes | 5,933,391 |
| files | 483 |
| uncompressed bytes | 15,936,729 |
| Lua files | 451 |
| PNG files | 23 |
| JSON files | 4 |
| TTF/WebP | 1 / 1 |
| embedded ROM/cache/baseroms matches | 0 |

This is a source-built orientation artifact, **not** the official APK and not proof of byte identity with the official `.love`; ZIP timestamps/order can alter archive hashes. It did verify that the release packaging path is complete, stamps engine `0.1.96`, includes the save editor/UI kit/manifests, and excludes ROM-derived/generated content.

## 4. Android host architecture (source-derived)

```text
Android Activity / SAF / sensors / URLConnection
→ GameActivity Java bridge
→ JNI additions in LÖVE system/common modules
→ Lua love.system extensions
→ HostShell / RomImporter / mods
→ original game.love
```

### Runtime/build

- vendored `love2d/love-android` tag 11.5a;
- vendored LÖVE/LuaJIT/SDL/native dependencies, no submodule needed at build time;
- JDK 17;
- compile/target SDK 34;
- minimum SDK 16;
- NDK `25.2.9519653`;
- Gradle task `assembleEmbedNoRecordDebug`;
- application id `com.theboisclub.pokemonred`;
- release build script stamps version name `0.1.96`, code `196`;
- full-user orientation;
- embedded `game.love` flavor without microphone recording.

Source configuration builds ARMv7 and ARM64 by default and adds x86_64 in debug. Because the published workflow uses the debug Gradle task, those are the expected APK ABIs, but this remains source-derived until the official APK is unpacked.

### Manifest capabilities

Source manifest declares:

- `VIBRATE`;
- legacy Bluetooth;
- `INTERNET` for link play/mod/update traffic;
- `ACTIVITY_RECOGNITION` for the optional step bridge;
- optional touchscreen/gamepad/USB host/low-latency audio features;
- hardware acceleration through the LÖVE/SDL activity path.

`RECORD_AUDIO` and legacy broad external-storage permission are removed by the build script.

### Native extensions

The vendored host adds documented Lua-visible system methods:

- `pickFile` / `pickFileKinds`;
- `createFile`;
- `syncHealthSteps`;
- `restartApp`;
- `httpDownload`;
- TLS socket bridge methods;
- secondary-display frame/touch bridge.

These extensions are outside upstream LÖVE's ordinary script API and prove why a platform adapter is necessary. They must not be copied into Gen1Recomp core.

### File import

Storage Access Framework:

```text
ACTION_OPEN_DOCUMENT / GET_CONTENT
→ content URI grant
→ copy into the actual LÖVE save identity directory
→ fixed pending filename
→ Lua polls/consumes/validates
```

Destination filenames reject `/` and `\`. ROM, mod, save and required-mod imports use separate staged names. Scoped storage avoids broad storage permission.

### Network

`HttpsURLConnection` performs HTTPS-only downloads into a temporary destination and moves into place after completion. TLS socket bridging supports link relay paths. Network operations are exposed through `HostShell` rather than direct mod access.

### Steps

The optional bridge reads the hardware step counter, requires runtime consent on Android 10+, stores an anchor in `SharedPreferences`, caps a single sync, and stages a JSON delta for the permissioned mod broker. Base game does not call it.

### Restart/lifecycle

A full cold process restart is scheduled with `AlarmManager`/`PendingIntent` because an in-process LÖVE restart can retain invalid PhysFS/native state. `main.lua` also explicitly handles pause/resume, visibility, low-memory, pointer recovery and thread shutdown.

### Secondary display

A Java `Presentation` targets a non-default display, consumes asynchronously read back frames and queues touch events. This is optional and FFI/JNI-gated. It is not relevant to a baseline Scripting iPhone port unless Scripting exposes an equivalent — no such API was found.

## 5. What Android teaches the Scripting port

Reusable architectural lessons:

1. Keep the `.love` payload platform-neutral; add host features through explicit methods.
2. Stage external picks in a broker-owned directory and validate before activation.
3. Never expose raw paths/URIs to mods.
4. Treat restart as lifecycle behavior, not a game-core operation.
5. Network, health, export and secondary-display access are capabilities.
6. Keep ROM/cache out of install artifacts.
7. Verify required payload entries at package time.

Non-transferable details:

- JNI and Java bridge calls;
- Android Activity/SAF/permissions;
- AlarmManager restart;
- SDL Android orientation behavior;
- OpenGL ES/Android native libraries.

Scripting needs its own adapter/broker and cannot solve missing host capabilities by inserting Android or Scripting logic into LÖVE/core.
