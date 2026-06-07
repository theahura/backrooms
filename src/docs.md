# Noridoc: src

Path: @/src

### Overview
- Contains all game source code, organized into scenes (Phaser integration) and systems (pure game logic)
- Entry point is `@/src/main.js`, which creates the Phaser.Game instance, loads saved state from localStorage, registers scenes, and installs browser lifecycle listeners for save safety nets

### How it fits into the larger codebase
- `@/index.html` loads `@/src/main.js` as an ES module via `<script type="module">`
- `@/src/main.js` wires Phaser config (resolution, physics, renderer) and registers both scene classes (GameScene, ShopScene) with the engine
- `@/src/scenes/` contains Phaser Scene subclasses: `GameScene` for gameplay and `ShopScene` for the between-run upgrade shop
- `@/src/systems/` contains pure functions that scenes call for game math (movement, visibility, room geometry, furniture placement, enemy spawning/AI, combat/health, shooting/bullets, battery/flashlight drain, item spawning, inventory management, shop/upgrade logic, door state management, light switch state management, hiding state management, exploration/minimap tracking, and localStorage persistence)
- The architecture enforces a one-way dependency: scenes import from systems, but systems never import from scenes or Phaser. Systems may import from each other (e.g., `enemy.js` imports `raySegmentIntersection` from `visibility.js`)

### Core Implementation
- **Game initialization** (`@/src/main.js`): creates a `Phaser.Game` with 1024x768 resolution, Arcade physics (zero gravity for top-down), and registers GameScene and ShopScene. GameScene is listed first, so it is the initial scene on game launch. Immediately after creating the game, `main.js` calls `loadGame()` from `@/src/systems/persistence.js` and, if a valid save exists, populates `game.registry` with the saved `shopState` and `runCount`. This happens before any scene's `init()` runs, so scenes always see persisted state in the registry. `main.js` also installs two browser lifecycle listeners (`visibilitychange` with `hidden` check, and `beforeunload`) that flush the current registry state to localStorage via `saveGame()` as safety nets for unexpected tab closures
- **Scene flow**: the game alternates between GameScene (gameplay) and ShopScene (upgrade shop). On exit or death, GameScene transitions to ShopScene, passing `treasureEarned`. On "Enter Backrooms", ShopScene transitions to GameScene. Cross-scene state (shop upgrades, gold, run counter) flows through `game.registry` in memory and is backed by localStorage via `@/src/systems/persistence.js` for cross-session persistence. Scenes call `saveGame()` at every point where they mutate registry state (e.g., after adding gold, after purchasing upgrades, after incrementing runCount), and `main.js` adds lifecycle listeners as safety nets
- **Frame loop**: Phaser calls `GameScene.update()` every frame, which reads input, checks hiding exit on movement, computes velocity via the movement system (disabled while hiding), ticks combat/fire/battery state, processes shooting input (disabled while hiding), resolves E-key interaction (nearest door, switch, or hideable furniture by distance), checks bullet expiry, runs enemy AI updates (with lit-room freezing and hiding-based detection suppression), updates exploration state (tracking which rooms the player has visited), redraws the player/doors/switches/HUD/minimap (including inventory counts, hiding visual state, and fog-of-war room reveal), and recomputes the flashlight/darkness overlay (including lit rooms). The update loop early-returns if the player is dead or a day-ending transition is in progress
- **Level generation**: at scene creation, `GameScene` calls `generateLevel()` with a per-run seed (derived from `runCount` in registry) which produces a set of connected rooms with doorways. The scene then iterates over all rooms for rendering, physics setup, furniture placement, and enemy spawning

```
index.html
  -> src/main.js (Phaser.Game config, registers both scenes)
       -> src/scenes/GameScene.js (gameplay: create + update loop)
       |    -> src/systems/level.js      (multi-room level generation)
       |    -> src/systems/movement.js   (velocity math)
       |    -> src/systems/visibility.js (raycasting + raySegmentIntersection)
       |    -> src/systems/room.js       (wall segments with door support)
       |    -> src/systems/furniture.js  (obstacle segments + placement)
       |    -> src/systems/enemy.js      (enemy spawning + LOS + AI state machine)
       |    -> src/systems/combat.js     (player/enemy health + damage + invulnerability)
       |    -> src/systems/shooting.js   (bullet velocity + fire rate + range expiry)
       |    -> src/systems/battery.js    (battery drain + cone scaling + flicker + recharge)
       |    -> src/systems/items.js      (item type definitions + room item spawning)
       |    -> src/systems/inventory.js  (inventory state: batteries + treasure value)
       |    -> src/systems/doors.js      (door state management + toggle + proximity)
       |    -> src/systems/lightswitch.js (switch state + toggle + lit room detection)
       |    -> src/systems/hiding.js     (hiding state + enter/exit + nearest hideable)
       |    -> src/systems/exploration.js (exploration state + minimap data computation)
       |    -> src/systems/shop.js       (getUpgradeValue for stat initialization)
       |    -> src/systems/persistence.js (saveGame after runCount increment)
       |    -> src/systems/random.js     (shared seeded PRNG)
       |
       -> src/scenes/ShopScene.js (between-run upgrade shop)
       |    -> src/systems/shop.js       (upgrade defs, pricing, purchase logic, state)
       |    -> src/systems/persistence.js (saveGame at each mutation point)
       |
       -> src/systems/persistence.js  (loadGame on boot, saveGame on lifecycle events)

  game.registry (cross-scene in-memory state, backed by localStorage):
    shopState  -> { gold, upgrades: { battery, flashlight, health, speed } }
    runCount   -> incrementing integer used as level seed

  localStorage (cross-session persistence via persistence.js):
    backrooms_save -> { version, shopState, runCount }
```

### Things to Know
- The player sprite uses `__DEFAULT` texture (Phaser built-in fallback) and is set invisible -- the actual player visual is drawn via a Graphics object (`playerGraphics`) so it can rotate with the aim direction
- Camera follows the player with lerp 0.1 for smooth tracking, bounded to the full level extent (all rooms)
- Mouse coordinates must use `pointer.worldX`/`worldY` (not `pointer.x`/`pointer.y`) because the camera moves with the player. However, Phaser 3 only updates these cached properties on mouse events -- they go stale when the camera scrolls without mouse movement (e.g., WASD movement with a stationary mouse). `GameScene.update()` calls `pointer.updateWorldPoint(this.cameras.main)` at the top of every frame to keep world coordinates current. Any new code reading `pointer.worldX`/`worldY` in the frame loop can rely on this, but code outside the frame loop (e.g., event callbacks) should call `updateWorldPoint()` itself if camera position may have changed since the last mouse event
- The wall segment array (`wallSegments`) is the shared data structure consumed by the visibility system (flashlight raycasting), the enemy system (line-of-sight checks), and the door system (closed doors add/remove segments dynamically). Any new occluder type must produce segments in this format to participate in all three systems
- Light switches and the hiding system do not produce wall segments. Switches are small interactable objects placed near walls that interact with the darkness system by drawing white rectangles into the BitmapMask (same mask the flashlight uses) and with the enemy system by providing lit room IDs that freeze/despawn enemies. Hiding operates on existing furniture objects (those with `canHide: true`) and affects enemy detection via the `playerHidden` flag on `updateEnemyAI()`

Created and maintained by Nori.
