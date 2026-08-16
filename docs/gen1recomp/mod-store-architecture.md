# Native Mods tab and mod marketplace architecture

**Status:** Native 0.3.0 package-management slice implemented; discovery/profile activation remains gated
**Date:** 2026-08-16

## Product position

Mods become a peer **Bottom Navigation tab**, never a modal hidden under Settings and never part of the system-component Updates screen. The information architecture borrows the clarity and editorial hierarchy of the Apple App Store—large editorial features, scannable product rows, search, detail pages, update badges, and an account-like Installed area—without copying Apple artwork or making the project look like a generic storefront.

The root tab registry was reserved in Native 0.2.0. Native 0.3.0 enables it without restructuring Home, Games, Updates, or Settings.

## Implemented Native 0.3.0 slice

- native peer Mods tab;
- manual ZIP import through `DocumentPicker`;
- public GitHub `owner/repo` latest-stable-release installation;
- GitHub asset state/size/URL/SHA-256 binding and post-download manifest revalidation;
- manual individual and aggregate update actions;
- private immutable version directories, registry previous generation and deletion;
- visible permissions, conflicts, source and inactive state;
- archive rejection for traversal, collisions, ancestor-file conflicts, symlinks, expansion bombs, ROMs, patches, baseroms, native libraries and Lua bytecode;
- installation always inactive, with no implicit capability grant.

Not yet implemented: community-index discovery UI, thumbnails/search/categories, dependency auto-install, explicit capability consent, game/profile enablement/load order, save fingerprinting, mod injection into the game payload and runtime compatibility/rollback health checks. The installed registry is package management, not a claim that installed code has run.

## Navigation

### iPhone

```text
Mods tab
├── Discover
│   ├── editorial feature cards
│   ├── categories / collections
│   └── compact mod rows
├── Search
├── Updates
└── Installed / Profiles
```

Discover is the default landing screen. Search is native and progressive. Updates and Installed are reachable from prominent native navigation actions; they are not additional global tabs competing for limited bottom-bar space.

### iPad

The same routes adapt to a two-column `NavigationSplitView` when device/runtime evidence supports it:

- sidebar: Discover, Search, Updates, Installed, Profiles;
- detail: collection, mod detail, update detail, profile/load order;
- compact collapse preserves the iPhone hierarchy.

No device model coordinates or fixed card widths are used.

## Visual language

- Native system typography, semantic colors, SF Symbols, materials, lists, sheets, navigation, search, and Dynamic Type.
- Gen1Recomp identity through restrained warm red/cream/ink accents and edition-aware metadata, not through copyrighted game art, a Game Boy bezel, or neon “gamer” chrome.
- Editorial feature cards may use publisher-supplied, license-declared media. Missing/blocked media falls back to generated semantic artwork.
- Mod status is always text + symbol; color is supplemental.
- Rows retain at least 44 × 44 pt controls, and install/update actions use one stable verb per state: Get, Install, Update, Open, Incompatible, or Retry.

## Store domain

```text
mods/ui
  → ModStoreUseCases
    → ModCatalogRepository       (discovery metadata/cache)
    → ModPackageInstaller        (download/integrity/archive)
    → ModCompatibilityService    (game/API/dependency/conflict)
    → ModConsentService          (capabilities + reasons)
    → ModProfileRepository       (enabled set/load order)
    → ModActivationCoordinator   (mod-only journal/rollback)
```

The store consumes public application APIs only. It cannot import kernel, LÖVE, game-core, or Scripting platform internals.

## Separation from system updates

Shared:

- strict immutable catalog record primitives;
- semantic version and dependency algorithms;
- bounded HTTPS download/integrity helpers;
- archive traversal/symlink/size/ratio policies;
- common progress/error vocabulary and visual tokens.

Never shared:

- catalog ID/domain/feed;
- active pointers and activation journal;
- “Update All” transaction;
- storage namespace;
- rollback generations;
- release channel preference;
- capability consent;
- game/profile enablement.

A system update failure cannot roll back mods. A mod update cannot change LÖVE, Lua, Gen1Recomp core, host UI, Mod API, renderer, or platform adapter.

## Catalog and package model

A mod catalog has `domain: "mods"` and contains only `kind: "mod"`. Each release adds store metadata around the common component manifest:

- stable mod ID/version and publisher identity;
- localized name, subtitle, description, release notes, category, age/content notes;
- supported game editions/regions and generated-data schema;
- required Mod API, engine, and public hook ranges;
- required/optional dependencies and declared conflicts;
- requested least-privilege capabilities with localized reasons;
- artifact size, SHA-256, source URL, license, privacy/support URLs;
- media with dimensions, digest, license, and accessibility text;
- publication/review state and minimum host capability.

Unknown fields, mixed component kinds, catalog rollback, mutable version bytes, unsafe URLs, unsupported API majors, and missing consent fail closed. HTTPS + SHA-256 does not by itself prove publisher authenticity; detached signature and publisher-key policy must be designed before describing the store as signed or verified.

## Install transaction

```text
User taps Get/Install
→ fetch current mod release record
→ resolve dependencies and conflicts for selected game/profile
→ show compatibility and requested capabilities
→ explicit capability consent where required
→ download immutable archives into mod-only staging
→ verify exact size/SHA-256 and safe archive inventory
→ validate manifest and public API ranges
→ run bounded mod self-tests without activating
→ stage profile candidate/load order
→ activate at safe game restart boundary
→ health-check attributed mod load events
→ commit mod known-good generation or restore previous profile
```

Capabilities are application-level broker controls, not an iOS process sandbox. The UI states this plainly for high-risk/legacy access.

## Updates

- Detection may occur only according to a visible setting; initial implementation is manual.
- Update badge counts compatible, actionable releases—not catalog entries that cannot install.
- Each mod can update independently.
- “Update All” first computes one complete dependency/conflict plan, then stages all packages before changing any active profile pointer.
- A failure identifies the mod and stage. Unrelated installed versions remain intact.
- Updates requiring new capabilities pause for individual consent; bulk update never grants silently.
- Release notes and changed capabilities appear before installation.
- Previous known-good mod generations are bounded by storage policy and remain rollbackable.

## Profiles and load order

Installed bytes and profile activation are separate. One immutable mod version may be used by several profiles. Profiles store:

- target game/edition;
- enabled mod versions;
- dependency-derived load order;
- user ordering only where dependencies permit;
- capability grants scoped to mod + profile where appropriate;
- compatibility fingerprint used by save slots;
- known-good/previous activation generation.

The UI presents a native ordered list. Dependency-locked rows explain why they cannot move; raw numeric priorities are not the primary control.

## Screen states

Every store route includes:

- loading with retained cached content where safe;
- content with freshness timestamp when relevant;
- empty state with a useful next action;
- offline cached state;
- attributed error + retry;
- install/update progress with real stages;
- incompatible/blocked with explanation;
- consent required;
- rollback/recovery available.

Search and discovery never auto-install. Destructive removal distinguishes package bytes, profile membership, per-mod settings/data, and save compatibility records.

## Performance and privacy

- Catalog metadata is normalized and paged/cached; artwork is size-bounded, digest-checked, and decoded lazily after measurement supports it.
- No ROM, save, profile contents, device identifier, or gameplay telemetry is uploaded by default.
- Network destinations are visible publisher/catalog endpoints with HTTPS policy.
- Search can be remote only after disclosure; local installed search remains offline.
- Logs contain public mod identity/version/stage, not private file paths or user data.

## Runtime-activation gates

The package-management tab may be visible while every installed mod remains inactive. Enabling a mod in the game plane is blocked until:

1. system/mod registry durability behavior is physically validated;
2. native library and selected game/profile identity exist;
3. the mod-only activation coordinator and payload/runtime injection have automated tests;
4. capability consent language is reviewed in German and English;
5. empty/offline/error/install/update/rollback UI has real-device coverage;
6. at least one permitted, license-compatible test mod completes install, update, aggregate update, profile activation, failure attribution, cache persistence and rollback without touching system pointers.
