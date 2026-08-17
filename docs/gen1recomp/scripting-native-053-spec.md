# Native 0.5.3 / Build 053 — toolbar isolation and truthful Home library state

**Status:** implementation specification, 2026-08-17.

## Physical input

Native 052 physically rendered the current official modern five-Tab root correctly, but `t.__type__` still occurred once before successful runtime startup. The Tab API is therefore retained and the next shared component-builder boundary is isolated: every screen currently acquires its own `Navigation.useDismiss()` and installs its own `toolbar.cancellationAction` descriptor.

The Native 052 screenshot also shows “Noch kein Spiel importiert” although the same session launches Yellow. This is not evidence of lost game data. The Home implementation currently equates “zero ready games” with “zero imported games,” while `null`, `pendingExtraction` and `needsReimport` all also produce zero ready games.

## Goals

1. Remove all five `toolbar` descriptor dictionaries from the native screen trees.
2. Acquire exactly one documented `Navigation.useDismiss()` callback at the App root.
3. Pass the callback into each screen and expose it as an ordinary native 44-point List Button with an SF Symbol.
4. Keep the explicit app close action available on every tab.
5. Replace nullable Home snapshot semantics with a discriminated loading/content/error state.
6. Show “no game imported” only for a successfully loaded registry whose game array is actually empty.
7. Distinguish ready, imported-not-ready, pending extraction and reimport-required counts.
8. Keep modern Tab navigation, game runtime, save management, components, mods and copyrighted-data boundaries unchanged.

## Host, data, permissions and side effects

- Host: finite native Scripting page.
- Scripting APIs: existing documented `Navigation.useDismiss`, `List`, `Section`, `Button`, `ProgressView`, `Label`; no new symbol.
- Data access and storage: unchanged App Group registry and private WebView IDBFS.
- New permissions/network targets/external writes: none.
- Close remains an explicit native callback; only its presentation moves from toolbar metadata into ordinary List content.

## Home state model

```text
loading
content(empty | ready | imported-not-ready | pending | needs-reimport)
error(action: open Games)
```

Games-screen snapshots and root initialization both publish the same content state. A root initialization failure becomes a visible non-technical Home error with a route to Games instead of silently masquerading as an empty library.

## Done contract

- zero `toolbar=` occurrences in product TSX;
- exactly one `Navigation.useDismiss()` occurrence;
- exactly five direct in-content native close Buttons;
- five modern explicit Tabs remain;
- Home null/loading cannot render the empty-library string;
- empty-library text requires `state.status === "content" && games.length === 0`;
- pending/reimport/imported and ready states have localized labels plus non-color symbols;
- both TypeScript targets, Node/Python tests, package contracts, npm audit, deterministic rebuild, ZIP/checksums and copyrighted-data exclusions pass;
- physical `t.__type__` non-recurrence remains required; removing toolbar metadata is a candidate, not a claimed root-cause proof.
