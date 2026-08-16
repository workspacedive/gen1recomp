# ROM-free Gen1Recomp launcher boot probe

This harness packages the local v0.1.96 source-built `game.love` with the separately tested root-level BitOp compatibility overlay. It does not include a ROM, generated cache or save and does not modify Gen1Recomp/LÖVE source.

Prepare:

```bash
python3 tools/prepare_lovejs_launcher.py
```

Serve the ignored output with required headers:

```bash
python3 tools/serve_lovejs_smoke.py \
  --bind 0.0.0.0 --port 4174 \
  --directory research/downloads/gen1recomp/lovejs-launcher
```

The external probe script reports whether the LÖVE factory completed, the 1024×768 launcher canvas became visible and any window/runtime errors occurred. The structured outside-browser result is `docs/gen1recomp/lovejs-launcher-report.json`.

This is only a ROM-free launcher-shell check. Do not interpret it as Scripting, physical iOS, ROM import, in-game rendering/audio/input, save/mod or performance evidence.
