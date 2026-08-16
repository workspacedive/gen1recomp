# Gen1Recomp iOS UI/UX Architecture

**Principle:** preserve Game UI; modernize Platform UI. Never reskin one as the other.

## 1. Visual identity

The experience combines:

- original Gen1Recomp pixel rendering and timing;
- restrained Gen-1-inspired color/shape cues;
- native iOS navigation, sheets, lists, controls and accessibility for platform tasks;
- no imitation Game Boy bezel, fake cartridge shell, generic neon gamer dashboard or desktop window chrome.

Theme influences only Platform UI tokens and renderer presentation options. It cannot alter game rules, saves or mod order.

## 2. UI boundary

### Game UI — original renderer

Kept inside Gen1Recomp/LÖVE:

- title/intro;
- overworld, maps and transitions;
- battles;
- text boxes;
- bag, party, Pokédex, status and in-game menus;
- original/mod-provided game screens.

The 160 × 144 logical surface and optional upstream wide layouts remain the source of truth.

### Platform UI — Scripting TSX

Owns:

- launcher;
- ROM/data import;
- save and backup management;
- mod installation, compatibility, permissions, order and rollback;
- controls/layout editor;
- graphics/audio/performance/accessibility settings;
- component update/rollback;
- diagnostics.

Platform UI calls application services; it never imports core/LÖVE/mod internal modules.

## 3. Launcher information architecture

### Home

Priority order:

1. **Continue** — last valid game/slot, with game label and safe metadata.
2. **Games** — Red, Blue, Yellow; Gold clearly marked according to upstream support state.
3. **Saves** — recent slots/backups.
4. **Mods** — active profile, warnings/updates.
5. **ROM & Data** — import/readiness/cache health.
6. **Settings**.

The first launch replaces Continue with one clear **Import game data** action and an explanation that no ROM ships with the project.

### Launch states

```text
not configured
importing
ready
starting runtime
running
suspended
recovery available
blocked by incompatibility
error with action
```

No blank canvas while the runtime starts. Show the exact stage and a safe cancellation/recovery action.

### Bottom navigation and future Mods destination

The native root uses peer tabs for Home, Games, Updates, and Settings. A `mods` destination already exists in the typed tab registry but remains hidden until discovery/install/update/profile flows are functional. Enabling it must not restructure the other destinations.

The future Mods tab uses an App-Store-inspired hierarchy—editorial Discover, scannable product rows, native Search, detail pages, update badges, Installed and Profiles—adapted to Gen1Recomp's restrained visual identity. Its catalog, capability consent, activation journal, update-all transaction, profile/load order and rollback history are separate from system-component Updates. Full contract: [`mod-store-architecture.md`](mod-store-architecture.md).

## 4. ROM/data flow

```text
Choose file
→ explain local processing
→ read metadata/size
→ SHA-1 identity validation
→ user confirmation of detected game
→ private extraction/cache progress
→ integrity/self-test
→ release source bytes
→ Ready
```

UX requirements:

- never display or upload ROM bytes;
- no network needed for extraction;
- stage progress names, not fake percentages unless measurable;
- determinate progress only from real stage/item counts;
- cancellation leaves no active marker;
- errors explain accepted game/region without directing users to ROM downloads;
- re-import is explicit and does not silently delete saves/mods;
- cache version and last validation visible in details.

## 5. Save Manager

Each row:

- game/version;
- user slot name;
- modified date;
- play time only if actual save data provides it;
- validation/recovery state;
- active mod fingerprint/profile;
- backup availability.

Actions:

- Continue;
- rename;
- duplicate/backup;
- import/export;
- validate;
- restore known-good;
- delete with destructive confirmation.

Migration always stages a new copy, validates it and preserves the previous copy until the new one has loaded successfully.

## 6. Mod Manager

### Sections

- Installed
- Available
- Updates
- Profiles / Load order
- Incompatible / Failed

### Mod detail

- name, id, version and author;
- description/category/profile;
- Mod API and engine range;
- game targets;
- hard/optional dependencies;
- conflicts;
- requested capabilities with plain-language reasons;
- source/release/checksum;
- active version and previous known-good version;
- load status and attributed errors;
- documented differences.

### Load-order visualization

Use a native ordered list with dependency-locked rows. Explain why a row cannot move before its dependency. Do not expose a free-form integer priority editor as the primary UX.

### Capability language

Examples:

- “Read files included with this mod”
- “Store this mod’s own settings and data”
- “Connect to HTTPS services”
- “Run bounded background work”
- “Read step count after permission”
- “Legacy access to engine internals — high risk”

Always state that mod isolation is application-level, not an iOS process sandbox.

## 7. Settings

Only show supported options, grouped as:

- Gameplay
- Controls
- Graphics
- Audio
- Mods
- Saves
- Performance
- Accessibility
- Advanced
- About / Components

Component/About shows actual active versions: host, platform adapter, runtime, LÖVE, kernel façade, core, Mod API and UI. Unknown values display “Unavailable,” not zero or a guessed value.

## 8. Game presentation

### Pixel-perfect viewport

```text
logical game surface (160 × 144)
→ offscreen render target
→ integer scale from actual drawable pixel size
→ centered letterbox
→ safe-area-aware control overlay outside/around viewport where possible
```

- nearest-neighbor;
- no fractional stretching;
- no crop by default;
- optional fill/crop must be explicitly labelled and never default;
- Dynamic Island/home indicator/safe areas must not cover critical game pixels or controls;
- landscape preferred for play, but portrait may stack game and controls if it preserves usable integer scale.

### Layout algorithm

Use normalized regions and runtime geometry, not one set of device coordinates:

1. obtain safe-area content rect;
2. reserve minimum control target regions;
3. calculate largest integer game scale fitting remaining rect;
4. center game viewport;
5. place controls in remaining leading/trailing/bottom zones;
6. resolve overlap with user-adjusted normalized anchors;
7. persist anchors per orientation and device class, not raw pixels.

## 9. Touch controls

Required logical controls:

- D-pad;
- A/B;
- Start/Select;
- Menu/overlay;
- optional Fast Forward and Screenshot only after implemented capabilities exist.

Behavior:

- 44 × 44 pt minimum interactive targets; primary A/B and D-pad targets should usually exceed the minimum;
- independent visual and hit geometry so targets can be generous without oversized art;
- multi-touch: direction + A/B and A+B combinations;
- direction slide and diagonal policy explicitly defined;
- configurable dead zones, repeat and opacity;
- no action on mere layout-edit drag;
- stuck-key recovery on interruption, focus loss, rotation and pointer cancellation;
- haptic edge on press, not every held frame; global and per-control disable;
- left-handed preset;
- one-handed portrait preset;
- reset and preview in editor.

Scripting's documented gestures do not prove raw multi-touch correctness. This remains a go/no-go device probe.

## 10. Controller and keyboard

The abstraction supports touch/controller/keyboard, but UI shows controller/keyboard settings only when runtime capability detection reports them. Reviewed Scripting docs do not expose Apple's GameController framework; therefore Xbox/PlayStation/MFi support is not currently promised.

If added later:

- system-standard button labels and glyphs;
- live input test;
- remapping with conflict detection;
- disconnect fallback to touch;
- no controller-specific code in core.

## 11. Accessibility

### Platform UI

- system text styles/Dynamic Type;
- VoiceOver labels/hints/values for every custom row/control;
- 44 pt minimum targets;
- semantic colors and sufficient contrast;
- Reduce Motion removes decorative transitions;
- no information conveyed only by color;
- localization-safe layouts and locale-aware dates/numbers.

### Game UI

Pixel text cannot simply adopt Dynamic Type without breaking game layout. Provide adjunct accessibility instead:

- optional native transcript panel for current dialogue, populated through a public game event;
- VoiceOver announcements for focus/dialogue when enabled;
- scalable touch controls independent of game pixels;
- high-contrast Platform UI and optional renderer palette/filter only when it preserves content;
- Reduced Motion maps to documented presentation reductions, never skipped game-state transitions;
- haptics/captions options.

Accessibility consumes public events and commands; it does not inspect game memory.

## 12. Motion and haptics

- Native transitions for platform navigation.
- Game motion remains the renderer’s responsibility.
- Avoid duplicated transitions between TSX container and game surface.
- Haptics are semantic: confirm, cancel/error, control press, significant game event if exposed.
- Respect user disable/Reduce Motion and avoid continuous haptic noise.

## 13. Diagnostics dashboard

Show only measured/available fields:

- frame callback interval distribution;
- fixed updates per frame;
- update/render/bridge durations;
- dropped/late frames by defined criterion;
- runtime queue depth;
- asset/cache operation durations;
- save and mod transaction state;
- active component versions/capabilities.

CPU, process memory, thermal state, Lua GC heap and GPU counters appear only when an actual API supplies them. Every metric includes source and sample window.

## 14. Theme tokens

Platform themes:

- `gen1recomp` default: restrained warm red/cream/ink accents derived conceptually from project identity, not copied ROM pixels;
- `system`: standard iOS semantic colors;
- `dark`: system-driven dark appearance;
- custom accent where contrast validation passes.

Tokens are semantic (`background`, `surface`, `primaryAction`, `warning`, `gameRedAccent`) and provide Light/Dark/High-Contrast variants. Theme changes never enter core saves or mod behavior.

## 15. UX acceptance matrix

Before launcher release:

- first run with no data;
- valid/invalid/wrong-region file;
- import cancel/failure/retry;
- existing cache migration;
- no saves / many saves / corrupt save recovery;
- no mods / dependency/conflict/permission/error/update/rollback;
- Light/Dark/Increase Contrast/Reduce Motion;
- largest Dynamic Type and long German/English text;
- portrait and both landscape orientations;
- small and large supported iPhones;
- VoiceOver navigation;
- interrupted runtime and recovery;
- touch combinations and pointer cancellation.
