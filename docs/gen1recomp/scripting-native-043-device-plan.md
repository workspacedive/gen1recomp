# Native 0.4.3 queueable-audio regression

**Candidate:** `Gen1Recomp Native 043` / 0.4.3 (043)
**Artifact SHA-256:** `24289a697469ca7bddc49289f6aca42fed2b19ae5f1bf7cf51fe87b5887a111c`
**Environment:** Scripting 3.2.0, iOS 26.6, iPhone 16 Pro Max

## One immediate run

1. Import Native 043.
2. Open Games and tap **Import abschließen** on the retained Yellow card; do not reselect the ROM.
3. Leave the WebView open through game-window/title initialization.
4. Return all new `[Gen1Recomp Native]` error/warn lines if initialization still stops.
5. Report whether the disruptive generic Alert modal appears. Native 043 should log that known alert but not present its modal.

Expected identity:

```text
runtime identity 0.4.3 / 043
payload 89de911ef5118be90c9df0385abf6f76949573f1d424c377efe5362aa46e9043
```

Pass requires all of:

- no `Queueable Sources can not be looped` exception;
- no generic pre-window modal;
- Yellow reaches its game/title window;
- after dismissal, the card changes from **Import abschließen** to **Spielbereit**.

The host guard has been executed against pinned love.js: queue-source `setLooping(true)` no longer throws and remains non-looping, while a static source still becomes looping. This only proves the narrow adapter behavior; audible music/SFX quality remains a physical test.

Also report whether the independent `Failed to build component … t.__type__` event recurs and the immediately preceding UI action.
