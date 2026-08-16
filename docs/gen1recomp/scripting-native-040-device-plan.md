# Native 0.4.0 physical-device plan

**Candidate:** `Gen1Recomp Native 040` / 0.4.0 (040)
**Artifact SHA-256:** `2d6ae25c8e8f6dab55c242270b042d14e1d70a76f8cdb0dbd4d3b829fdaf2c96`
**Status:** partially executed as physical Run 007. Canonical Yellow identity, pending registration/retry and extractor entry passed; extraction failed on the missing global BitOp corrected in Native 0.4.1. Continue with `scripting-native-041-device-plan.md`.

## Preconditions

- Import only `artifacts/Gen1Recomp-Native-040.scripting` after verifying its SHA-256.
- Use a personally dumped, legally owned canonical cartridge image.
- Selected end-to-end target: Pokémon Yellow US, exactly 1,048,576 bytes, SHA-1 `cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1`.
- Do not share a screenshot containing a file path, ROM filename, save content, or console Base64.
- Keep Console visible if practical; product logs must contain stages/identities only, never ROM bytes.

## A. Package and native shell

1. Import Native 040 as a new Scripting project; confirm name/version.
2. Open all five tabs and return to Games.
3. Check portrait and landscape. On iPad, also check regular-width layout.
4. Record Scripting app version/build, iOS/iPadOS version, device model, language, appearance, and Dynamic Type size.

Pass: tabs render without Script errors, clipped controls, or an unexpected Web launcher.

## B. Canonical Yellow import

1. Tap **Import or Replace Game** and choose the canonical Yellow file once.
2. Observe native stages: reading, exact identity verification, private staging, registration, runtime preparation.
3. Keep the game surface open while upstream extraction runs. Do not dismiss during this first pass.
4. Record the first `ready frame` line and whether gameplay starts without the upstream multi-game launcher.
5. Dismiss the game surface only after it has stabilized; return to Games.

Pass:

- Yellow is the detected card; no other game is registered;
- no ROM/hash mismatch error occurs;
- extraction reaches the game through upstream Gen1Recomp, not an emulator;
- the card becomes **Ready to Play**;
- no second file selection is requested;
- Console contains no ROM bytes/Base64/external path.

If extraction fails or the view is dismissed early, do not select the ROM again immediately. The card should remain **Finish Import** and retry from its verified private source.

## C. Persistence and direct launch

1. Fully close and reopen the Scripting project.
2. Confirm Yellow remains registered and ready.
3. Tap Play.
4. Record whether the game opens directly. Seeing the Red/Blue/Yellow/Gold launcher is a failure for a ready card.
5. Repeat after putting Scripting in the background for 30 seconds.

Pass: registry and IDBFS cache survive; Play opens Yellow directly; no ROM picker appears.

## D. Save discovery and lifecycle

1. Create an in-game save through the original game UI.
2. Leave gameplay open for at least 10 seconds so the periodic flush runs.
3. Background/foreground once, then dismiss.
4. Reopen Yellow and verify Continue works.
5. Return to Games and record the save-file count shown on the card.
6. Repeat with immediate dismissal after another save to characterize the remaining close boundary honestly.

Pass: ordinary periodic/background flow preserves the save and native metadata discovers it. Immediate-dismiss behavior is recorded separately, not inferred.

## E. Cache deletion with save preservation

1. Tap Delete on the Yellow card and confirm.
2. Confirm the card disappears without presenting the game surface.
3. Reimport the same canonical Yellow file.
4. After extraction, verify the prior save is still discoverable/continuable.

Pass: only Yellow's extracted cache/registration is removed; save data survives. A second installed game's cache, if later tested, must remain untouched.

## F. Recovery variants

Run independently when practical:

- dismiss during extraction, then retry **Finish Import** without reselecting;
- terminate the script after native registration but before cache completion, then reopen;
- replace an already-ready Yellow import with the same canonical file;
- deny/cancel DocumentPicker and verify no card/source is created;
- choose an incorrect-size non-ROM fixture and verify a native size error;
- choose a 1 MiB noncanonical fixture and verify an identity error with no persistent card.

Fixtures must contain no copyrighted content.

## G. Evidence to return

- device/Scripting/iOS details;
- pass/fail per section;
- exact stage/error text for any failure;
- first ready-frame number;
- whether direct launch skipped the upstream launcher;
- whether retry avoided a second picker;
- whether save count/Continue survived;
- whether delete/reimport preserved saves;
- sanitized Console lines around failures only.

A browser result, screenshot of a card, or ready-frame line alone does not prove extraction, cache persistence, saves, input, audio, or fidelity.
