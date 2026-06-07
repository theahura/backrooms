# Noridoc: src

Path: @/src

### Overview
- Contains all game source code, organized into scenes (Phaser integration) and systems (pure game logic)
- Entry point is `@/src/main.js`, which creates the Phaser.Game instance and registers scenes

### How it fits into the larger codebase
- `@/index.html` loads `@/src/main.js` as an ES module via `<script type="module">`
- `@/src/main.js` wires Phaser config (resolution, physics, renderer) and registers both scene classes (GameScene, ShopScene) with the engine
- `@/src/scenes/` contains Phaser Scene subclasses: `GameScene` for gameplay and `ShopScene` for the between-run upgrade shop
- `@/src/systems/` contains pure functions that scenes call for game math (movement, visibility, room geometry, furniture placement, enemy spawning/AI, combat/health, shooting/bullets, battery/flashlight drain, item spawning, inventory management, shop/upgrade logic, and door state management)
- The architecture enforces a one-way dependency: scenes import from systems, but systems never import from scenes or Phaser. Systems may import from each other (e.g., `enemy.js` imports `raySegmentIntersection` from `visibility.js`)

### Core Implementation
- **Game initialization** (`@/src/main.js`): creates a `Phaser.Game` with 1024x768 resolution, Arcade physics (zero gravity for top-down), and registers GameScene and ShopScene. GameScene is listed first, so it is the initial scene on game launch
- **Scene flow**: the game alternates between GameScene (gameplay) and ShopScene (upgrade shop). On exit or death, GameScene transitions to ShopScene, passing `treasureEarned`. On "Enter Backrooms", ShopScene transitions to GameScene. Persistent state (shop upgrades, gold, run counter) flows through `game.registry`
- **Frame loop**: Phaser calls `GameScene.update()` every frame, which reads input, computes velocity via the movement system, ticks combat/fire/battery state, processes shooting input, handles E key door toggling, checks bullet expiry, runs enemy AI updates, redraws the player/doors/HUD (including inventory counts), and recomputes the flashlight/darkness overlay. The update loop early-returns if the player is dead or a day-ending transition is in progress
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
       |    -> src/systems/shop.js       (getUpgradeValue for stat initialization)
       |    -> src/systems/random.js     (shared seeded PRNG)
       |
       -> src/scenes/ShopScene.js (between-run upgrade shop)
            -> src/systems/shop.js       (upgrade defs, pricing, purchase logic, state)

  game.registry (persistent cross-scene state):
    shopState  -> { gold, upgrades: { battery, flashlight, health, speed } }
    runCount   -> incrementing integer used as level seed
```

### Things to Know
- The player sprite uses `__DEFAULT` texture (Phaser built-in fallback) and is set invisible -- the actual player visual is drawn via a Graphics object (`playerGraphics`) so it can rotate with the aim direction
- Camera follows the player with lerp 0.1 for smooth tracking, bounded to the full level extent (all rooms)
- Mouse coordinates must use `pointer.worldX`/`worldY` (not `pointer.x`/`pointer.y`) because the camera moves with the player
- The wall segment array (`wallSegments`) is the shared data structure consumed by the visibility system (flashlight raycasting), the enemy system (line-of-sight checks), and the door system (closed doors add/remove segments dynamically). Any new occluder type must produce segments in this format to participate in all three systems

Created and maintained by Nori.
