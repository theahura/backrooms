# Noridoc: src

Path: @/src

### Overview
- Contains all game source code, organized into scenes (Phaser integration) and systems (pure game logic)
- Entry point is `@/src/main.js`, which creates the Phaser.Game instance, loads saved state from localStorage, registers scenes, and installs browser lifecycle listeners for save safety nets

### How it fits into the larger codebase
- `@/index.html` loads `@/src/main.js` as an ES module via `<script type="module">`
- `@/src/main.js` wires Phaser config (resolution, physics, renderer), registers both scene classes (GameScene, ShopScene) with the engine, and loads persisted state (including `unlockedLocations` and `activeLocation`) into `game.registry`
- `@/src/scenes/` contains Phaser Scene subclasses: `GameScene` for gameplay and `ShopScene` for the between-run upgrade shop
- `@/src/systems/` contains pure functions that scenes call for game math (movement, visibility, room geometry, room interior variety via maze walls/columns, furniture placement with type-dependent light blocking, starting room layout, starting location definitions and alternate exit spawning, multi-floor level wrapping with multiple stair connections, level generation with extra door connections, enemy spawning/AI with cross-room pathfinding, enemy difficulty scaling, combat/health with per-type constants, shooting/bullets including shotgun spread and enemy projectile constants, weapon types/inventory/switching/stat computation, battery/flashlight drain, item spawning, inventory management with capacity constraints, shop/upgrade logic, door state management, light switch state management, hiding state management, exploration/minimap tracking, BFS-based room graph pathfinding, and localStorage persistence)
- The architecture enforces a one-way dependency: scenes import from systems, but systems never import from scenes or Phaser. Systems may import from each other (e.g., `enemy.js` imports `raySegmentIntersection` from `visibility.js`)

### Core Implementation
- **Game initialization** (`@/src/main.js`): creates a `Phaser.Game` with 1024x768 resolution, Arcade physics (zero gravity for top-down), and registers GameScene and ShopScene. GameScene is listed first, so it is the initial scene on game launch. Immediately after creating the game, `main.js` calls `loadGame()` from `@/src/systems/persistence.js` and, if a valid save exists, populates `game.registry` with the saved `shopState`, `runCount`, `collectedLore`, `unlockedLocations`, and `activeLocation`. This happens before any scene's `init()` runs, so scenes always see persisted state in the registry. `main.js` also installs two browser lifecycle listeners (`visibilitychange` with `hidden` check, and `beforeunload`) that flush the current registry state (including `collectedLore`, `unlockedLocations`, and `activeLocation`) to localStorage via `saveGame()` as safety nets for unexpected tab closures
- **Scene flow**: the game alternates between GameScene (gameplay) and ShopScene (upgrade shop). On exit or death, GameScene transitions to ShopScene, passing `treasureEarned` and optionally `newLocation` (if the player used an alternate exit portal). On "Enter Backrooms", ShopScene transitions to GameScene. Cross-scene state (shop upgrades, gold, run counter, unlocked locations, active location) flows through `game.registry` in memory and is backed by localStorage via `@/src/systems/persistence.js` for cross-session persistence. Scenes call `saveGame()` at every point where they mutate registry state (e.g., after adding gold, after purchasing upgrades, after incrementing runCount, after unlocking a location), and `main.js` adds lifecycle listeners as safety nets
- **Frame loop**: Phaser calls `GameScene.update()` every frame, which reads input, computes velocity via the movement system (at half speed while hiding via `HIDING_SPEED_MULTIPLIER`, full speed otherwise), ticks combat/fire/battery state, processes shooting input (disabled while hiding; fires per-weapon bullets using weapon-specific textures, speeds, and spread patterns), resolves E-key interaction (nearest door, switch, hideable furniture, or weapon pickup by distance), processes Q-key weapon switching, checks bullet expiry for both player and enemy bullets (per-bullet range via `setData`), runs enemy AI updates (with lit-room freezing, hiding-based detection suppression, and spitter projectile firing), updates exploration state (tracking which rooms the player has visited), redraws the player/doors/switches/HUD/minimap (including inventory counts and capacity indicator, weapon name, hiding visual state, per-floor fog-of-war room reveal, and stair glow animation), and recomputes the flashlight/darkness overlay (including lit rooms). The update loop early-returns if the player is dead, a day-ending transition is in progress, or a stair teleportation is in progress (`isTeleporting`)
- **Level generation**: at scene creation, `GameScene` calls `generateMultiFloorLevel()` from `@/src/systems/stairs.js` with a per-run seed (derived from `runCount` in registry) and `FLOOR_ROOM_COUNTS` (default [4, 3]), which wraps `generateLevel()` per floor to produce a multi-floor set of connected rooms with doorways (including extra doors between grid-adjacent rooms) and up to 2 stair connections using distinct rooms. Floors are separated by 10000px in world-space Y. The scene then iterates over all rooms for rendering, physics setup, furniture placement, maze wall/column generation (via `@/src/systems/maze.js`), enemy spawning, and creates stair zones for floor-to-floor teleportation

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
       |    -> src/systems/maze.js       (room interior variety: maze walls + staggered columns)
       |    -> src/systems/enemy.js      (enemy spawning + LOS + AI state machine + cross-room navContext)
       |    -> src/systems/pathfinding.js (BFS room graph + doorway routing for enemy cross-room movement)
       |    -> src/systems/scaling.js    (run-based enemy difficulty scaling)
       |    -> src/systems/combat.js     (player/enemy health + damage + invulnerability)
       |    -> src/systems/shooting.js   (bullet velocity + fire rate + range expiry + shotgun spread)
       |    -> src/systems/weapons.js   (weapon types + 2-slot inventory + switching + effective stats)
       |    -> src/systems/battery.js    (battery drain + cone scaling + flicker + recharge)
       |    -> src/systems/items.js      (item type definitions + room item spawning)
       |    -> src/systems/inventory.js  (inventory state: batteries + treasure value + capacity)
       |    -> src/systems/doors.js      (door state management + toggle + proximity)
       |    -> src/systems/lightswitch.js (switch state + toggle + lit room detection)
       |    -> src/systems/hiding.js     (hiding state + enter/exit + nearest hideable)
       |    -> src/systems/exploration.js (exploration state + minimap data computation)
       |    -> src/systems/startroom.js  (crack points for room 0 doorway visual)
       |    -> src/systems/locations.js  (location definitions, room 0 layout/colors, alternate exit spawning)
       |    -> src/systems/shop.js       (getUpgradeValue for stat + weapon initialization)
       |    -> src/systems/lore.js        (lore note spawning per room)
       |    -> src/systems/persistence.js (saveGame after runCount increment)
       |    -> src/systems/random.js     (shared seeded PRNG)
       |
       -> src/scenes/ShopScene.js (between-run upgrade shop + location selector + lore journal)
       |    -> src/systems/shop.js       (upgrade defs, pricing, purchase logic, state)
       |    -> src/systems/locations.js  (location name lookup for display)
       |    -> src/systems/lore.js       (journal entries + pagination for lore review overlay)
       |    -> src/systems/persistence.js (saveGame at each mutation point)
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
- The player sprite uses `__DEFAULT` texture (Phaser built-in fallback) and is set invisible -- the actual player visual is drawn via a Graphics object (`playerGraphics`) so it can rotate with the aim direction
- Camera follows the player with lerp 0.1 for smooth tracking, bounded to the full level extent (all rooms)
- Mouse coordinates must use `pointer.worldX`/`worldY` (not `pointer.x`/`pointer.y`) because the camera moves with the player. However, Phaser 3 only updates these cached properties on mouse events -- they go stale when the camera scrolls without mouse movement (e.g., WASD movement with a stationary mouse). `GameScene.update()` calls `pointer.updateWorldPoint(this.cameras.main)` at the top of every frame to keep world coordinates current. Any new code reading `pointer.worldX`/`worldY` in the frame loop can rely on this, but code outside the frame loop (e.g., event callbacks) should call `updateWorldPoint()` itself if camera position may have changed since the last mouse event
- Floors are separated by 10000px in world-space Y (`FLOOR_Y_OFFSET` from `@/src/systems/stairs.js`). This gap is large enough that raycasting, physics, and enemy AI naturally cannot interact across floors without explicit teleportation. Each room object carries a `floor` field (integer) indicating which floor it belongs to. The minimap uses `getFloorBounds()` and the `floorFilter` parameter of `getMinimapData()` to display only the current floor's visited rooms
- The wall segment array (`wallSegments`) is the shared data structure consumed by the visibility system (flashlight raycasting), the enemy system (line-of-sight checks), and the door system (closed doors add/remove segments dynamically). Sources that contribute static segments at level creation are: room walls (`room.js`), light-blocking furniture (`furniture.js`, only items with `blocksLight: true`), and maze internal walls/columns (`maze.js`). Non-blocking furniture (types with `blocksLight: false`, e.g., table, desk, bed, vent) does NOT contribute segments. Any new occluder type must produce segments in `{x1,y1,x2,y2}` format to participate in all three systems
- Light switches and the hiding system do not produce wall segments. Switches are small interactable objects placed near walls that interact with the darkness system by drawing white rectangles into the BitmapMask (same mask the flashlight uses) and with the enemy system by providing lit room IDs that freeze/despawn enemies. Hiding operates on existing furniture objects (those with `canHide: true`) and affects enemy detection via the `playerHidden` flag on `updateEnemyAI()`

Created and maintained by Nori.
