# Gen1Recomp system update feed

This tree is the production-shaped, ROM-free feed for **manual system-component updates**. It is separate from the future mod marketplace.

- `catalog/stable.json` — strict sequence-numbered system catalog.
- `artifacts/org.gen1recomp.runtime.lovejs-0.1.0.zip` — pinned love.js LÖVE 11.5/Lua runtime files.
- `artifacts/org.gen1recomp.core-0.5.0.zip` — current Gen1Recomp 0.1.96 integration bundle with Retina-native output, vector touch visuals and interruption recovery.
- `artifacts/org.gen1recomp.core-0.4.0.zip` — retained even-scheduling/private-effect-cache integration bundle.
- `artifacts/org.gen1recomp.core-0.3.0.zip` — retained visible-viewport and bounded-audio integration bundle.
- `artifacts/org.gen1recomp.core-0.2.0.zip` — retained adaptive-viewport integration bundle.
- `artifacts/org.gen1recomp.core-0.1.96.zip` — retained historical bundle; no bytes were overwritten under an immutable version identity.

Regenerate deterministically:

```bash
python3 tools/package_system_updates.py
```

The catalog is intended to be fetched from the configured `main` URL after PR integration. Packages are immutable by `(component ID, semantic version)`; publishing different bytes under an existing identity is prohibited. A release increments `catalog.sequence`, retains versions needed for dependency/rollback resolution, and publishes new component versions rather than overwriting old archives.

## Trust boundary

The updater pins the catalog identity, domain, channel, exact HTTPS catalog URL, and artifact base URL. It rejects lower sequence numbers, mixed mod/system kinds, path escape, malformed manifests, unsafe archives, size mismatch, and SHA-256 mismatch. SHA-256 binds packages to the fetched catalog but is not a publisher signature; detached public-key catalog signatures remain a future hardening item.

The current feed advertises only the versions shipped by the validated Preview lineage, so a first manual check correctly reports that these components are current. It does not update the Scripting host project itself and contains no ROM or extracted game data.
