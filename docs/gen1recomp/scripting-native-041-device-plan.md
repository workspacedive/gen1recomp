# Native 0.4.1 physical extraction regression

**Candidate:** `Gen1Recomp Native 041` / 0.4.1 (041)
**Artifact SHA-256:** `15cd150c81479071cf9a2b9453c38531f13c6e8708cebec43434b62a7176d1d0`
**Primary environment:** Scripting 3.2.0, iOS 26.6, iPhone 16 Pro Max
**Status:** required; no 0.4.1 physical result is claimed

## Purpose

Native 0.4.0 already proved canonical Yellow DocumentPicker identity, private pending registration, retry without reselection, WebView handoff and upstream importer entry. It failed at:

```text
src/import/Rom.lua:198: attempt to index global 'bit' (a nil value)
```

Native 0.4.1 changes only the host compatibility layer relevant to that failure: the existing differential-tested `require("bit")` module is installed as LuaJIT-compatible `_G.bit` before upstream main loads. It also puts card status on a separate row for the narrow physical layout.

## Immediate regression

1. Import Native 041 as a new Scripting project and verify its SHA-256.
2. Open Games. Because private storage is shared, the existing Yellow **Import abschließen** card should appear without selecting the ROM again.
3. Tap **Import abschließen** once.
4. Keep the WebView open. Capture sanitized console output from runtime identity through either completed game start or the first new error.
5. Do not tap the upstream `Import ROM` button; the native pending source owns this retry.

Pass criteria:

- runtime log says `0.4.1 / 041` and payload `a8a370be…`;
- no `global 'bit'` error occurs;
- extraction completes and Yellow gameplay starts automatically;
- after dismissal, the native card says **Spielbereit** rather than **Import abschließen**;
- no second file picker was needed;
- the intermittent `t.__type__` component-build error does not recur, or its exact trigger is identified.

## Persistence/direct-boot follow-up

After an extraction pass:

1. fully close and reopen the Native 041 project;
2. confirm Yellow remains ready;
3. tap Play and verify the upstream Red/Blue/Yellow/Gold launcher is skipped;
4. create an in-game save, leave the game open at least 10 seconds, background/foreground once, then dismiss;
5. reopen and verify Continue plus native save metadata.

## Evidence boundaries

A missing global-BitOp error alone is not enough to pass. Ready frame lines prove runtime startup, not extraction. Completed extraction requires gameplay plus a native **Spielbereit** card. Audio, simultaneous touch, fidelity, save durability, iPad and other iPhone layouts remain separate evidence even after this regression passes.
