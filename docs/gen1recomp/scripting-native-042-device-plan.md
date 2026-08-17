# Native 0.4.2 hidden-error diagnostic

**Candidate:** `Gen1Recomp Native 042` / 0.4.2 (042)
**Artifact SHA-256:** `b111e878c8dfd93065ceeb6f3dcee1e467e7b398ce598d607b0d1763a8d293f5`
**Environment:** Scripting 3.2.0, iOS 26.6, iPhone 16 Pro Max

## Purpose

Native 0.4.1 removed the explicit global-BitOp failure, then love.js showed a generic pre-window alert without exposing its browser-console cause in Scripting. Native 0.4.2 forwards bounded WebView console logs, warnings, errors/Error stacks, and alert text into `[Gen1Recomp Native]` logs. It does not speculate about or silently patch the hidden failure.

## One required run

1. Import Native 042.
2. Open Games; the private Yellow pending card should remain available.
3. Tap **Import abschließen** once without reselecting the ROM.
4. Leave the WebView open through the alert.
5. Copy every new `[Gen1Recomp Native]` `error` or `warn` line beginning shortly before the alert, including stack lines.
6. Dismiss only after collecting those lines.

Expected identity:

```text
runtime identity 0.4.2 / 042
payload a8a370be1c86606cb679b57134fdab9c21c615b21e668ddc559151a860f3e276
```

The instrumentation itself has passed Chromium tests: ordinary `console.warn`, a console-error fixture, and a `window.alert` fixture all reached the native message handler. The physical run passes diagnostically when the underlying error detail is visible. Extraction/gameplay remains a separate pass criterion.

Also report whether `Failed to build component … t.__type__` occurs again and the action immediately preceding it. No ROM reselection or upstream blue **Import ROM** button is required.
