# Scripting Physical-Device Capability Probe Plan

**Purpose:** replace architecture assumptions with measurements from the exact Scripting app/iOS/device combination.

## 1. Environment record

Capture before results:

- Scripting app version/build;
- synced declaration revision/hash;
- iOS version;
- device model and logical screen/scale;
- Low Power Mode if observable (otherwise omit);
- orientation;
- thermal state only if an API actually exposes it;
- probe code commit.

## 2. Main JS runtime

Test, do not assume:

```text
typeof WebAssembly
ArrayBuffer / Uint8Array behavior
maximum practical synthetic buffer allocation
monotonic clock available
structured data serialization cost
script suspend/resume behavior
```

No crash-to-find-limit tests on user data. Allocation steps are bounded and released between samples.

## 3. WebView runtime

A bundled local page reports:

- `WebAssembly` availability and instantiation of a tiny bundled module;
- WebGL1 and WebGL2 context creation;
- renderer/vendor only through non-sensitive standard context info;
- `requestAnimationFrame` cadence distribution while foreground;
- behavior after background/resume and rotation;
- `AudioContext`, AudioWorklet and sample rate;
- Pointer Events, Touch Events and concurrent touch count;
- local file/WASM fetch under `loadFile(..., allowingReadAccessTo)`;
- IndexedDB/localStorage if needed;
- SharedArrayBuffer/cross-origin-isolation state;
- context-loss behavior.

Results return once through a validated WebView message handler. Per-frame traffic does not cross the native bridge.

## 4. TimelineCanvas

Synthetic scenes, each independently selectable:

1. one nearest-neighbor image draw;
2. 100 simple particles (official example baseline only, not a product threshold);
3. representative sprite-command counts discovered from Gen1 frames;
4. fixed 160 × 144 pixel source scaled to several view sizes;
5. pause/resume and orientation.

Record callback interval, draw closure duration where measurable and late-frame count. Do not call it GPU/Metal time.

## 5. Input

Test with a visible state table:

- D-pad direction press/slide/release;
- D-pad + A held by separate fingers;
- A+B;
- Start/Select;
- rotation while held;
- app background while held;
- system gesture conflict near each edge;
- rapid alternation and long hold;
- haptic enable/disable.

Pass requires no lost releases or stuck buttons across repeated trials. Scripting gesture support alone is not a pass.

## 6. Storage/import

Only synthetic bytes:

- document picker/bookmark behavior;
- copy to private project directory;
- SHA-1/SHA-256 correctness against known vectors;
- 1/2 MiB binary read/write needed for canonical ROM sizes;
- larger cache-shaped file sets;
- zip traversal rejection implemented above raw unzip;
- staged write + simulated interruption + recovery;
- persistence across Script.exit/relaunch.

Throughput is measured on device; no target number is invented.

## 7. Audio

### Web backend

- AudioContext creation after user gesture;
- queued PCM/buffer playback;
- concurrent music/SFX behavior;
- interruption, mute switch/category behavior and resume;
- sustained buffer scheduling without underrun signal where observable.

### Native documented APIs

- AVPlayer latency is measured only for file-based fallback;
- SharedAudioSession lifecycle;
- no claim of raw PCM output unless an exact API is found.

## 8. LÖVE web smoke test

### Outside-Scripting harness

`probes/lovejs-smoke/` and `tools/prepare_lovejs_smoke.py` build a ROM-free probe against pinned 2dengine love.js revision `9355186de22db13bd88bf2a0db75d2925647d036`. The preparer verifies exact sizes/SHA-256 from `research/gen1recomp-lock.json`, emits a deterministic `smoke.love`, and copies only the required ignored runtime files. Serve it with the required WASM/isolation/MIME headers:

```bash
python3 tools/prepare_lovejs_smoke.py
python3 tools/serve_lovejs_smoke.py --bind 0.0.0.0 --port 4173
```

The page reports LÖVE/Lua 5.1 semantics, expected lack of LuaJIT/FFI, Canvas/render target, image creation, shader compilation, session filesystem access, SHA-256, timer and module presence. It paints a 160×144 checkerboard and posts a bounded local report to `/__probe_report`. Audio module presence is not audible-audio proof; touch/joystick module presence is not simultaneous-input proof; a MEMFS session write is not persistence proof.

**Current outside-host status:** pinned files, deterministic package generation, ZIP integrity, server headers and WASM MIME were statically/HTTP verified. Browser execution is still pending: this host has no browser, and the attempted Playwright Chromium download failed before TLS establishment. The live preview may be used to complete the browser half, but no pass is recorded until its structured report exists.

### Ordered progression

1. smallest upstream-compatible `main.lua` and 160×144 canvas;
2. fixed-step moving sprite;
3. filesystem write/read;
4. image decode;
5. user-gesture audio;
6. simultaneous touch;
7. coroutine;
8. `bit` library;
9. thread capability/fallback;
10. minimal Gen1Recomp fixture boot.

After an ordinary browser pass, run the same pinned local bundle inside a declaration-backed Scripting WebView and label that result separately. Do not start full ROM import before these pass.

## 9. Report schema

```json
{
  "environment": {},
  "probeVersion": "0.1.0",
  "startedAt": "ISO-8601",
  "results": [
    {
      "id": "webview.webgl2",
      "status": "pass|fail|unavailable|error",
      "observed": {},
      "notes": []
    }
  ]
}
```

Raw samples may be exported separately with bounded size. The summary stores no personal files, URLs, identifiers or ROM data.

## 10. Evidence labels

- **Static:** code/docs inspection.
- **Runtime-main:** executed in Scripting JS runtime.
- **Runtime-webview:** executed inside Scripting's WebView.
- **Preview:** UI only.
- **Device-E2E:** physical host path including lifecycle/input/audio.

Each conclusion cites one label. A static WebKit capability is not automatically Device-E2E inside Scripting.
