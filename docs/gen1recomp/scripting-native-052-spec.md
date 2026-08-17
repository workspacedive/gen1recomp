# Native 0.5.2 / Build 052 — modern native Tab descriptors

**Status:** implementation specification, 2026-08-17.

## Evidence and goal

Native 0.5.1 physically reached `runtime identity 0.5.1 / 051`, readiness-bound title reveal, frame 8, full Yellow gameplay and Retina `1320×2868`. One non-blocking Scripting component-builder exception still occurred before runtime startup:

```text
Failed to build component. TypeError: undefined is not an object (evaluating 't.__type__')
```

This disproves Native 050's flattened legacy `TabView -> NavigationStack` tree as the complete correction. The current official Scripting App Store documentation snapshot at repository revision `34c59e98dd2c203edca66a8418e93d90e7ecee22` documents the iOS-18+ structure as:

```text
TabView(selection: Observable)
└─ Tab(title, systemImage, value)
   └─ content
```

It separately retains a legacy `tabItem` example whose direct children are custom function components. Therefore custom legacy children are not treated as invalid; that earlier rationale is retracted.

Native 052 migrates only the root tab descriptor/selection boundary to the documented modern API. It is an evidence-driven compatibility candidate, not a claimed root-cause closure.

## Host, data access, permissions and side effects

- Host: existing finite native Scripting page presented through `Navigation.present`.
- New Scripting symbols: `Tab` and `useObservable`, verified in the current official App Store documentation package.
- Data access: unchanged private library/component/mod/save stores.
- Network: unchanged; still only manually initiated system/mod checks.
- Permissions: none added.
- External side effects: none added.
- Game WebView, ROM flow, save transactions, component update flow and mod flow remain byte/behavior unchanged.

## Implementation

1. Replace legacy `tabIndex`/`onTabIndexChanged` and `tag`/`tabItem` configuration.
2. Bind `TabView.selection` to `useObservable<ProductTabId>("home")`.
3. Make five explicit native `Tab` descriptors the immediate children.
4. Keep one `NavigationStack` inside each Tab so each product destination retains independent navigation context.
5. Drive Home → Games switching through `selection.setValue("games")`.
6. Keep toolbar objects unchanged because both current docs and the downloaded official finished example validate direct native Buttons in `cancellationAction`.

## Done contract

- exactly five immediate `Tab` descriptors with unique string values;
- no legacy `tabIndex`, `onTabIndexChanged`, `tag`, or `tabItem` root API remains;
- no tab child is produced dynamically or conditionally;
- all five native `NavigationStack` contexts and screen content remain;
- Native 051 save management and Native 050 game chrome package contracts remain;
- both TypeScript targets, Node/Python suites, npm audit, deterministic package rebuild, ZIP integrity, cumulative checksums and ROM/save/cache/patch/WAV exclusions pass;
- physical non-recurrence of `t.__type__` remains required and is not inferred from static structure.

## Non-goals

- No toolbar removal without evidence; its current shape is directly documented.
- No core, LÖVE, renderer, audio, input, save-format, mod or component-catalog change.
- No claim that Scripting's internal `t.__type__` implementation or exact failing node is known.
- No performance reduction or fidelity tradeoff.
