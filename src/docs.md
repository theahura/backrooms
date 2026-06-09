# Noridoc: src

Path: @/src

### Overview
- Contains all game source code, organized into scenes (Phaser integration) and systems (pure game logic)
- Entry point is `@/src/main.js`, which creates the Phaser.Game instance, loads saved state from localStorage, registers scenes, and installs browser lifecycle listeners for save safety nets

### How it fits into the larger codebase
- `@/index.html` loads `@/src/main.js` as an ES module via `<script type="module">`. Its `#game-container` is sized to `100dvh` (with a `100vh` fallback) so the canvas tracks the dynamic mobile viewport as the browser URL bar hides/shows, and it carries `mobile-web-app-capable`/`theme-color` meta tags alongside the existing Apple web-app tags
- `@/src/main.js` wires Phaser config (physics, renderer), picks the Scale mode at boot based on whether the device is touch-primary (see Core Implementation), registers all scene classes (GameScene, ShopScene, PauseScene) with the engine, and loads persisted state (including `unlockedLocations` and `activeLocation`) into `game.registry`
- `@/src/scenes/` contains Phaser Scene subclasses: `GameScene` for gameplay, `ShopScene` for the between-run upgrade shop, and `PauseScene` for the in-game pause overlay (launched on top of GameScene, freezes gameplay and displays a controls reference)
- `@/src/systems/` contains pure functions that scenes call for game math (movement, visibility, room geometry, room interior variety via six room archetypes (open/maze/columns/corridor/storage/cubicles), room visual theming (per-room-type floor/wall colors via `@/src/systems/roomThemes.js`), furniture placement with type-dependent light blocking, starting room layout, starting location definitions and alternate exit spawning, multi-floor level wrapping with multiple stair connections, level generation with extra door connections, enemy spawning/AI with cross-room pathfinding, enemy difficulty scaling, time-based danger escalation, combat/health/healing with per-type constants, shooting/bullets including shotgun spread and enemy projectile constants, weapon types/inventory/switching/stat computation, battery/flashlight drain, item spawning with distance-from-entrance loot tier scaling, BFS hop-distance from the entrance, inventory management with capacity constraints, shop/upgrade logic, door state management, light switch state management, light spill through doorways (`@/src/systems/lightSpill.js`), hiding state management, exploration/minimap tracking, BFS-based room graph pathfinding, pause controls data (`@/src/systems/pause.js`), localStorage persistence, procedural audio configuration with per-enemy-type sound logic and distance-based volume attenuation, Web Audio sound synthesis, pixel art sprite definitions, and character animation definitions)
- The architecture enforces a one-way dependency: scenes import from systems, but systems never import from scenes or Phaser. Systems may import from each other (e.g., `enemy.js` imports `raySegmentIntersection` from `visibility.js`)

### Core Implementation
- **Game initialization** (`@/src/main.js`): creates a `Phaser.Game` whose Scale mode is chosen at module load by `detectTouchPrimary()` from `@/src/systems/touchControls.js` (coarse-pointer media query OR `navigator.maxTouchPoints > 0`). Registers all three scene classes: GameScene, ShopScene, and PauseScene (PauseScene is never auto-started; it is launched on demand by GameScene). The two Scale branches are a deliberate desktop/touch split:
  - **Desktop (FIT)**: a fixed internal 1024x768 resolution scaled via `Scale.FIT` + `CENTER_BOTH` (the canvas auto-scales to fill any screen and letterboxes with black bars, which are invisible against the black game). Because the internal resolution is fixed, every world and HUD coordinate is unchanged regardless of window size. This is the original behavior and is preserved exactly.
  - **Touch (RESIZE)**: `Scale.RESIZE` sized to `window.innerWidth`/`innerHeight`, so the canvas fills the entire device viewport at native resolution (fixes the prior pillarboxed/width-limited mobile layout). The render surface now equals the screen, so touch UI cannot use hardcoded design-space coordinates -- it is positioned at runtime from the live `this.scale.width`/`height` via `computeTouchLayout()` (see `@/src/scenes` and `@/src/systems`), and the ShopScene zoom-fits its 1024x768 layout into the viewport (see `@/src/scenes`). Under RESIZE the viewport changes on orientation flip, URL-bar hide/show, and fullscreen toggles, so scenes re-layout on `this.scale` `resize` events.
  Also configured: Arcade physics (zero gravity for top-down), `pixelArt: true` for nearest-neighbor texture sampling (prevents anti-aliasing blur on pixel art sprites), and the `rexVirtualJoystick` global plugin (from `phaser3-rex-plugins`) consumed by the mobile touch sticks. Registers GameScene and ShopScene. GameScene is listed first, so it is the initial scene on game launch. Immediately after creating the game, `main.js` calls `loadGame()` from `@/src/systems/persistence.js` and, if a valid save exists, populates `game.registry` with the saved `shopState`, `runCount`, `collectedLore`, `unlockedLocations`, and `activeLocation`. This happens before any scene's `init()` runs, so scenes always see persisted state in the registry. `main.js` also installs two browser lifecycle listeners (`visibilitychange` with `hidden` check, and `beforeunload`) that flush the current registry state (including `collectedLore`, `unlockedLocations`, and `activeLocation`) to localStorage via `saveGame()` as safety nets for unexpected tab closures
- **Scene flow**: the game alternates between GameScene (gameplay) and ShopScene (upgrade shop). On exit or death, GameScene transitions to ShopScene, passing `treasureEarned` and optionally `newLocation` (if the player used an alternate exit portal). On "Enter Backrooms", ShopScene transitions to GameScene. During gameplay, PauseScene can be launched as an overlay on top of GameScene -- GameScene is frozen via `scene.pause()` while PauseScene runs, and on resume PauseScene calls `scene.resume('GameScene')` and stops itself. PauseScene does not modify any game state or interact with the registry. Cross-scene state (shop upgrades, gold, run counter, unlocked locations, active location) flows through `game.registry` in memory and is backed by localStorage via `@/src/systems/persistence.js` for cross-session persistence. Scenes call `saveGame()` at every point where they mutate registry state (e.g., after adding gold, after purchasing upgrades, after incrementing runCount, after unlocking a location), and `main.js` adds lifecycle listeners as safety nets
- **Frame loop**: Phaser calls `GameScene.update()` every frame, which reads input, resolves the aim angle and movement velocity through pure resolvers in `@/src/systems/touchControls.js` (so the desktop mouse/keyboard path and the touch joystick path share a single branch point keyed on `this.touchMode`), computes velocity via the movement system (at half speed while hiding via `HIDING_SPEED_MULTIPLIER`, full speed otherwise), ticks combat/fire/battery state, processes shooting input (gated through `resolveFireIntent` so touch fires only from the dedicated FIRE button; disabled while hiding; fires per-weapon bullets using weapon-specific textures, speeds, and spread patterns), resolves E-key interaction (nearest door, switch, hideable furniture, or weapon pickup by distance), processes Q-key weapon switching, checks bullet expiry for both player and enemy bullets (per-bullet range via `setData`), runs enemy AI updates (with lit-room freezing, hiding-based detection suppression, and spitter projectile firing), updates exploration state (tracking which rooms the player has visited), redraws the player/HUD/minimap (including inventory counts and capacity indicator, weapon name, hiding visual state, per-floor fog-of-war room reveal, and stair glow animation), toggles door sprite visibility, swaps switch sprite textures, and recomputes the flashlight/darkness overlay (including lit rooms). The update loop early-returns if the player is dead, a day-ending transition is in progress, or a stair teleportation is in progress (`isTeleporting`)
- **Level generation**: at scene creation, `GameScene` calls `generateMultiFloorLevel()` from `@/src/systems/stairs.js` with a per-run seed (derived from `runCount` in registry) and `FLOOR_ROOM_COUNTS` (default [4, 3]), which wraps `generateLevel()` per floor to produce a multi-floor set of connected rooms with doorways (including extra doors between grid-adjacent rooms) and up to 2 stair connections using distinct rooms. Floors are separated by 10000px in world-space Y. The scene then iterates over all rooms for rendering, physics setup, furniture placement, internal room structure generation (via `@/src/systems/maze.js`), enemy spawning, and creates stair zones for floor-to-floor teleportation

```
index.html
  -> src/main.js (Phaser.Game config, registers both scenes)
       -> src/scenes/GameScene.js (gameplay: create + update loop)
       |    -> src/systems/stairs.js     (multi-floor level wrapping + stair connections)
       |    -> src/systems/level.js      (single-floor multi-room level generation)
       |    -> src/systems/movement.js   (velocity math)
       |    -> src/systems/visibility.js (raycasting + raySegmentIntersection)
       |    -> src/systems/room.js       (wall segments with door support)
       |    -> src/systems/furniture.js  (obstacle segments + placement, type-dependent light blocking)
       |    -> src/systems/maze.js       (room interior variety: 6 archetypes including maze, columns, corridor, storage, cubicles)
       |    -> src/systems/roomThemes.js (per-room-type floor/wall color theming)
       |    -> src/systems/enemy.js      (enemy spawning + LOS + AI state machine + cross-room navContext)
       |    -> src/systems/pathfinding.js (BFS room graphs: standard + full with closed-door edges for crawler pathfinding)
       |    -> src/systems/scaling.js    (run-based enemy difficulty scaling)
       |    -> src/systems/danger.js     (time-based danger escalation: wave spawning in unsafe rooms)
       |    -> src/systems/combat.js     (player/enemy health + damage + healing + invulnerability)
       |    -> src/systems/shooting.js   (bullet velocity + fire rate + range expiry + shotgun spread)
       |    -> src/systems/weapons.js   (weapon types + 2-slot inventory + switching + effective stats)
       |    -> src/systems/battery.js    (battery drain + cone scaling + flicker + recharge)
       |    -> src/systems/items.js      (item type definitions + room item spawning + distance-based loot tier scaling)
       |    -> src/systems/distance.js   (BFS hop-distance from entrance over door/stair graph, drives loot scaling)
       |    -> src/systems/inventory.js  (inventory state: batteries + treasure value + capacity)
       |    -> src/systems/doors.js      (door state management + toggle + proximity)
       |    -> src/systems/lightswitch.js (switch state + toggle + lit room detection)
       |    -> src/systems/lightSpill.js (gradient light spill zones through open doorways)
       |    -> src/systems/hiding.js     (hiding state + enter/exit + nearest hideable)
       |    -> src/systems/exploration.js (exploration state + minimap data computation)
       |    -> src/systems/startroom.js  (crack points for room 0 doorway visual)
       |    -> src/systems/locations.js  (location definitions, room 0 layout/colors, alternate exit spawning)
       |    -> src/systems/shop.js       (getUpgradeValue for stat + weapon initialization)
       |    -> src/systems/lore.js        (lore note spawning per room)
       |    -> src/systems/persistence.js (saveGame after runCount increment)
       |    -> src/systems/random.js     (shared seeded PRNG)
       |    -> src/systems/audio.js      (footstep interval + ambient delay timing + per-enemy-type sounds + distance volume)
       |    -> src/systems/audioEngine.js (sound synthesis + ambient drone + ambient playback)
       |    -> src/systems/sprites.js    (pixel art sprite + animation definitions for texture/animation generation)
       |
       -> src/scenes/ShopScene.js (between-run upgrade shop + location selector + lore journal)
       |    -> src/systems/shop.js       (upgrade defs, pricing, purchase logic, state)
       |    -> src/systems/locations.js  (location name lookup for display)
       |    -> src/systems/lore.js       (journal entries + pagination for lore review overlay)
       |    -> src/systems/persistence.js (saveGame at each mutation point)
       |    -> src/systems/audioEngine.js (sound synthesis for UI feedback sounds)
       |
       -> src/scenes/PauseScene.js (overlay: freezes GameScene, shows controls reference)
       |    -> src/systems/pause.js      (desktop/mobile controls data for display)
       |
       -> src/systems/persistence.js  (loadGame on boot, saveGame on lifecycle events)

  game.registry (cross-scene in-memory state, backed by localStorage):
    shopState          -> { gold, upgrades: { battery, flashlight, health, speed, weaponDamage, fireRate, bulletRange, backpack, startingPistol, minimap } }
    runCount           -> incrementing integer used as level seed
    collectedLore      -> array of lore entry IDs collected across all runs (meta-progression)
    unlockedLocations  -> array of location IDs the player has unlocked (default ['store'])
    activeLocation     -> location ID for the next run's starting room theme (default 'store')

  localStorage (cross-session persistence via persistence.js):
    backrooms_save -> { version: 3, shopState, runCount, collectedLore, unlockedLocations, activeLocation }
```

### Things to Know
- **Texture generation lifecycle**: all pixel art textures (furniture, items, bullets, weapon pickups, doors, switches, lore notes, player character frames, and enemy character frames) and all animations are pre-generated once by `GameScene.generateSpriteTextures()` at the very start of `create()`, before any other creation method runs. Sprite and animation definitions live in `@/src/systems/sprites.js` (pure data, no Phaser dependency); the Phaser `textures.generate()` and `anims.create()` calls happen only in `GameScene`. Furniture rendering uses a sprite-first pattern: standard types render as Phaser sprites with `setDisplaySize()`, while location-specific types without sprite definitions (e.g., counter, couch from `@/src/systems/locations.js`) fall back to Graphics `fillRect()`. Doors and switches use static sprites whose visibility or texture is toggled per frame. The player and all enemy types are animated sprites that play looping animation sequences and rotate with `setRotation()` for directional facing
- Camera follows the player with lerp 0.1 for smooth tracking, bounded to the full level extent (all rooms)
- Mouse coordinates must use `pointer.worldX`/`worldY` (not `pointer.x`/`pointer.y`) because the camera moves with the player. However, Phaser 3 only updates these cached properties on mouse events -- they go stale when the camera scrolls without mouse movement (e.g., WASD movement with a stationary mouse). `GameScene.update()` calls `pointer.updateWorldPoint(this.cameras.main)` at the top of every frame to keep world coordinates current. Any new code reading `pointer.worldX`/`worldY` in the frame loop can rely on this, but code outside the frame loop (e.g., event callbacks) should call `updateWorldPoint()` itself if camera position may have changed since the last mouse event
- Floors are separated by 10000px in world-space Y (`FLOOR_Y_OFFSET` from `@/src/systems/stairs.js`). This gap is large enough that raycasting, physics, and enemy AI naturally cannot interact across floors without explicit teleportation. Each room object carries a `floor` field (integer) indicating which floor it belongs to. The minimap uses `getFloorBounds()` and the `floorFilter` parameter of `getMinimapData()` to display only the current floor's visited rooms
- The wall segment array (`wallSegments`) is the shared data structure consumed by the visibility system (flashlight raycasting), the enemy system (line-of-sight checks), and the door system (closed doors add/remove segments dynamically). Sources that contribute static segments at level creation are: room walls (`room.js`), light-blocking furniture (`furniture.js`, only items with `blocksLight: true`), and room interior structures (`maze.js` -- walls, columns, crates, cubicle partitions, etc.). Non-blocking furniture (types with `blocksLight: false`, e.g., table, desk, bed, vent) does NOT contribute segments. Any new occluder type must produce segments in `{x1,y1,x2,y2}` format to participate in all three systems
- **Touch input follows the same systems/scenes split as the rest of the game**: pure, Phaser-free decision functions live in `@/src/systems/touchControls.js` (which input source to use for aim/move, whether to fire, touch detection, and `computeTouchLayout()` for screen-space placement of the touch UI) and are unit-tested in Node; the Phaser wiring (rex virtual joysticks, FIRE/USE/WPN/BATT/FS buttons, pointer polling, resize relayout, fullscreen requests) lives in `@/src/scenes/GameScene.js`. `this.touchMode` is set once during input setup and gates every input fork. Desktop behavior is unchanged when `touchMode` is false because each resolver returns the original mouse/keyboard value in that case
- **Touch UI is responsive, not hardcoded**: because touch devices run under `Scale.RESIZE` (see Game initialization), the canvas equals the device viewport and changes size on orientation flips, URL-bar hide/show, and fullscreen toggles. Touch control positions therefore come from the pure `computeTouchLayout()` (in `@/src/systems/touchControls.js`) keyed on the live viewport, and `GameScene` re-runs it on every `this.scale` `resize` event to reposition every control. Vertically centering the sticks (rather than anchoring them to the bottom) is the deliberate fix for downward thumb travel being eaten by the mobile browser's bottom gesture zone. `ShopScene` is laid out around the fixed 1024x768 design space and stays aligned under RESIZE by zoom-fitting its camera to the viewport (see `@/src/scenes`)
- Light switches and the hiding system do not produce wall segments. Switches are small interactable objects placed near walls that interact with the darkness system by drawing white rectangles into the BitmapMask (same mask the flashlight uses) and with the enemy system by providing lit room IDs that freeze enemies in place (velocity zeroed, AI skipped). Hiding operates on existing furniture objects (those with `canHide: true`) and affects enemy detection via the `playerHidden` flag on `updateEnemyAI()`

Created and maintained by Nori.
