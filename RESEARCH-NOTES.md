# Research Notes

## Project Overview
Backrooms is a survival horror top-down 2D twin-stick shooter built with web technologies (HTML, JS, CSS). Inspired by the Backrooms creepypasta and the Flash game Motherload.

## Key Requirements
- Top-down 2D view with camera centered on player
- Pitch black rooms illuminated only by player's flashlight
- Twin-stick controls: WASD movement, mouse aiming, left-click shoot, right-click use items, Q/E switch weapons
- Room-based level structure with connections (doors, stairs)
- Day cycle: enter backrooms, explore, collect valuables, return before battery dies
- Shop system for upgrades between runs
- Enemy AI: zombies that chase when player is visible, wander when not

## Technology Decisions

### Game Engine: Phaser 3 (~3.90.x)
- Most mature web-based 2D game framework
- Built-in: physics (Arcade), input handling, camera system, scene management, tilemaps
- Phaser 4 (v4.0.0, released April 2026) exists but is only 2 months old with limited ecosystem maturity
- Phaser 4's mask API has changed (BitmapMask → Mask filter) with incomplete documentation — risky for the flashlight system which is core to this game
- Decision: Phaser 3 for stability, migrate later if needed

### Bundler: Vite
- Official Phaser template uses Vite
- Fast HMR, simple config, ES module native

### Language: Plain JavaScript
- Spec says "html, js, css" — YAGNI on TypeScript

### Flashlight/Visibility System: RenderTexture + BitmapMask
- Two-layer approach: dark cover overlay on top, game scene below
- RenderTexture serves as mask — draw flashlight cone shape into it each frame
- For wall occlusion: 2D raycasting visibility polygon algorithm
  - Cast rays toward wall segment endpoints + offset rays at ±0.00001 radians
  - Sort hits by angle, connect to form visibility polygon
  - Intersect with flashlight cone (two bounding angles from mouse direction)
- References: Ncase "Sight & Light" tutorial, Red Blob Games 2D Visibility
- Canvas `destination-out` compositing as alternative if Phaser masking is insufficient

### Performance Notes
- Only cast rays toward segment endpoints (O(N log N) from angle sort)
- Pre-bake radial gradient sprite instead of createRadialGradient each frame
- Half-resolution light mask if needed
- Single flashlight should have no performance issues

### Project Structure (from official Phaser template)
```
project/
├── index.html
├── package.json
├── vite.config.js
├── public/assets/
└── src/
    ├── main.js          # entry point, creates Game instance
    ├── scenes/
    │   ├── Boot.js      # minimal preload
    │   ├── Preloader.js # asset loading
    │   └── Game.js      # main gameplay
    └── objects/         # Player.js, Enemy.js, etc.
```

### Key Code Patterns
- Use `pointer.worldX`/`worldY` (not `pointer.x`/`pointer.y`) when camera follows player
- `startFollow(target, roundPixels, lerpX, lerpY)` — lerp of 0.1 for smooth camera
- Normalize velocity to prevent faster diagonal movement
- No gravity needed for top-down (gravity: { x: 0, y: 0 })

## Furniture/Obstacles Research

### Architecture Pattern
- Furniture items are rectangles that generate `{x1, y1, x2, y2}` wall segments (same format as room walls)
- These segments are concatenated into `wallSegments` — the visibility/raycasting system needs zero changes
- Physics uses the same zone + staticGroup pattern as existing walls
- Visual rendering uses Graphics.fillRect — same as room floor/walls

### Furniture System Design
- Pure function in `src/systems/furniture.js` — takes room dimensions, returns furniture placement data
- Each furniture type defined as: `{type, x, y, width, height, color, canHide}`
- `createFurnitureSegments(x, y, width, height)` returns 4 segments (identical to `createRoomWalls`)
- GameScene calls furniture system, draws visuals, adds physics zones, concats segments

### Hiding Mechanics
- Hiding spots are overlap zones (no physics collision for the hiding zone itself)
- Player overlaps + presses interact key → `player.isHidden = true`
- Enemy AI checks `isHidden` before detection (future feature)
- Simplest: any furniture with `canHide: true` creates a slightly-larger overlap zone
- For now, just mark furniture as hideable — actual hiding interaction comes with enemy AI

### Furniture Types (for initial implementation)
- Table: 80x50, dark brown, can hide under
- Shelf: 100x20, medium brown, blocks rays (tall), cannot hide
- Desk: 60x40, dark gray, can hide under
- Bookcase: 30x80, dark brown, blocks rays, cannot hide

## Multi-Room / Level Generation Research

### Algorithm Choice: Procedural Build (Growth)
- Start from a center room, pick a wall, attach a new room through a doorway, repeat
- Best fit for backrooms aesthetic — produces organically sprawling layouts
- Simpler than BSP trees or WFC for a segment-based (non-tilemap) wall system
- Grid-based placement prevents overlap: each cell in a logical grid holds at most one room

### Doorways in Segment-Based Walls
- Current `createRoomWalls()` returns 4 closed segments per room
- Doorway = **gap in wall segment**: split one segment into two shorter segments with a gap between them
- Example: top wall `{x1:0, y1:0, x2:100, y2:0}` with door at x=40-60 becomes `{x1:0, y1:0, x2:40, y2:0}` + `{x1:60, y1:0, x2:100, y2:0}`
- Gaps naturally let flashlight rays pass through doorways — correct horror behavior
- When two rooms share a wall, replace shared wall with split segments (not duplicated)

### Phaser 3 Multi-Room Considerations
- Camera: `setBounds()` to encompass full level dimensions, update dynamically if level grows
- Physics: Arcade physics uses RTree spatial index for static bodies — hundreds of wall colliders are fine
- Colliders: Use a single `staticGroup` for all walls across all rooms — RTree handles spatial partitioning
- Rendering: Phaser doesn't auto-cull non-tilemap objects; for now, render all rooms (small level). Add culling later if needed

### Level Data Structure
- Room: `{ id, gridX, gridY, x, y, width, height, doors: [{wall, position, width}] }`
- Level: array of rooms with connectivity encoded in the doors array
- `wallSegments` stays as a single flat array for raycasting — concatenate all rooms' segments
- Furniture: `generateRoomFurniture()` already accepts arbitrary room bounds; use room-specific seeds

### Generation Strategy
- Start with generating entire level at init (5-8 rooms) — simpler than on-demand
- On-demand generation (infinite levels) is a future optimization
- Seeded RNG (room seed derived from grid coordinates) for deterministic layouts

## Enemy / Zombie AI Research

### Line-of-Sight Detection
- Reuse existing `raySegmentIntersection(ray, segment)` from `src/systems/visibility.js`
- To check LOS from enemy to player: construct ray `{x: enemy.x, y: enemy.y, dx: player.x - enemy.x, dy: player.y - enemy.y}`
- Iterate all wall segments; if any hit has `0 < t < 1`, a wall is between enemy and player → LOS blocked
- Single ray per enemy per frame — very cheap
- `castClosestRay(ray, segments)` helper already exists in visibility.js but is not exported — export it for reuse

### Zombie State Machine
- Three states: **IDLE** (wander randomly), **CHASE** (pursue player), **SEARCH** (go to last known position)
- Transitions: IDLE → CHASE when LOS acquired within detection range. CHASE → SEARCH when LOS lost. SEARCH → IDLE after timeout. SEARCH → CHASE if LOS reacquired.
- Simple `switch(state)` in update — no FSM library needed for three states
- Detection range check first (cheap distance calc), then LOS check only if in range

### Enemy Movement in Phaser 3
- Velocity-based: compute angle to target, set `body.setVelocity(cos*speed, sin*speed)`
- `this.physics.moveTo(enemy, targetX, targetY, speed)` also works but must be called each frame
- Wall collision handled by Arcade physics `collider(enemies, walls)` — enemies slide along walls
- Wander: pick random direction, move at slow speed for 1-3 seconds, pause, repeat

### Phaser 3 Enemy Group Patterns
- Dynamic physics group: `this.physics.add.group()` for moving enemies
- Colliders: `collider(enemies, walls)`, `collider(enemies, furnitureGroup)`, `collider(enemies, enemies)`, `overlap(player, enemies, damageCallback)`
- Use `generateTexture()` to create enemy texture once, then use real sprites — avoids per-frame Graphics redraw
- Alternative: invisible physics sprite + Graphics object (matches existing player pattern)

### Enemy Spawning in Procedural Rooms
- Follow furniture.js pattern: `generateRoomEnemies(roomX, roomY, ...)` pure function
- Skip room 0 (player start room)
- Use seeded PRNG with different seed offset (e.g., `room.seed + 10000`) to avoid correlation with furniture
- Spawn 1-2 enemies per room, placed avoiding furniture and doorway zones
- Inner bounds same as furniture: room bounds minus wall thickness minus margin

### Rendering Considerations
- Enemy graphics must be below darkness layer (depth < 100) so enemies are hidden in darkness
- Enemies should only be visible when illuminated by the player's flashlight — this is automatically handled by the mask system if enemies render at depth < 100
- Player renders at depth 200 (above darkness) — enemies should NOT render above darkness

### Known Limitations for MVP
- No pathfinding — enemies chase in a direct line, may get stuck on furniture corners (thematically appropriate for zombies)
- No damage/health system yet — will need at least basic player HP and damage on contact
- No enemy death/combat — shooting mechanics are a separate future feature

## Flashlight Battery & Day/Exit Cycle Research

### Battery Drain Design Parameters
- **Drain rate**: 90 seconds full depletion is the sweet spot — fast enough to create tension, slow enough to allow meaningful exploration (F.E.A.R. uses 20s which is too aggressive, Blood II uses 100s)
- **Visual degradation (layered)**:
  - At 50% battery: cone angle shrinks to ~75% of base
  - At 25%: cone angle at ~50%, intermittent flickering begins
  - At 10%: aggressive flickering, significant cone reduction
  - At 0%: no flashlight polygon at all — total darkness
- **Battery indicator**: Segmented HUD bar (same pattern as health bar) + visual cone degradation
- **Death behavior**: Battery depletion = total darkness = effectively a death sentence (can still move but can't see enemies)

### Architecture: Pure Module Pattern
- Follow `combat.js` exactly: constants, state factory, update function, fraction getter
- `src/systems/battery.js` — pure functions: `createBatteryState`, `updateBattery`, `getBatteryFraction`, `getFlashlightConeAngle`
- State: `{ charge, maxCharge, isDepleted }`
- `updateBattery(state, delta)` — immutable state transition, drains charge based on delta time
- `getFlashlightConeAngle(state, baseConeAngle)` — scales cone angle based on battery fraction
- Flickering: `shouldFlicker(state, time)` — returns boolean based on battery level and time for pseudo-random flicker effect

### Exit Zone Design
- Place exit zone in room 0 (player spawn room) — a specific area the player must return to
- Use Phaser `this.add.zone()` + `this.physics.add.existing(zone, true)` + `this.physics.add.overlap(player, zone, callback)`
- Visual indicator: draw a green/glowing rectangle on the floor to mark the exit
- On overlap: end the day successfully (camera fade out, scene restart)
- Exit should be in a corner of room 0, away from player spawn at center

### GameScene Integration Points
- `FLASHLIGHT_CONE_ANGLE` (line 12): stays as base/max value
- `create()` (line 21): add `this.batteryState = createBatteryState()`
- `updateDarkness()` (line 418-423): replace `FLASHLIGHT_CONE_ANGLE` with dynamic value from battery state
- `drawHUD()` (line 346-364): add battery bar below health bar (y=42)
- `update()` (line 451): add `this.batteryState = updateBattery(this.batteryState, delta)`
- `createPlayer()` (line 150): nearby — add exit zone creation in room 0

### Flickering Implementation
- Use time-based pseudo-random pattern (not Math.random — must be deterministic for tests)
- At <25% battery: toggle flashlight visibility at intervals (flicker)
- Pattern: `sin(time * frequency) > threshold` where frequency increases as battery drops
- During flicker "off" frames: skip drawing the flashlight polygon entirely

## Combat System Research

### Architecture: Two New Pure Modules
- `src/systems/combat.js` — player health, damage cooldowns, enemy health, damage application
- `src/systems/shooting.js` — bullet velocity calculation, fire rate cooldown logic
- Both are pure functions taking/returning plain objects — testable without Phaser
- GameScene wires these to Phaser physics groups, sprites, and input

### Player Health System
- `PLAYER_MAX_HP = 100`, `ENEMY_CONTACT_DAMAGE = 20`, `DAMAGE_COOLDOWN_MS = 1000`
- State object: `{ hp, maxHp, damageCooldown, isDead }`
- `applyDamage(state, amount)` — returns unchanged state if cooldown > 0 or isDead, otherwise reduces HP and sets cooldown
- `updateCombat(state, delta)` — decrements cooldown
- Replaces the existing `this.contactCooldown` field on GameScene
- Visual feedback: camera flash (red, 150ms) + shake on hit; player Graphics alpha/color flicker during cooldown

### Enemy Health System
- `ENEMY_MAX_HP = 50`, `BULLET_DAMAGE = 25` (two shots to kill)
- Add `health` field to enemy state objects in `enemyStates` array
- When enemy health reaches 0: set sprite inactive/invisible, remove from `enemyStates`
- Pure function `applyEnemyDamage(health, damage)` returns new health

### Shooting System
- Projectile-based (not hitscan) — bullets are visible physics sprites in the flashlight
- Phaser physics group (`this.bulletGroup`) with object pooling via `getFirstDead(false)`
- `BULLET_SPEED = 500`, `FIRE_RATE_MS = 200`, `BULLET_MAX_RANGE = 600`
- `calculateBulletVelocity(originX, originY, targetX, targetY, speed)` — pure function returning `{ vx, vy }`
- Fire on left-click (pointer down), respecting fire rate cooldown
- Bullet lifespan: max distance from origin (600px), deactivate when exceeded
- Bullet texture: small yellow circle (6px diameter) via `generateTexture`

### Collision Setup
- `physics.add.collider(bulletGroup, walls, onBulletHitWall)` — deactivate bullet
- `physics.add.overlap(bulletGroup, enemyGroup, onBulletHitEnemy)` — damage enemy, deactivate bullet
- Bullet depth: 150 (above darkness at 100, visible in lit areas; below player at 200)
- Alternatively: depth 60 (same as enemies, hidden in darkness) — more thematic, bullets only visible in flashlight

### HUD Health Bar
- `Phaser.GameObjects.Graphics` with `setScrollFactor(0)` and `setDepth(1000)`
- Positioned in screen coordinates (20, 20), width 200, height 16
- Background dark gray, fill green (>30% HP) or red (≤30%), white border
- Redrawn each frame from `getHealthFraction(state)`

### Death/Game Over
- On player death: fade camera to black (500ms), then `scene.restart()`
- Simple restart for now — no game over screen (future feature)

### Phaser Integration Points
- Existing `onEnemyContact` callback (line 209) becomes the damage integration point
- Existing `contactCooldown` (line 26, 341) replaced by `playerCombatState.damageCooldown`
- New `this.input.on('pointerdown', ...)` for shooting
- New `this.bulletGroup` physics group in `create()`
- Bullets need `body.reset(x, y)`, `setActive(true)`, `setVisible(true)` when firing from pool
- Fire rate cooldown tracked as `this.fireCooldown` on scene, decremented in `update()`

### Rendering Depth Decisions
- Bullets at depth 150 — visible above darkness, player can see their own shots
- HUD at depth 1000 — always on top
- Everything else unchanged: enemies 60, darkness 100, light 99, player 200

## Items & Inventory System Research

### Item Spawning Pattern
- Follow enemy.js pattern exactly: `generateRoomItems(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, furnitureItems, roomId)`
- Use `mulberry32(seed + 20000)` — furniture uses +0, enemies use +10000, items use +20000
- Skip room 0 (starting room) — or place fewer items there
- 40px margin from walls, AABB overlap check against furniture rects
- Retry loop: `count * 20` max attempts per item placement
- Return array of `{ x, y, type, value }` plain objects

### Item Types & Value Tiers (Motherload-inspired exponential curve)
- **Battery**: restores 30% flashlight charge when used. Spawns 0-1 per room.
- **Copper Coin**: value 10, common. Bronze/copper color.
- **Silver Coin**: value 50, uncommon. Silver/white color.
- **Gold Coin**: value 200, rare. Gold color.
- **Gem**: value 1000, very rare (maybe 1 per level). Cyan/blue color.
- Total 2-5 items per room (including battery chance), weighted by rarity

### Inventory Design (Simple for MVP)
- State: `{ batteries: number, treasureValue: number }`
- Auto-pickup on overlap — items destroyed on contact
- No capacity limit for now (backpack upgrade is a future shop feature)
- Batteries are a count; right-click uses one to recharge flashlight
- Treasure value is a running total carried to the shop after exiting

### Phaser 3 Integration
- Items use `this.physics.add.staticGroup()` — static bodies skip velocity calculations
- Overlap: `this.physics.add.overlap(player, itemGroup, onItemPickup, null, this)`
- Item textures via `generateTexture` (small colored circles/rectangles, 8-12px)
- Items render at depth 5 (below darkness at 100) — only visible in flashlight
- On pickup: `item.destroy()` removes from group and physics

### Right-Click Input (Battery Use)
- `this.input.mouse.disableContextMenu()` in create()
- Check `pointer.rightButtonDown()` in pointerdown event or poll in update
- On right-click: if batteries > 0, decrement count, call `rechargeBattery(state, amount)`

### Battery Recharge Function (New Addition to battery.js)
- Need new export: `rechargeBattery(state, amount)` → `{ ...state, charge: Math.min(state.charge + amount, state.maxCharge), isDepleted: false }`
- Amount: 30 (30% of BATTERY_MAX=100)

### HUD Updates
- Add battery count icon + number below existing bars (e.g., battery icon + "x3")
- Add treasure value display (coin icon + "$1,250")
- Use `this.add.text()` with `setScrollFactor(0).setDepth(1000)` for text elements

### Architecture: Two New Pure Modules
- `src/systems/items.js` — item type definitions, room item generation (pure functions)
- `src/systems/inventory.js` — inventory state creation, item pickup logic, battery use (pure functions)
- `rechargeBattery` added to existing `src/systems/battery.js`

## Shop/Upgrade System Research

### Scene Flow Design
- GameScene → ShopScene → GameScene (no separate summary scene — shop screen shows treasure earned)
- Use `this.scene.start('ShopScene', data)` to pass treasure value on exit
- Use `this.game.registry` for persistent upgrade state across scene transitions
- Registry persists for entire game lifetime, never cleared by scene transitions
- Data arrives in receiving scene's `init(data)` method (runs before `create()`)
- On death: go to ShopScene with `treasureEarned: 0` (lose all treasure from that run — items stay in backrooms)

### Scene Data Passing Pattern
- `scene.start('TargetScene', { key: value })` — data received in both `init(data)` and `create(data)`
- `this.registry.set(key, value)` / `this.registry.get(key)` — game-wide persistent store
- Registry for persistent state (gold balance, purchased upgrades), start() data for per-transition context (treasure earned this run)
- Gotcha: `scene.restart()` doesn't re-run constructor — must reset instance variables in `init()`
- Gotcha: Scene operations are queued, execute at next Scene Manager update, not immediately

### Upgrade Categories & Pricing
- Inspired by Motherload's surface shop: player sells loot, buys from categories
- Motherload uses shared tier pricing across all categories (~3-5x multiplier per tier)
- Pricing tiers: 100, 300, 800, 2000 (roughly 3x multiplier, 4 tiers per stat)
- Keep total tiers to 3-4 per stat to preserve tension — horror game should never let player feel fully safe

### Upgradeable Stats
| Stat | Base Value | Per-Tier Boost | Max Tiers | File |
|---|---|---|---|---|
| Battery capacity | 100 (90s) | +30 per tier | 3 | battery.js |
| Flashlight beam width | PI/4 (45°) | +PI/12 per tier | 3 | GameScene.js |
| Max health | 100 | +25 per tier | 3 | combat.js |
| Movement speed | 200 | +20 per tier | 3 | GameScene.js |

### Architecture: Two New Modules
- `src/systems/shop.js` — pure functions: upgrade definitions, pricing, purchase validation, state management
  - `UPGRADES` array: `{ id, name, description, maxLevel, costs: [100, 300, 800], effect: { stat, perLevel } }`
  - `createShopState()` returns `{ gold: 0, upgrades: { battery: 0, flashlight: 0, health: 0, speed: 0 } }`
  - `canPurchase(state, upgradeId)` — checks gold and max level
  - `purchaseUpgrade(state, upgradeId)` — returns updated state (deducts gold, increments level)
  - `getUpgradeValue(upgradeId, level)` — returns the actual stat value for a given upgrade level
- `src/scenes/ShopScene.js` — Phaser scene for shop UI
  - Text-based UI with interactive buttons (Phaser's `setInteractive` + pointer events)
  - Shows treasure earned this run, total gold balance
  - Lists upgrades with current level, cost of next level, buy button
  - "Enter Backrooms" button to start next run
  - Dark theme consistent with horror aesthetic

### Phaser UI Patterns
- Buttons: `this.add.text(x, y, 'Buy', style).setInteractive({ useHandCursor: true }).on('pointerdown', cb)`
- Pointer events: `pointerover`, `pointerout`, `pointerdown`, `pointerup` for button states
- No need for RexUI plugin — simple text buttons suffice for basic shop

### GameScene Modifications
- `init(data)` — read upgrades from registry, apply to state creation
- `onDayComplete()` — `this.scene.start('ShopScene', { treasureEarned: this.inventoryState.treasureValue })`
- `onPlayerDeath()` — `this.scene.start('ShopScene', { treasureEarned: 0 })`
- State creation functions need to accept override values from upgrades
- `createBatteryState()` already has `maxCharge` field — pass upgraded value
- `createCombatState()` needs to accept `maxHp` parameter
- Level seed should randomize between runs (use `Date.now()` or incrementing counter)

### Modification to Existing Pure Functions
- `combat.js`: `createCombatState(maxHp?)` — optional param, defaults to PLAYER_MAX_HP
- `battery.js`: `createBatteryState(maxCharge?)` — optional param, defaults to BATTERY_MAX
- GameScene: read `speed` and `flashlightAngle` from upgrade values instead of constants

## Closable Doors Research

### Architecture: Pure Module `doors.js`
- `src/systems/doors.js` — pure functions for door state management
- State: array of `{ id, roomId, wall, offset, width, isClosed, segment }` objects
- `segment` is the `{ x1, y1, x2, y2 }` wall segment that blocks light/LOS when door is closed
- `createDoorState(room, door, doorId)` — computes segment coordinates from room position + door wall/offset
- `toggleDoor(doorStates, doorId)` — returns new array with toggled door
- `getClosedDoorSegments(doorStates)` — returns all segments for closed doors
- `findNearestDoor(doorStates, playerX, playerY, maxRange)` — finds closest interactable door

### Door Segment Coordinates
- North door: `{ x1: room.x + offset, y1: room.y, x2: room.x + offset + width, y2: room.y }`
- South door: `{ x1: room.x + offset + width, y1: room.y + height, x2: room.x + offset, y2: room.y + height }`
- East door: `{ x1: room.x + width, y1: room.y + offset, x2: room.x + width, y2: room.y + offset + width }`
- West door: `{ x1: room.x, y1: room.y + offset + width, x2: room.x, y2: room.y + offset }`
- South/west segments reversed to match `reverseSegments()` winding in room.js

### Level Generation Changes
- Not all doors get closable doors — use seeded PRNG to assign ~50% as closable
- `assignClosableDoors(rooms, seed)` returns array of door state objects
- Skip first door of room 0 to ensure player can always reach backrooms
- Paired doors: each door connection appears in both rooms' door arrays, but we only create ONE physical door entity. Deduplicate by processing only when `room.id < door.targetRoomId`

### Physics Integration
- Separate `this.doorGroup = this.physics.add.staticGroup()` for door physics bodies
- `body.enable = true/false` toggles collision — works for static bodies per Phaser source
- Colliders: `collider(player, doorGroup)`, `collider(enemyGroup, doorGroup)`, `collider(bulletGroup, doorGroup)`
- RTree: disabled bodies stay in RTree but are skipped during collision resolution (negligible overhead)

### Visibility / LOS Integration
- `wallSegments` is already mutable (furniture pushes into it)
- On door close: push segment to `this.wallSegments`
- On door open: splice segment out of `this.wallSegments`
- Both `getFlashlightPolygon` and `updateEnemyAI` receive `this.wallSegments` by reference each frame — changes take effect immediately

### Player Interaction
- Press E to toggle nearest door within 80px range
- `findNearestDoor()` returns the closest door entity to player position
- Door center computed from room position + wall + offset + width/2
- Visual prompt: "Press E" text shown when in range (HUD depth 1000)

### Visual Rendering
- Doors need their own Graphics object (can't selectively clear room Graphics)
- Closed door: filled rectangle at door position with door color (0x664422 — dark wood)
- Open door: no rectangle drawn (gap visible as normal)
- Redraw door graphics each frame based on state

## Light Switch System Research

### Architecture: Pure Module `lightswitch.js`
- `src/systems/lightswitch.js` — pure functions for light switch state management
- Follow doors.js pattern: named exports, constants, state factory, toggle, query functions
- State: array of `{ id, roomId, x, y, isOn }` objects
- `createSwitchStates(rooms, seed)` — determines which rooms get switches, places them on walls
- `toggleSwitch(switchStates, switchId)` — returns new array with toggled switch (immutable)
- `findNearestSwitch(switchStates, px, py, maxRange)` — finds closest interactable switch
- `getSwitchPosition(room, wall, offset)` — computes world position from room + wall placement

### Room Eligibility
- Room 0 (spawn room) should NOT have a light switch — it's the safe starting area
- Not all rooms get switches — use seeded PRNG (~40-50% chance) for variety
- Seed offset: +40000 (furniture: +0, enemies: +10000, items: +20000, doors: +30000, switches: +40000)

### Switch Placement
- Place on room walls, near midpoint — similar to real-world light switch placement
- Pick a random wall (north/south/east/west) and place at wall_thickness inset from wall
- Position: on the wall face, player stands next to it and presses E
- Visual: small rectangle on wall (e.g., 10x14px) in light gray/white color

### Lit Room Effects
1. **Visibility**: Draw the entire room rectangle into `maskGraphics` with white fill — same Graphics object used for flashlight polygon. With `invertAlpha = true`, this punches a rectangular hole in the darkness overlay for the entire room.
2. **Light tint**: Draw room rectangle into `lightGraphics` with warm yellow tint (same pattern as flashlight glow)
3. **Enemy behavior**: Enemies in lit rooms should flee or be cleared. Simplest approach: when a room is lit, kill/despawn all enemies currently in that room and prevent new enemies from entering. Since enemies don't track roomId at runtime, use AABB check (point-in-room-bounds) to find enemies within the newly lit room.
4. **Enemy AI modification**: Enemies should avoid entering lit rooms. Add lit room bounds to the AI check — if an enemy's chase target would take them into a lit room, they stop at the boundary.

### Darkness/Mask Integration
- `updateDarkness()` in GameScene currently draws flashlight polygon into `maskGraphics`
- After drawing flashlight, iterate `switchStates` and for each `isOn` switch, draw `fillRect(room.x, room.y, room.width, room.height)` into `maskGraphics`
- Also draw same rect into `lightGraphics` with warm tint (0xffffcc, 0.05)
- Multiple shapes in a single Graphics object all contribute to the BitmapMask — confirmed by Phaser docs

### E-Key Interaction Changes
- Current E-key handler only checks doors. Need to also check switches.
- Priority: check nearest of either type (door or switch), interact with whichever is closer
- Alternative: check switch first, then door (simpler, works if switches are never near doors)
- Interaction range: same 80px as doors (SWITCH_INTERACT_RANGE = 80)
- Prompt text: reuse existing "Press E" text, position at nearest interactable (door or switch)

### Enemy Despawn on Light Toggle
- When switch is turned ON: iterate `enemyStates`, find enemies within room AABB, remove them
- Same destruction pattern as `onBulletHitEnemy`: `setActive(false)`, `setVisible(false)`, `body.enable = false`, filter from `enemyStates`
- Thematic justification: backrooms creatures flee from light (similar to Alan Wake pattern)

### Phaser Integration Points
- Import `createSwitchStates`, `toggleSwitch`, `findNearestSwitch` in GameScene
- `create()`: add `this.createSwitches()` after `createDoors()`
- `createSwitches()`: create switch states, draw switch visuals, no physics bodies needed (no collision)
- `update()`: modify E-key handler to check both doors and switches
- `updateDarkness()`: add lit room rectangles to mask after flashlight polygon
- `updateInteractPrompt()`: check nearest door OR switch, show prompt for whichever is closer
- New `onToggleSwitch(switchId)`: toggle state, despawn enemies in room, update visuals

## Hiding Mechanics Research

### Design Pattern: Binary State Flag + E-Key Interaction
- Games like Outlast use binary hiding: explicit button prompts near hiding spots (lockers, beds, barrels). Player enters a fixed position, flagged as fully hidden.
- Amnesia uses non-binary hiding with LOS occlusion, but that's more complex and less reliable for a top-down game.
- Best approach for this game: binary state flag (`isHiding`) toggled via E-key near `canHide` furniture. Clean, testable, fits existing interaction system.

### Architecture: Pure Module `hiding.js`
- `src/systems/hiding.js` — pure functions for hiding state management
- Follow the doors.js/lightswitch.js pattern: named exports, constants, query functions
- Constants: `HIDE_INTERACT_RANGE = 80` (same as doors/switches)
- `findNearestHideable(furnitureByRoom, px, py, maxRange)` — finds closest `canHide` furniture across all rooms, returns `{ roomId, furniture, center: {x, y}, dist }` or null
- `createHidingState()` returns `{ isHiding: false, furnitureRef: null }`
- `enterHiding(state, furnitureRef)` returns updated state with `isHiding: true`
- `exitHiding(state)` returns state with `isHiding: false`

### Enemy AI Integration
- Add `playerHidden` parameter to `updateEnemyAI(enemy, playerPos, segments, delta, playerHidden)`
- When `playerHidden` is true, force `canSee = false` regardless of LOS
- This preserves all state machine behavior: a chasing enemy loses sight → transitions to search → eventually idles
- No changes needed to `hasLineOfSight()` itself

### GameScene Integration Points
- `updateInteractPrompt()` (line 282): Add third interactable type `'furniture'` to resolution
- E-key handler (line 811): Add `'furniture'` branch → toggle hiding
- `update()` (line 779-790): When `isHiding`, skip movement (zero velocity) and skip shooting
- `updateEnemies()` (line 595): Pass `this.isHiding` flag to `updateEnemyAI()`
- `drawPlayer()` (line 610): Change alpha/color when hiding (0.3 alpha, darker color)
- `onEnemyContact()` (line 557): Skip damage while hiding (enemies can't see/reach you inside furniture)

### Visual Feedback
- Player alpha reduced to 0.3 when hiding (already have alpha change pattern for invulnerability)
- Player color changes to a muted gray-green
- "HIDDEN" text shown in HUD area (subtle, not too prominent)
- Interact prompt changes to "Press E to hide" / "Press E to unhide"

### Input Restrictions While Hiding
- Movement disabled (velocity zeroed)
- Shooting disabled (left-click ignored)
- Right-click (battery use) disabled
- Mouse aiming still allowed (player can look around but not act)
- Any WASD key press auto-exits hiding (for quick escape)
- E key toggles hiding off

### Existing Furniture Data
- `FURNITURE_TYPES` in furniture.js: table (canHide: true), desk (canHide: true), shelf (false), bookcase (false)
- Furniture data stored in `this.roomFurniture` (Map from roomId to array of furniture items)
- Each item: `{ type, x, y, width, height, color, canHide }`
- Furniture center for interaction: `x + width/2`, `y + height/2`
- Furniture zones in `this.furnitureGroup` do NOT carry metadata — must cross-reference with `roomFurniture`

## localStorage Persistence Research

### Current State: No Persistence
- `game.registry` is Phaser's in-memory key-value store — survives scene transitions but NOT browser reloads
- Only two registry keys exist: `shopState` (gold + upgrade levels) and `runCount` (integer)
- Zero existing localStorage usage in the codebase
- Phaser 3 has no built-in save/load system or localStorage integration

### Registry Usage Map
| File | Line | Key | Direction |
|------|------|-----|-----------|
| ShopScene.js | 19 | shopState | Read |
| ShopScene.js | 21, 68, 115 | shopState | Write |
| GameScene.js | 26 | shopState | Read |
| GameScene.js | 33 | runCount | Read |
| GameScene.js | 34 | runCount | Write |

### Shop State Structure (What Needs Persisting)
```javascript
{
  gold: number,           // integer, player's currency balance
  upgrades: {
    battery: number,      // 0-3, upgrade level
    flashlight: number,   // 0-3, upgrade level
    health: number,       // 0-3, upgrade level
    speed: number,        // 0-3, upgrade level
  }
}
// Also: runCount (integer) as a separate value
```

### Architecture Decision: Pure Module
- Follow existing codebase pattern: pure function module (`src/systems/persistence.js`)
- No Phaser dependency — testable in node environment like all other systems
- Functions: `saveGame(shopState, runCount)`, `loadGame()`, `clearSave()`
- Wrap all localStorage access in try-catch for Safari private browsing / quota exceeded
- Use in-memory fallback when localStorage unavailable (game still works, just doesn't persist)

### Save Data Format
```javascript
{
  version: 1,                    // for future migration
  shopState: { gold, upgrades }, // full shop state object
  runCount: number,              // total runs completed
}
```

### When to Save
- On every `registry.set('shopState', ...)` in ShopScene (after gold add, after purchase, before entering backrooms)
- On `registry.set('runCount', ...)` in GameScene init
- On `visibilitychange` (tab hidden) and `beforeunload` (browser close) as safety nets
- Simplest approach: save in the pure module functions, called from the same places that already do `registry.set()`

### When to Load
- On game boot in `main.js` — populate registry before GameScene's `init()` runs
- Or in GameScene `init()` / ShopScene `init()` — defensive fallback already exists in both

### localStorage Availability Detection
```javascript
function isStorageAvailable() {
  try {
    const k = '__test__';
    localStorage.setItem(k, k);
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}
```
- `"localStorage" in window` is NOT sufficient — Safari Private Browsing throws QuotaExceededError on setItem
- Must test actual read/write

### Save Data Versioning
- Include `version` field in save data for future migration
- Migration chain: `if (data.version < N)` transform, increment version
- Reject saves with version higher than CURRENT_VERSION (forward-compatibility protection)
- Spread defaults on load: `{ ...defaults, ...savedData }` ensures new fields exist

### Corruption Handling
- Wrap `JSON.parse()` in try-catch — if parsing fails, return null (start fresh)
- Validate loaded data has expected shape (gold is number, upgrades object has expected keys)
- On QuotaExceededError during save, log and continue — don't crash the game

### Integration Points
- `main.js`: After creating `Phaser.Game`, call `loadGame()` and populate registry before scenes start
- `ShopScene.init()` line 19: Already has `|| createShopState()` fallback — works naturally with persistence
- `GameScene.init()` line 33: Already has `?? 0` fallback for runCount — works naturally
- Alternative: load in a Boot scene, but current architecture doesn't have one — adding to main.js is simpler
