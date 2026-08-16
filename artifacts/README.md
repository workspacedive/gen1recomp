# Downloadable Scripting artifacts

## Current native shell

- [`Gen1Recomp-Native-020.scripting`](Gen1Recomp-Native-020.scripting)
- Project: `Gen1Recomp Native 020`
- Version: 0.2.0
- Size: 8,288,985 bytes
- SHA-256: `b50cde2925f261b7000a211b1b73756c4e06869ae19cdd157cd3cbe41eafc957`

This is the first ROM-free **native product-shell** build. It adds Home/Games/Updates/Settings bottom navigation, private component state, manually initiated LÖVE/Lua and Gen1Recomp update UI/transactions, an extension point for a later Mods tab, and an explicit ROM-free runtime diagnostic. Native TSX rendering and the update adapter still need physical Scripting-device validation. The Games screen is an honest empty state; ROM import is not activated in 0.2.0.

## Physically validated runtime fallback

- [`Gen1Recomp-Preview-014.scripting`](Gen1Recomp-Preview-014.scripting)
- Project: `Gen1Recomp Preview 014`
- Version: 0.1.4
- Size: 8,263,309 bytes
- SHA-256: `70a2cb7febc106f42c5bfbba55636879c560bd24b438ba03871cfcec02242184`

Preview 0.1.4 physically passed local WebView/love.js/Lua/WASM/WebGL startup on iPhone/iOS 18.7. It remains the known runtime diagnostic fallback, not the completed product.

Both packages contain no ROM or extracted game data. Checksums are also listed in [`SHA256SUMS`](SHA256SUMS).
