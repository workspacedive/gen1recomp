# Native 0.4.5 adaptive-viewport and timing run

**Candidate:** `Gen1Recomp Native 045` / 0.4.5 (045)  
**Artifact SHA-256:** `f0f73aa281c506bdd070651d88cdce996f1050a2812adb439e8c9504c58bef10`

This run tests the too-small game/controls defects and collects raw timing evidence for the reported stutter. It does not claim that stutter is fixed. Native 045 changes host surface geometry, not Gen1Recomp's renderer or game timing.

## Install and preserve recovery

1. Keep Native 044 installed until Native 045 has launched successfully.
2. Import `Gen1Recomp-Native-045.scripting` into Scripting 3.2.0.
3. Open Native 045. The shared private registry should offer the existing Yellow entry; do not reselect a ROM unless the card explicitly remains **Import abschließen** and launch requests it.
4. Start Yellow and keep the console log.

No ROM, cache or save is inside the package.

## Required geometry evidence

Copy the lines beginning with:

```text
runtime identity 0.4.5 / 045
viewport ... CSS -> ... canvas, scale ..., ..., DPR ...
display: ... units, ... px, fit scale ...
surface ... canvas -> ... CSS
```

Then report:

- whether the game surface now occupies the available WebView without geometric stretching;
- whether noticeably more world is visible along the long screen axis, as in the `.ipa`;
- whether D-pad/A/B/Start/Select are materially larger and comfortably usable;
- whether controls overlap game UI or unsafe screen edges;
- portrait result and, if Scripting allows rotation, landscape result.

The backing surface intentionally follows the WebView aspect. The 160×144 game composition keeps an integer scale, while upstream Renderer may draw expanded world on the long edge. CSS scales that complete surface uniformly. DPR is logged but is not used as a fill-rate multiplier.

## Timing evidence

Remain in each scene for at least 12 seconds so a complete telemetry window is emitted:

1. Oak's opening explanation;
2. player/rival name selection;
3. ordinary overworld walking;
4. a battle.

Copy every line beginning with:

```text
performance {"type":"preview.performance"...
```

Label which gameplay scene each line covers. These are raw ten-second windows containing RAF p50/p95/p99/max, counts over 25/50/100/250 ms, Long Tasks data when WebKit exposes it, visibility and runtime frame. Do not infer the cause from one metric; the lines are input to the next measured correction.

Also state whether audio remained continuous or audibly broke up in the same window.

## Input regression

Verify separately:

- tap each control;
- hold each D-pad direction for two seconds, then release;
- slide from one D-pad direction to another;
- hold a direction while tapping A and B;
- press Start and Select;
- dismiss the WebView after releasing all touches, relaunch, and check for stuck input.

Ordinary play passed on Native 044, but these exact ownership/release cases remain unproven.

## Native state and lifecycle

After closing the game, record whether:

- the Yellow card says **Spielbereit**;
- a second launch boots without ROM selection or extraction;
- a save remains available after close/relaunch;
- the independent Scripting `t.__type__` component-build event recurs.

If `t.__type__` appears but runtime still starts, include both timestamps. Native 045 does not claim that event is fixed.
