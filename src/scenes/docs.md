# Noridoc: scenes

Path: @/src/scenes

### Overview
- Phaser Scene subclasses that wire pure game systems to Phaser's rendering, physics, and input APIs
- Contains two scenes: `GameScene` (gameplay: movement, flashlight/darkness, enemy AI, combat, shooting, battery drain, item collection, exit condition, HUD) and `ShopScene` (between-run upgrade shop: displays gold balance, upgrade categories with buy buttons, and "Enter Backrooms" button)
- The two scenes alternate in a loop: GameScene -> ShopScene (on exit or death) -> GameScene (on "Enter Backrooms")

### How it fits into the larger codebase
- `@/src/main.js` registers scene classes with the Phaser.Game instance; GameScene is listed first (initial scene)
- Scenes import pure functions from `@/src/systems/` for game math and handle all Phaser-specific concerns: sprite creation, physics bodies, input binding, camera, collision callbacks, and Graphics drawing
- Scenes are the only place in the codebase that depends on Phaser -- this boundary is intentional to keep game logic testable
- `GameScene` reads upgrade levels from `game.registry` in its `init()` method, using `getUpgradeValue()` from `@/src/systems/shop.js` to compute upgrade-modified stats (max HP, max battery charge, flashlight cone angle, movement speed). These values are passed to `createCombatState()` and `createBatteryState()` in `create()`, and used directly for movement and flashlight calculations
- `ShopScene` reads/writes `shopState` from `game.registry`, using pure functions from `@/src/systems/shop.js` for all purchase logic. It receives `treasureEarned` as scene data from GameScene and converts it to gold via `addGold()`
- Data flows between scenes via two mechanisms: `game.registry` for persistent state (shopState, runCount) and scene `init(data)` for per-transition data (treasureEarned)

### Core Implementation
- **GameScene lifecycle**: `init()` reads upgrade state from registry and computes per-run stats, `create()` sets up the level and all game objects, `update()` runs every frame
- **GameScene.init()**: reads `shopState` from `game.registry` (or uses zeroed defaults on first run), calls `getUpgradeValue()` for each upgrade to set `this.maxCharge`, `this.flashlightAngle`, `this.maxHp`, and `this.playerSpeed`. Also reads and increments `runCount` in the registry to derive a unique level seed for this run
- **create() setup sequence**: initializes level geometry, player, enemies, item textures, items, bullets, exit zone, input, camera, darkness overlay, and HUD. Combat state is initialized with `createCombatState(this.maxHp)`, battery state with `createBatteryState(this.maxCharge)`, and inventory state with `createInventoryState()`. Notable setup details:
  - `createEnemies()` adds a `health` field (from `ENEMY_MAX_HP`) to each enemy state object and wires a player-enemy overlap callback (`onEnemyContact`) for contact damage
  - `createItemTextures()` generates a Phaser texture for each item type (rectangles for coins/batteries, triangle for gems), keyed as `item_{type}`
  - `createItems()` creates a static physics group, calls `generateRoomItems()` per room, and places item sprites at depth 5 (below darkness). Wires a player-item overlap callback (`onItemPickup`) for auto-collection
  - `createBullets()` creates a pooled physics group (`maxSize: 20`), generates a bullet texture, and wires bullet-wall/furniture colliders and bullet-enemy overlap
  - `createExitZone()` places a 64x64 physics zone in the top-left corner of room 0 with a green visual indicator, wiring a player overlap callback (`onDayComplete`) for the day-cycle win condition
  - `createHUD()` creates a Graphics object with `setScrollFactor(0)` at depth 1000 so health and battery bars stay fixed on screen, plus text elements for battery count and treasure value
- **update() frame loop**: early-returns if player is dead or `this.dayEnding` is true (exit transition in progress). Then: reads WASD key state -> `calculateVelocity()` -> sets player velocity -> computes aim angle from mouse -> ticks combat cooldown (`updateCombat`), battery state (`updateBattery`), and fire cooldown (`updateFireCooldown`) -> checks for left-click + `canFire()` to fire bullets -> `updateBullets()` expires out-of-range bullets -> `updateEnemies(delta)` runs AI -> redraws player (with invulnerability visual feedback) -> recomputes darkness (using battery-derived cone angle and flicker state) -> redraws HUD (health bar + battery bar + battery count + treasure value). Right-click input triggers `onUseBattery()` outside the frame loop via a `pointerdown` event listener. Item pickup happens via Phaser overlap callbacks (auto-collected on contact)
- **Enemy integration pattern**: `GameScene` maintains a parallel `enemyStates` array alongside the Phaser physics sprites in `enemyGroup`. Each frame, `updateEnemies()` syncs sprite positions into the state objects, calls the pure `updateEnemyAI()` function, copies the returned state back, and applies velocity to the sprite. This keeps the AI logic testable in `@/src/systems/enemy.js` while letting Phaser handle physics resolution
- **ShopScene lifecycle**: `init(data)` receives `treasureEarned` from GameScene, reads existing `shopState` from registry (or creates fresh state on first visit), adds the treasure as gold via `addGold()`, and writes back to registry. `create()` builds the UI: title, treasure earned display, gold balance, upgrade rows, and "Enter Backrooms" button. Each upgrade row shows name, description, level dots (filled/empty circles), next cost, and a buy button. Purchases call `purchaseUpgrade()` and refresh the display. The "Enter Backrooms" button calls `this.scene.start('GameScene')` to transition back to gameplay

### Things to Know
- **Depth layering order** controls what is visible through the darkness:

  | Layer | Depth | Purpose |
  |-------|-------|---------|
  | item sprites | 5 | Collectibles hidden by darkness (only visible in flashlight) |
  | exit zone graphics | 10 | Green exit indicator visible under darkness |
  | furniture graphics | 50 | Furniture rendered below enemies |
  | enemy sprites | 60 | Enemies hidden by darkness (below mask) |
  | `lightGraphics` | 99 | Faint yellow tint drawn under the flashlight cone |
  | `darkGraphics` | 100 | Black rectangle covering the entire level (the darkness) |
  | bullet sprites | 150 | Bullets visible above darkness but below player |
  | `playerGraphics` | 200 | Player always visible (above darkness) |
  | `hudGraphics` + HUD text | 1000 | Health bar, battery bar, battery count, treasure value (above everything) |

  Items at depth 5, enemies at depth 60, and furniture at depth 50 are all hidden by the darkness overlay and only revealed by the flashlight. Bullets at depth 150 are always visible (above darkness), giving visual feedback even when firing into dark areas. The HUD uses `setScrollFactor(0)` so it does not move with the camera
- **Darkness system architecture**: the BitmapMask has `invertAlpha = true`, so white pixels in `maskGraphics` punch transparent holes in `darkGraphics`, revealing the room beneath the flashlight cone. The `updateDarkness(time)` method now calls `getFlashlightConeAngle()` each frame to get a battery-adjusted cone angle and `shouldFlicker()` to determine if the flashlight should momentarily go dark. When the cone angle is zero (battery depleted) or flickering is active, the method returns early without drawing the flashlight polygon, leaving the scene in total darkness
- **Enemy physics uses a dynamic group** (unlike walls and furniture which are static groups). Enemies collide with walls, furniture, and each other. Player-enemy interaction uses `overlap` (not `collider`), triggering `onEnemyContact()` which applies contact damage, camera shake/flash, and checks for player death
- **Bullet physics group** uses pooling (`maxSize: 20`). Bullet-wall/furniture uses `collider` (instant deactivation). Bullet-enemy uses `overlap` -- on hit, the bullet is deactivated and the enemy takes `BULLET_DAMAGE`. When enemy health reaches 0, the enemy is deactivated and removed from `enemyStates[]`. Bullets store their origin position via `setData()` for range-expiry checks each frame
- **Player death flow**: when `combatState.isDead` becomes true, `onPlayerDeath()` stops the player body, disables physics, triggers a 500ms camera fade-out, and transitions to ShopScene with `{ treasureEarned: 0 }`. The death penalty is losing all treasure collected that run -- gold already in the shop balance is not affected. The `update()` loop early-returns while dead, preventing further input processing
- **Day-complete flow (exit)**: when the player overlaps the exit zone, `onDayComplete()` sets `this.dayEnding = true`, stops the player, triggers a 1000ms camera fade-out, and transitions to ShopScene with `{ treasureEarned: this.inventoryState.treasureValue }`. The player keeps all collected treasure. The `update()` loop early-returns while `dayEnding` is true, freezing game state during the transition
- **Visual feedback for combat, battery, and inventory**: taking damage triggers `cameras.main.shake()` and `cameras.main.flash()`. During invulnerability, the player graphic switches to a red tint with 50% alpha (`drawPlayer()` checks `isInvulnerable()`). The HUD health bar turns red when below 30% HP. The battery bar sits below the health bar and transitions from yellow to orange (at 50%) to red (at 25%). Below the bars, text elements display the current battery item count (`BAT xN`) and accumulated treasure value (`$N`)
- **Multi-room physics with door gaps**: `createRoomPhysics()` splits each wall into physics zones that skip over door offsets. This mirrors the raycasting segments produced by `createRoomWalls()` so that physics collision and flashlight occlusion agree on where doors are
- **Right-click input**: `setupInput()` disables the browser context menu (`this.input.mouse.disableContextMenu()`) and listens for `pointerdown` events. Right-click triggers `onUseBattery()`, which calls `useBattery()` from `inventory.js` and, if successful, `rechargeBattery()` from `battery.js`. This input is guarded by `!isDead && !dayEnding` checks
- **Item pickup flow**: items are a static physics group with player overlap detection. On overlap, `onItemPickup()` updates `this.inventoryState` via `pickupItem()` and destroys the item sprite. Items store their type and value via Phaser's `setData()` on the sprite. Items do not produce wall segments -- they are collectibles, not occluders
- **Wall dual-purpose**: walls exist as both Phaser Arcade Physics static zones (for player collision) and as line segments from `createRoomWalls()` (for raycasting). Furniture follows the same pattern -- each item is both a physics zone and a set of raycasting segments. Enemies and items do not produce segments; enemies are dynamic actors and items are small collectibles
- **Player rendering**: the player is a Graphics object (`playerGraphics`) drawn at depth 200 (above the darkness overlay at depth 100), so the player is always visible regardless of flashlight direction
- Camera and physics bounds are computed dynamically from the level's room positions, so they adapt to however many rooms the level generator produces

Created and maintained by Nori.
