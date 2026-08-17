# Scripting physical-device runs 001–010

- **Evidence level:** user-reported installed Scripting host on a physical iOS device
- **Scripting app version/build:** not yet supplied
- **OS/device:** iOS 18.7 on iPhone; exact model not yet supplied
- **Artifacts:** Preview lineage 0.1.0–0.1.4; current physical pass is Preview 0.1.4, SHA-256 `70a2cb7febc106f42c5bfbba55636879c560bd24b438ba03871cfcec02242184`

## Observed

- Scripting diagnostic: `/index.tsx` line 118 — `Cannot find name 'Script'`.
- `FileManager.scriptsDirectory` resolved the imported project correctly.
- `WebViewController.loadFile` and modal presentation succeeded.
- The local ES-module entry did not execute within eight seconds.
- The native console/message bridge itself worked and received the module-load error event.
- Shutdown evaluation then produced `Script error`, as expected because the runtime module had never installed the shutdown bridge.

## Run 002

Artifact: Preview 0.1.1, SHA-256 `fac9ae156a6125f7af6f1257233236edf3d80d0cb2322325b31940e67b08c959`.

The first classic-bundle replacement removed the `Script` diagnostic, but the bundle still did not set its startup marker. Its ES2022 output contained JavaScript private fields and optional chaining, so classic-vs-module loading alone was not sufficient. The previous timeout could not distinguish resource loading from parser/execution failure.

## Run 003

The next submitted log still contained the exact removed strings `module-load` and `The local preview module did not start`. Those literals are absent from the 0.1.2 archive, proving that Scripting/iCloud continued to execute the previously imported project tree or WebView URL cache rather than the replacement files.

## Run 004

Preview 0.1.3 proved that the unique project path, classic loader, downleveled bundle, native bridge, and runtime entry all execute. The pinned player then emitted four immediate `TypeError: Load failed` errors before entering its error state. These map exactly to its four `fetch` requests for `gen1recomp.love`, `normalize1.lua`, `normalize2.lua`, and `love.wasm`; Scripting WKWebView permits local classic scripts but rejects these local-file fetches.

## Run 005 — Preview 0.1.4 physical pass

The user-installed Preview 0.1.4 reached `preview.ready` at frame 2 on iPhone/iOS 18.7 with a visible 1024 × 768 surface. The device log confirmed the intended `0.1.4 / 014` host/runtime identity, embedded package adapter, exact decoded payload/Lua/WASM byte lengths, classic bundle execution, LÖVE/Lua startup, and `crossOriginIsolated: false`. No local fetch failure or startup `TypeError` remained.

The only observed error occurred after dismissal: the host logged `preview dismissed; requesting runtime flush and shutdown` and then `Script error.` The host had already lost a usable page before evaluating the shutdown bridge. This is a close/flush sequencing defect, not a runtime-start defect. The native 0.2.0 shell does not repeat post-dismiss JavaScript evaluation; save-bearing gameplay remains blocked until a pre-dismiss flush handshake is physically validated.

## Run 006 — Native 0.2.0 diagnostic pass

The user launched `Gen1Recomp Native 020`, reached its native Settings action, and started the packaged runtime diagnostic. The device log confirmed the exact `0.2.0 / 020` identity, pinned love.js revision/payload, all four embedded resources at expected byte lengths, classic bundle execution and `ready frame 21` without startup errors.

This proves the Native 0.2.0 TSX host was sufficiently functional to present and invoke the Settings action and that its WebView adapter preserved the validated runtime path. No screenshot, system-update request, App Group interruption test, dismissal log or iPad evidence was supplied, so those remain separate. Native 0.3.0 adds manual component ZIP and file/GitHub mod management and requires a fresh run.

## Run 007 — Native 0.4.0 canonical Yellow import reaches extractor, then fails at global BitOp

Environment supplied by the user: **Scripting 3.2.0**, **iOS 26.6**, **iPhone 16 Pro Max**. The user selected their renamed `.txt` cartridge file through DocumentPicker; Native 0.4.0 accepted it as canonical Pokémon Yellow, which proves the device-side exact 1 MiB/SHA-1 gate passed. The native Games card persisted Yellow with digest prefix `cc7d0326…` and `Import abschließen`, proving private registration and pending-source retry survived runtime dismissal without another picker.

Three runtime attempts reached the exact Native 0.4.0 identity and embedded payload. Reported ready frames were 17, 2, and 2. The upstream Yellow launcher then showed:

```text
Import failed
src/import/Rom.lua:198: attempt to index global 'bit' (a nil value)
```

Attribution is exact: `Rom.decompressPic` uses LuaJIT's global `bit.bxor`; the love.js PUC-Lua overlay supplied a parity-tested `require("bit")` module but did not install the LuaJIT-compatible global. This is a host-adapter defect, not a bad ROM, extractor/core algorithm defect, or emulator issue. Native 0.4.1 corrects `compatibility/love-web/bootstrap.lua` to install the same tested module into `_G.bit` before upstream main loads. No upstream core file is changed.

One Scripting console event at 01:43:55 also reported `Failed to build component. TypeError: undefined is not an object (evaluating 't.__type__')`. The native screen subsequently rendered and remained actionable, so it is tracked as a separate intermittent UI-build observation rather than attributed to extraction. Native 0.4.1 also moves the card status to its own row to reduce the severe text compression visible in the supplied screenshot. A clean 0.4.1 run must confirm whether the component error recurs.

This run proves DocumentPicker access, native canonical Yellow identity, private pending registration, retry without reselection, in-memory WebView handoff, and upstream importer entry on the specified device. It does **not** prove completed extraction, cache persistence, direct game boot, saves, audio, input, or fidelity.

## Run 008 — Native 0.4.1 removes BitOp failure; hidden pre-window error remains

On the same Scripting 3.2.0 / iOS 26.6 / iPhone 16 Pro Max environment, Native 0.4.1 reused the pending canonical Yellow source and reached the corrected payload `a8a370be…` at ready frame 1. The prior `global 'bit'` exception did not recur, confirming that the targeted adapter correction changed the failing path.

The WebView then presented love.js' generic alert:

```text
An error occurred before the game window could be initialised. Please check the console!
```

No underlying Lua/WASM detail appeared in Scripting's native log because pinned love.js replaces `Module.warn` with `console.warn`; the Native 0.4.1 bridge forwarded explicit host messages but not the WebView console. The card correctly remained **Import abschließen**, so no cache-ready claim or ROM-source deletion occurred.

The intermittent native `Failed to build component … t.__type__` event recurred at 02:00:17. The screen again rendered afterwards, and the dedicated status row materially improved the card layout. It remains an independent Scripting component-build defect/usage interaction requiring exact isolation.

Native 0.4.2 preserves the BitOp fix and adds bounded forwarding for WebView `console.log`, `console.warn`, `console.error`, Error stacks, and `window.alert` text. Chromium tests proved both console-error and alert forwarding into the native handler. The next physical run is diagnostic: its newly visible error detail determines the next technical correction; a generic alert alone is no longer sufficient evidence.

## Run 009 — Native 0.4.2 exposes queueable-audio loop exception

Native 0.4.2 forwarded the hidden WebView console as designed. On the same device/environment, the pending Yellow import reached ready frame 1, then reported:

```text
[info] generated data loaded (223 maps, 151 species, 165 moves)
[info] game loaded
[info] display: 1024x768 units, 1024x768 px, fit scale 5 px/GB px
Queueable Sources can not be looped.
Web alert: An error occurred before the game window could be initialised.
```

This proves canonical extraction generated and loaded the expected Yellow data set and advanced into game initialization. Failure is now attributed to LÖVE's documented queue-source contract: `Source::setLooping` throws for every queueable source. Upstream chip music owns looping in `ChipSynth` but still reaches a generic source-looping call after constructing its queue.

Native 0.4.3 adds a narrow love.js host guard. It lazily wraps the shared Source method table when the first queueable source is created, ignores `setLooping` only when `getType() == "queue"`, and delegates static/stream looping unchanged. A real pinned-love.js probe proved: queue call succeeds and remains non-looping, while static `setLooping(true)` still produces `isLooping() == true`. The Gen1Recomp and LÖVE sources remain unchanged. Native 0.4.3 also suppresses only the known generic love.js alert modal after logging it, addressing the repeated disruptive popup without suppressing other alerts.

The independent Scripting `t.__type__` component-build event recurred again at 02:13:15 and remains open.

## Run 010 — Native 0.4.3 reaches Yellow title and audible music

Native 0.4.3 passed the queue-loop regression physically. The device reached the Pokémon Yellow title/intro and music was audible immediately, which is the expected timing. No generic pre-window modal or queue-loop exception was reported. This is the first physical evidence of canonical extraction through game/title rendering plus audible audio in the Scripting-hosted runtime.

No on-screen touch controls appeared. Attribution is architectural rather than cosmetic: upstream `TouchControls.wantsOverlay()` enables controls only when `love.system.getOS()` is Android/iOS (or `POKEPORT_TOUCH=1`), while love.js reports `Web` inside WKWebView. Native 0.4.4 sets the upstream-documented `POKEPORT_TOUCH=1` only for game sessions. LÖVE's own touch callbacks remain the input transport; no second JavaScript control implementation or emulator input layer is introduced.

Native 0.4.4 also keeps the stable native card tree mounted during WebView presentation instead of rendering a transient `working` branch immediately before the modal. That exact transition preceded every recurring Scripting `t.__type__` component-build event and is removed as the smallest evidence-driven UI correction.

## Run 011 — Native 0.4.4 proves touch play and exposes viewport/performance defects

On iPhone 16 Pro Max / iOS 26.6 / Scripting 3.2.0, Native 0.4.4 started after the `t.__type__` component-build event recurred. It reached ready frame 2, loaded 223 maps, 151 species and 165 moves, and reported a fixed 1024×768 logical/pixel display at fit scale 5. The D-pad, A, B, Start and Select controls appeared and worked for ordinary play. The user moved from Red's upstairs room through the ground floor and Pallet Town into Oak's Lab. This closes the absent-controls defect and proves the basic upstream touch path; it does not by itself prove sliding, simultaneous ownership, every release path or absence of stuck input.

The stable-card-tree change did **not** eliminate `t.__type__`; that causal hypothesis is disproved as a complete fix. The event remained non-blocking in this run because runtime startup and gameplay followed.

Physical presentation exposed three new defects: controls were too small, the rendered game showed less field and occupied much less of the screen than the native `.ipa`, and strong stutter was visible during Oak's introduction, name selection, early overworld movement and battles. Native 0.4.5 therefore does not stretch the 160×144 composition. Instead, a host `conf.lua` adapter gives upstream Renderer a backing surface with the WebView's aspect ratio, keeps the constrained game edge at integer scale 4 on phones or 5 on tablets, leaves the long edge available to upstream expanded-world drawing, and uniformly scales that bounded surface into the WebView. The same geometry materially enlarges upstream controls without a second input implementation. Ten-second raw RAF-gap and Long Tasks telemetry windows were added so performance work can follow device measurements rather than symptom-based guesses.

## Run 012 — Native 0.4.5 exposes pre-presentation geometry and periodic stalls

Native 0.4.5 still appeared as a centered square and still stuttered. Its new logs made both outcomes actionable. Scripting evaluated the game bundle before presenting the WebView, at which point `window.innerWidth` and `innerHeight` were both `1`. The adapter therefore selected a square `640×640` backing surface; once presented, CSS uniformly contained that surface as `440×440`. LÖVE correctly reported the resulting `640×640`, fit scale 4. The implementation did not stretch, but it faithfully preserved the wrong placeholder aspect. Native 0.4.6 now accepts the host session first, waits for a non-placeholder viewport that remains stable for 250 ms after presentation, and only then loads the bundle and creates the LÖVE window.

Eleven raw timing windows confirmed severe main-thread starvation. Representative steady windows reported p95 intervals of 81, 105, 75, 91 and 96 ms, with 39–52 intervals over 50 ms per ten seconds. One gameplay window rendered only 153 animation frames in 10.044 seconds and reached a 2.3-second maximum gap. WebKit accepted a Long Tasks observer but emitted zero entries even across those multi-second RAF gaps, so RAF remains the trustworthy symptom metric.

The steady 4–5 gaps over 50 ms per second closely match the no-worker music path consuming one 8192-sample block every `8192 / 44100 = 0.186` seconds, or 5.38 times per second. Native 0.4.6 preserves the same ChipSynth programs, 44.1 kHz sample rate and sequential PCM state but changes queue hand-off to 1024-sample slices. A minimal two-line integration seam makes the no-worker fill one slice per update instead of three; 128 queued slices retain about three seconds of tolerance. Direct aggregate music-synthesis and per-effect CPU logs were added to confirm attribution physically. This is scheduling granularity, not lower sample rate, skipped audio or reduced game fidelity.

The independent `t.__type__` event again occurred five seconds before successful runtime startup and remains open.

## Run 013 — Native 0.4.6 fixes viewport and removes severe periodic cadence

Native 0.4.6 correctly waited for `440×956` presented CSS geometry, planned a `640×1391` portrait backing surface, and uniformly presented it as `439.84375×956`. LÖVE reported the same `640×1391` units/pixels at fit scale 4. This closes the pre-presentation `1×1` geometry defect and proves full-height aspect preservation on the primary device.

The game became materially smoother. Three late steady windows rendered 582, 567 and 586 frames per roughly ten seconds, with p95 23–25 ms, maxima 31–37 ms, and no intervals over 50 ms. By contrast, Native 0.4.5's representative steady p95 was 67–105 ms with up to 52 intervals over 50 ms. The 1024-sample scheduling therefore removed the severe repeating cadence.

The user correctly clarified that audible sound was not defective: music remained continuous. The relevant coupling is CPU scheduling, not audio output. Direct telemetry showed synchronous music generation consuming 632–2918 ms of CPU per five-second interval, with individual 1024-sample calls up to 23 ms. Because this work executes inside the single game/update thread, it can delay rendering even when playback sounds perfect.

Residual intermittent hitches were separately attributable to first-use static effects: measured synthesis calls took 106, 412, 223, 267, 174 and 250 ms among others. The 223/267/250 ms calls align with nearby RAF maxima of 236/278/262 ms. One complex ten-second section still fell to 336 frames, p95 64 ms and maximum 194 ms while music and several effects were synthesized.

Native 0.4.7 therefore uses 512-sample music blocks with up to two per update: the same maximum 1024 samples of work per frame, but approximately 86 smaller calls per second distribute the average synthesis load more evenly across a 60 Hz loop. It also stores first-use rendered effect SoundData as private validated PCM WAV cache entries under the game's removable cache prefix. A sidecar holds the complete canonical synthesis signature, preventing hash collisions or stale definitions from being accepted. The first encounter remains measured and synchronous; subsequent sessions decode the cached PCM instead of rerunning ChipSynth. Update and draw callback CPU are now measured separately.

`t.__type__` occurred twice before successful Native 0.4.6 startup and remains a separate Scripting component-builder defect.

## Run 014 — Native 0.4.7 reaches near-60 Hz steady motion and exposes quality/lifecycle defects

Native 0.4.7 was subjectively much smoother and more even. The strongest steady window rendered 601 frames in 10.017 seconds with p95 20 ms, p99 23 ms, maximum 24 ms and no interval above 25 ms. Other steady windows generally held p95 18–23 ms. Music slices fell to 2–11 ms maximum. Late update averages were 1.79–3.31 ms and draw averages only 0.15–0.33 ms, proving the full-height renderer itself was not the remaining CPU bottleneck.

The first run populated named private effect entries. `Intro_Whoosh`, `Shrink`, `Go_Outside`, `Ball_Poof` and `Caught_Mon` respectively took 358, 227, 257, 163 and 254 ms; nearby update/RAF maxima tracked those first-use calls. No `cache=hit` line was supplied, so persistence/reuse remains unproven despite successful `cache=store` evidence. Native 0.4.8 retains the same cache namespace so these entries can be reused.

An incoming phone call during an earlier attempt left the game completely frozen. The interrupted attempt supplied no visibility/lifecycle log, so process termination versus a suspended Emscripten scheduler cannot be distinguished. Native 0.4.8 pairs `hidden`/`blur` with explicit main-loop pause and persistence flush, pairs `visible`/`focus`/`pageshow` with resume, and verifies frame advancement after 750 ms. A stalled visible loop is restarted and logged. This is a recoverable host-lifecycle adapter, not an invented claim that iOS can preserve a WebView process it terminates.

The `640×1391` backing surface was uniformly enlarged to `440×956` CSS and therefore below the iPhone's `1320×2868` physical framebuffer. Pixel-art CSS preserved the game correctly but also made the 256×256 controller prompt artwork look pixelated/dirty. Native 0.4.8 maps the canvas one-to-one to physical Retina pixels, yielding `1320×2868` and renderer fit scale 8 on the primary device. It replaces only `TouchControls.draw` with high-resolution vector discs, capsules and d-pad geometry; upstream touch hit testing, ownership, GB button state, release/reset and haptics remain unchanged. A fail-closed one-line size seam lets upstream layout use the physical pixel ratio.

`t.__type__` occurred once before successful Native 0.4.7 startup and remains open.

## Run 015 — Native 0.4.8 proves Retina geometry without a draw bottleneck

Native 0.4.8 reached the exact intended primary geometry: `440×956 CSS -> 1320×2868 canvas`, one backing pixel per physical display pixel, and Renderer fit scale 8. The vector touch adapter installed. Draw averages stayed only 0.09–0.37 ms, so the 4.3× larger framebuffer did not turn callback submission into a CPU bottleneck. Steady windows still reached 579–587 frames per roughly ten seconds at p95 23 ms. Complex intro/music sections remained update-bound, not draw-bound.

The supplied run again stored rather than hit named effect entries; cross-artifact cache reuse is therefore not proven. A second launch of the same artifact remains the relevant hit test. No incoming-call interruption was repeated, so lifecycle recovery remains unverified.

The user requested that the persistent native `Pokémon Yellow` title and black top gradient fade away. Official `WebViewController.present` exposes only initial `fullscreen` and optional `navigationTitle`; it exposes no runtime navigation-bar animation. Native 0.4.9 therefore omits `navigationTitle` and supplies a WebView-owned title/gradient that fades after 3.2 seconds. A top-edge tap reveals it again. Its close button sends an authenticated session event to native code and calls the documented controller `dismiss()` method.

The recurring `t.__type__` event was finally narrowed to an exact contract mismatch: all five toolbar dictionaries contained a custom `<ScreenToolbar />` component, while Scripting's official finished example places the native `<Button>` directly in `toolbar.cancellationAction`. Nested toolbar values are inspected as native component descriptors and the custom wrapper has no `__type__` at that boundary. Native 0.4.9 removes the wrapper and places direct native Buttons in all five toolbars. Physical non-recurrence remains required before declaring the defect closed.

## Attributed corrections

1. `Script` is imported from the documented `scripting` module instead of being treated as an unqualified global.
2. Browser/runtime TypeScript is bundled with pinned `esbuild@0.28.2` into one classic IIFE script. No local `type="module"`, runtime imports, or module dependency tree remains in the archive.
3. The bundle target is now Safari 13; private fields and optional chaining are transformed away.
4. A separate classic loader reports `bundle-load`, `bundle-execution`, or `bundle-timeout` and mirrors each stage to the Scripting console.
5. Preview 0.1.3 proved cache isolation through `Gen1Recomp Preview 013` and `runtime-v013`.
6. Preview 0.1.4 uses another distinct project/runtime identity and embeds the exact payload, both Lua normalizers, and WASM as deterministic base64 classic-script data. The player package loader is replaced before boot, so it performs no `fetch(file://…)` calls.
7. Decoded package byte lengths are logged and the base64 strings are released after use to reduce retained memory.
8. Both Preview and automatic Phase-0 package paths use the same embedded-package and diagnostic-loader correction.
9. Deterministic packaging tests assert that emitted browser bundles contain no `import`, `export`, private-field, or optional-chaining syntax and that all four embedded package keys are present.
10. Native 0.4.1 installs the parity-tested `bit` compatibility module into `_G.bit` before upstream main loads, matching the LuaJIT global used by ROM picture extraction and several Gen 2 paths.
11. Native 0.4.2 captures the WebView console and alert channel into bounded native logs, because love.js overwrites `Module.warn` and otherwise hides the actionable pre-window exception from Scripting.
12. Native 0.4.3 guards only invalid queueable-source `setLooping` calls in the love.js adapter, preserves static looping, and suppresses only the already-logged generic pre-window modal.
13. Native 0.4.4 sets upstream's documented `POKEPORT_TOUCH=1` for Web game sessions; its stable-tree experiment did not eliminate the separate Scripting `t.__type__` event.
14. Native 0.4.5 supplies an aspect-matched, fill-rate-bounded WebView backing surface through a generated host `conf.lua` wrapper, preserving upstream rendering and expanded-world behavior instead of stretching the game image.
15. Native 0.4.5 records WebView/CSS/backing/DPR geometry plus raw ten-second animation-frame gap distributions and Long Tasks data when the browser exposes it.
16. Native 0.4.6 defers bundle/LÖVE startup until Scripting's presented WebView reports stable visible geometry, instead of consuming the pre-presentation `1×1` placeholder.
17. Native 0.4.6 slices unchanged synchronous 44.1 kHz music synthesis from 8192 to 1024 samples per hand-off, fills one per update, and logs direct music/effect synthesis CPU cost.
18. Native 0.4.7 uses 512-sample slices and up to two fills per update to spread the same aggregate music work more evenly around a 60 Hz loop.
19. Native 0.4.7 persists rendered first-use effects as private signature-verified WAV cache entries under the removable game cache prefix; no generated audio enters the artifact or repository.
20. Native 0.4.7 measures `love.update` and `love.draw` CPU separately so residual game/render cost is distinguishable from synthesis.
21. Native 0.4.8 maps CSS viewport points through DPR to a one-to-one physical framebuffer while retaining integer Gen1Recomp pixels and aspect.
22. Native 0.4.8 replaces only upstream control drawing with Retina vector visuals; upstream input ownership/hit testing/release/haptics remain authoritative.
23. Native 0.4.8 explicitly pauses, flushes, resumes and watchdog-verifies the Emscripten loop across visibility/focus interruptions.
24. Native 0.4.9 replaces persistent native navigation title chrome with a WebView-owned timed fade/reveal title and explicit native dismiss event.
25. Native 0.4.9 replaces all custom toolbar wrapper values with direct native Buttons matching Scripting's documented toolbar descriptor contract.

## Replacement artifact

`Gen1Recomp Preview 014.scripting` version 0.1.4

- new project identity `Gen1Recomp Preview 014`;
- new runtime URL root `runtime-v014`;
- 11 entries;
- 8,263,309 bytes;
- SHA-256 `70a2cb7febc106f42c5bfbba55636879c560bd24b438ba03871cfcec02242184`;
- exact extracted archive re-passed interactive launcher startup and controlled shutdown in Chromium 149.

The replacement passed physical startup as Run 005. The next device report should identify the Scripting app version/build and exact iPhone model.

Native 0.2.0's diagnostic passed as Run 006. Runs 007–015 prove canonical play, physical Retina geometry and near-60 Hz steady motion. Native 0.4.9 is the transient-title and direct-toolbar-descriptor correction candidate. `t.__type__` non-recurrence, title/close behavior, warm-cache reuse, phone-call recovery, cache-ready UI, saves, exact multitouch/release, components/mods and wider devices remain untested.
