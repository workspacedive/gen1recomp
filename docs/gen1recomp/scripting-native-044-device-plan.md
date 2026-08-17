# Native 0.4.4 touch-control regression

**Candidate:** `Gen1Recomp Native 044` / 0.4.4 (044)
**Artifact SHA-256:** `a718337d58493fb12f4578eec7a85037b6824893da05996b99d8f068b3501feb`
**Environment:** Scripting 3.2.0, iOS 26.6, iPhone 16 Pro Max

## Immediate run

1. Import Native 044.
2. Open the Yellow card and start/finish the game session without reselecting the ROM.
3. At the title/intro, verify visible D-pad, A, B, START and SELECT overlays.
4. Test each button, a held direction, direction + A/B simultaneously, sliding across D-pad directions, and release without a stuck input.
5. Dismiss and report whether the native card says **Spielbereit**.
6. Report whether `Failed to build component … t.__type__` appears again.

Expected identity:

```text
runtime identity 0.4.4 / 044
payload 89de911ef5118be90c9df0385abf6f76949573f1d424c377efe5362aa46e9043
```

Native 044 uses upstream's own touch overlay and documented `POKEPORT_TOUCH=1` host override because love.js reports `Web` inside WKWebView. It does not add browser-side game buttons or map touch to emulator keys. A browser game-session probe confirmed `POKEPORT_TOUCH=1` reaches the pinned runtime; visual/multi-touch behavior remains physical evidence.

The native launch path also no longer renders a transient working tree immediately before WebView presentation, the transition correlated with every observed `t.__type__` failure.
