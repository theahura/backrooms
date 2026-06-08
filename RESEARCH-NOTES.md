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

## Flashlight Mouse Tracking Bug Research

### Root Cause: Stale `pointer.worldX`/`worldY`
- In Phaser 3, `pointer.worldX` and `pointer.worldY` are **stored properties** (not getters) — only updated when an actual input event fires (mouse move, button down/up)
- When the player moves with WASD and the camera follows via `startFollow()`, the camera scrolls but no mouse event fires — `worldX`/`worldY` remain stale
- The camera lerp of 0.1 compounds the issue: camera takes ~10 frames to catch up, each frame widening the gap between stale world coordinates and actual mouse position
- Confirmed Phaser bug: [GitHub #4216](https://github.com/photonstorm/phaser/issues/4216), [GitHub #4658](https://github.com/photonstorm/phaser/issues/4658)

### Affected Code Locations (GameScene.js)
1. **`update()` lines 816-822**: `this.playerAngle` computed from `pointer.worldX`/`worldY` — controls flashlight direction and player rotation
2. **`fireBullet()` lines 534-538**: `calculateBulletVelocity()` uses `pointer.worldX`/`worldY` — bullets fire in wrong direction when values are stale

### Fix: `pointer.updateWorldPoint(camera)`
- `Pointer.updateWorldPoint(camera)` (added Phaser 3.19) recalculates `worldX`/`worldY` from screen position and current camera matrix
- Call at start of `update()`, before any `pointer.worldX`/`worldY` reads
- Handles zoom, rotation, and scroll via full matrix inversion
- Alternative: `camera.getWorldPoint(pointer.x, pointer.y)` returns a Vector2 without mutating the pointer
- **Do NOT use** `pointer.x + camera.scrollX` — breaks with camera zoom or rotation

### Why `pointer.updateWorldPoint` is Preferred
- Single call refreshes `pointer.worldX`/`worldY` for all subsequent reads in the same frame
- No need to change `fireBullet()` or any other code that reads `pointer.worldX`/`worldY`
- Negligible performance cost (sin/cos + matrix operations, once per frame)

## Minimap / Exploration Tracking Research

### Rendering Approach: Graphics + setScrollFactor(0)
- Use `this.add.graphics().setScrollFactor(0).setDepth(1000)` — same pattern as existing HUD
- Draw scaled-down room rectangles with `fillRect()` for each visited room
- Fog of war by omission: only draw rooms the player has visited
- Clear and redraw each frame (cheap for <30 rooms of simple rectangles)
- Player position dot: `fillCircle()` at scaled player coordinates
- Exit marker: distinct color circle at exit location
- Alternative approaches (second camera, RenderTexture) are overkill for simple colored rectangles

### Design Decisions (Binding of Isaac / Enter the Gungeon / Horror conventions)
| Decision | Choice | Rationale |
|---|---|---|
| Position | Top-right corner | Industry standard, avoids health bar (top-left) |
| Size | ~150-180px wide | Unobtrusive, horror benefits from less UI |
| Room representation | Filled rectangles on a grid | Rooms are uniform size on integer grid |
| Current room | Brighter fill (light gray) | Must be instantly identifiable |
| Visited rooms | Dim filled rectangles (dark gray) | Shows progress without visual noise |
| Unvisited rooms | Not shown | Maintains mystery |
| Room connections | NOT drawn explicitly | Grid adjacency implies connection (Isaac pattern) |
| Color palette | Dark gray base, muted tones | Matches horror aesthetic |
| Exit marker | Green dot in room 0 | Consistent with existing exit zone color |
| Background | Semi-transparent black panel | Readable against any game scene |

### Architecture: Pure Module `exploration.js`
- Follow doors.js/lightswitch.js pattern: constants, state factory, query functions
- `createExplorationState()` → `{ visitedRoomIds: new Set(), currentRoomId: null }`
- `updateExploration(state, playerX, playerY, rooms)` → detects current room, adds to visited set, returns updated state
- `getCurrentRoom(playerX, playerY, rooms)` → returns room object or null (point-in-AABB check)
- `getMinimapData(state, rooms, playerX, playerY, exitPos)` → returns everything needed for rendering: scaled positions, colors, player dot, exit marker
- No Phaser dependency — pure JavaScript, testable in Node

### Coordinate Mapping (World → Minimap)
- Rooms are on integer grid: `gridX * 1200`, `gridY * 1000`
- Level bounds available as `this.levelBounds = { minX, minY, maxX, maxY }`
- Scale factor: `minimapWidth / (maxX - minX)` for x, `minimapHeight / (maxY - minY)` for y
- Since rooms are all same size, can simplify: use `gridX`/`gridY` as integer coordinates scaled by cell size
- Minimap screen position: top-right corner with margin

### GameScene Integration Points
- `create()`: create `this.minimapGraphics` and `this.explorationState`
- `update()`: call `updateExploration()` with player position, then `drawMinimap()`
- `drawMinimap()`: clear graphics, draw background panel, iterate visited rooms as scaled rectangles, draw player dot, draw exit marker
- Depth 1000 (same as HUD — always visible above darkness)

### Performance
- ~6 rooms × fillRect + 1 fillCircle (player) + 1 fillCircle (exit) = ~8 draw calls per frame — negligible
- Could optimize with dirty flag (only redraw when room changes) but unnecessary for this scale
- No need for generateTexture baking since minimap changes as rooms are visited

### Persistence
- Exploration state resets each run (new level each time) — no need to persist
- Unlike shop state, this is ephemeral per-run data

## Starting Room (Furniture Store) Research

### Design Concept
- The APPLICATION-SPEC says: "each day starts in the same 'room'. The starting room should look like a furniture store that has a crack in the wall that leads to the backrooms."
- Inspired by the A24 Backrooms film: "a furniture store owner who finds a secret doorway that leads to a seemingly endless series of nondescript rooms"
- The furniture store is a safe zone / hub that contrasts with the dangerous backrooms — warm vs cold, lit vs dark
- The crack in the wall is the doorway to the backrooms — it's the existing door gap from room 0 to adjacent rooms, but visually treated as a crack instead of a clean opening

### Architecture: Pure Module `startroom.js`
- `src/systems/startroom.js` — pure functions for starting room configuration
- Follow existing pattern: named exports, constants, query functions
- `STORE_COLORS` — color palette for the furniture store (warm wood tones)
- `generateStoreLayout(roomX, roomY, roomWidth, roomHeight, wallThickness)` — returns hand-crafted furniture items for the store (display shelves, counter, couches, etc.)
- `generateCrackPoints(wallX, wallY, crackHeight, seed)` — returns jagged line points for the crack visual
- No Phaser dependency — pure JavaScript, testable in Node

### Color Palette
| Element | Furniture Store | Backrooms (current) |
|---------|----------------|---------------------|
| Floor | `0x5C4A3A` (warm dark wood) | `0x333333` (cold gray) |
| Walls | `0x7A6B5A` (warm tan) | `0x555555` (gray) |
| Ambient | Permanently lit (no darkness) | Flashlight-only |

### Store Furniture Types
- Display shelves (long narrow rectangles, 100x20, `0x6b4e2a`)
- Counter/register (wide rectangle, 120x40, `0x5c3a21` with metallic top)
- Couches (wide rectangles, 90x50, `0x8B6B4E`)
- Coffee tables (small squares, 40x40, `0xC19A6B`)
- Rugs (large low-opacity rectangles, 120x80, `0x7A3B2E` at 0.3 alpha)
- Potted plants (small circles, radius 8, `0x4A7A3B`)

### Crack in the Wall Visual
- Drawn on the wall at the doorway position connecting room 0 to the backrooms
- Jagged line using `beginPath()`/`moveTo()`/`lineTo()`/`strokePath()` with small random offsets
- Dark void color for the crack line (`0x111111`)
- Pulsing sickly yellow-green glow behind the crack (`0xD4C073` at 0.1-0.4 alpha)
- Glow implemented by tweening Graphics object alpha or redrawing per frame with time-based sine wave

### Lighting
- Room 0 should be permanently lit — no darkness overlay
- Already supported by the mask system: draw `fillRect` into `maskGraphics` for the room bounds (same as light switch lit rooms)
- Add room 0 to the lit room check unconditionally in `updateDarkness()`
- Warm tint overlay on the store room (`0xFFEECC` at 0.05 alpha) — already matches lightswitch warm tint pattern

### Exit Zone Repositioning
- Currently at top-left corner of room 0
- Reposition to the "store entrance" — a visual front door on the wall opposite from the crack
- The exit is where the player returns to end their run

### GameScene Integration Points
- `drawRoom()`: use `STORE_COLORS` for room 0 instead of default gray
- `createRoomFurniture()` or equivalent: use `generateStoreLayout()` for room 0 instead of random furniture
- `updateDarkness()`: always include room 0 in lit rooms (before flashlight check)
- `create()`: draw crack visual at doorway position on a separate Graphics object (depth 1-2)
- `create()`: add pulsing glow tween or time-based glow in `update()`
- `createExitZone()`: reposition to store entrance area

### Phaser Drawing Patterns for Crack
```javascript
// Jagged crack line
gfx.lineStyle(2, 0x111111, 0.9);
gfx.beginPath();
gfx.moveTo(crackX, crackY - crackHeight/2);
for (let i = 0; i < segments; i++) {
  gfx.lineTo(crackX + zigzagOffset, crackY - crackHeight/2 + segLength * (i+1));
}
gfx.strokePath();

// Glow behind crack (redrawn per frame with time-based alpha)
const glowAlpha = 0.15 + 0.1 * Math.sin(time * 0.003);
glowGfx.fillStyle(0xD4C073, glowAlpha);
glowGfx.fillRect(crackX - 4, crackY - crackHeight/2, 12, crackHeight);
```

### Performance Considerations
- Store furniture is baked once in `create()` — no per-frame cost
- Crack glow uses a single `fillRect` per frame — negligible
- Permanent room lighting is one additional `fillRect` in `maskGraphics` per frame — already done for lit rooms

## Enemy Scaling & Weapon Upgrades Research

### Enemy Scaling Formulas (from roguelike best practices)

Based on research across Hades, Enter the Gungeon, Binding of Isaac, Motherload, and Warframe:

**Enemy HP** (safest to scale — just means more shots needed):
```
enemyHP = BASE_HP * (1 + 0.25 * runNumber)
// Run 0: 50, Run 1: 62, Run 2: 75, Run 3: 87, Run 4: 100
// Hard cap: 150 HP (run 8+)
```

**Enemy Count** (moderate scaling — more enemies per room):
```
extraEnemies = Math.min(Math.floor(runNumber / 2), 3)
// Run 0: +0, Run 1: +0, Run 2: +1, Run 3: +1, Run 4: +2, Run 6+: +3
// Cap: 5 enemies per room max (base 1-2 + 3 extra)
```

**Enemy Speed** (scale LEAST — most frustrating axis):
```
chaseSpeed = BASE_CHASE * (1 + 0.05 * Math.min(runNumber, 6))
// Run 0: 80, Run 6+: 104 (30% cap)
// NEVER exceed 50% of player speed
```

**Enemy Damage** (moderate — player has HP upgrades to compensate):
```
contactDamage = BASE_DAMAGE + 5 * Math.min(runNumber, 4)
// Run 0: 20, Run 4+: 40 (cap)
```

### Design Principles
- Player max speed (200-260) must ALWAYS exceed enemy chase speed
- Hard caps essential for every parameter
- All upgrades max at level 3 = ~run 4-5 difficulty plateau
- Scaling priority: HP > count > damage > speed

### New Weapon Upgrade Values

Using existing `base + perLevel * level` formula:

| Upgrade | ID | Base | PerLevel | Level 0 | Level 1 | Level 2 | Level 3 |
|---|---|---|---|---|---|---|---|
| Weapon Damage | `weaponDamage` | 25 | 10 | 25 | 35 | 45 | 55 |
| Fire Rate (ms) | `fireRate` | 200 | -30 | 200ms | 170ms | 140ms | 110ms |
| Bullet Range | `bulletRange` | 600 | 100 | 600 | 700 | 800 | 900 |

Costs: same [100, 300, 800] as existing upgrades.

### Key Breakpoints
- At damage level 3 (55) vs base enemy (50 HP): one-shot kill — major milestone
- At fire rate level 3 (110ms): 9.1 shots/sec vs base 5.0 — very noticeable
- Full weapon DPS at max: 500 vs base 125 (4x improvement)
- Enemy HP scales to counter: run 4 enemies have 100 HP → back to 2 shots at max damage

### Shop Layout Concern
- Canvas is 1024x768; 7 upgrades at 80px row height = button at Y=800 (off-screen)
- Solution: reduce row height to 60px → button at Y=660 (safe)

### Architecture: Pure Module `scaling.js`
- `src/systems/scaling.js` — pure functions for difficulty scaling
- `getEnemyHP(baseHP, runCount)` — scaled HP with cap
- `getEnemyCount(baseMin, baseMax, runCount)` — scaled count with cap
- `getEnemyChaseSpeed(baseSpeed, runCount)` — scaled speed with cap
- `getEnemyDamage(baseDamage, runCount)` — scaled damage with cap
- No Phaser dependency — testable in Node

### Integration Points
- `GameScene.init()`: read weapon upgrade values from registry (same pattern as existing upgrades)
- `GameScene.init()`: store `this.runCount` for enemy scaling
- `GameScene.createEnemies()`: use `getEnemyHP(ENEMY_MAX_HP, runCount)` instead of `ENEMY_MAX_HP`
- `GameScene.createEnemies()`: use `getEnemyCount()` to determine enemy count per room
- `GameScene.onBulletHitEnemy()`: use `this.bulletDamage` instead of `BULLET_DAMAGE`
- `GameScene.fireBullet()`: use `this.fireRate` instead of `FIRE_RATE_MS`
- `GameScene.updateBullets()`: use `this.bulletRange` instead of `BULLET_MAX_RANGE`
- `enemy.js.generateRoomEnemies()`: add optional `extraCount` parameter
- `ShopScene.js`: reduce rowHeight from 80 to 60 for 7 upgrades

## Multiple Enemy Types Research

### Enemy Type Design (from twin-stick shooter analysis)

Based on research across Enter the Gungeon, Nuclear Throne, Binding of Isaac, and Hotline Miami:

**Crawler (Fast Melee)**
- Move speed: 110-150% of player speed in roguelikes — too fast for horror. Target: 140% of zombie chase speed (112 vs 80), still below player speed (200)
- Low HP: 30 (vs 50 for zombie) — dies in 2 hits with base weapon, 1 hit at max damage upgrade
- Lower contact damage: 15 (vs 20) — compensated by closing distance faster
- Same AI state machine (idle/chase/search) — just with different speed constants
- Design role: pressure the player to move, punish camping. Creates urgency.
- Visual: smaller circle (14px diameter vs 20px), purple/magenta color — compact = fast-reading

**Spitter (Ranged)**
- Move speed: 60 chase, 20 wander — slower than zombie, less threatening up close
- HP: 40 — slightly less than zombie, reward closing distance
- Low contact damage: 10 — ranged enemy, contact should be less punishing
- Projectile damage: 15 per hit
- Projectile speed: 200px/s (1x player movement speed — dodge window of ~0.5s at typical range)
- Attack range: 250px (slightly less than detection range of 300)
- Attack cooldown: 2000ms between shots
- Telegraph: 300ms pause before firing (visual cue: color flash)
- Design role: zone control, force aggressive play to close distance
- Visual: blue/cyan circle (20px), distinct from red zombie and purple crawler

### Spitter AI State Machine
Extended from base 3-state FSM with a 4th `attack` state:
```
idle → chase (when LOS acquired within detection range)
chase → attack (when LOS + within attack range)
chase → search (when LOS lost)
attack → idle (when LOS lost AND no last known position)
attack → search (when LOS lost)
attack → chase (when player exits attack range but still in detection range)
search → chase (when LOS reacquired)
search → idle (when search timer expires or arrives at last known)
```

Attack state behavior:
- velocity = 0 (stop moving)
- Decrement attackCooldown by delta
- When cooldown <= 0: set `wantsToFire = true` on return object, reset cooldown to SPITTER_ATTACK_COOLDOWN
- Scene reads `wantsToFire` and spawns projectile, resets flag
- If player exits attack range: transition back to chase
- If LOS lost: transition to search

### Enemy Type Distribution Per Run
```javascript
// Run 0: 100% basic zombies (introduction)
// Run 1: 80% basic, 20% crawler (introduce fast enemy)
// Run 2+: 50% basic, 25% crawler, 25% spitter (full mix)
function getEnemyType(rand, runCount) {
  const roll = rand();
  if (runCount >= 2) {
    if (roll < 0.50) return 'basic';
    if (roll < 0.75) return 'crawler';
    return 'spitter';
  }
  if (runCount >= 1) {
    if (roll < 0.80) return 'basic';
    return 'crawler';
  }
  return 'basic';
}
```

### Enemy Projectile System (Phaser 3)
- Mirrors existing player bullet pattern exactly
- Separate physics group: `this.enemyBulletGroup = this.physics.add.group({ maxSize: 30 })`
- Distinct red texture via `generateTexture('enemyBullet', ...)` with `fillStyle(0xff4444)`
- Collision: `physics.add.overlap(enemyBulletGroup, player, onEnemyBulletHitPlayer)`
- Wall collision: `physics.add.collider(enemyBulletGroup, walls, onEnemyBulletHitWall)`
- Also collide with furniture and doors (same as player bullets)
- Range expiry: same `isBulletExpired` function, checked in update loop
- Enemy bullet range: 400px (shorter than player's 600px base)
- Object pooling via `group.get(x, y, 'enemyBullet')` — same pattern as player bullets

### Visual Differentiation
| Type | Color | Size | Shape Notes |
|---|---|---|---|
| Basic (zombie) | Red (0xcc3333) | 20px circle | Two dark eye dots |
| Crawler | Purple (0x9933cc) | 14px circle | Smaller, no eyes — alien/insect feel |
| Spitter | Blue (0x3399cc) | 20px circle | Eye dots + lighter mouth area |

### Constants Summary
```javascript
// Crawler
CRAWLER_MAX_HP = 30
CRAWLER_CONTACT_DAMAGE = 15
CRAWLER_CHASE_SPEED = 112  // 140% of base 80
CRAWLER_WANDER_SPEED = 50  // faster wander than basic 30

// Spitter
SPITTER_MAX_HP = 40
SPITTER_CONTACT_DAMAGE = 10
SPITTER_CHASE_SPEED = 60
SPITTER_WANDER_SPEED = 20
SPITTER_ATTACK_RANGE = 250
SPITTER_ATTACK_COOLDOWN = 2000
SPITTER_TELEGRAPH_MS = 300
SPITTER_PROJECTILE_SPEED = 200
SPITTER_PROJECTILE_DAMAGE = 15
SPITTER_PROJECTILE_RANGE = 400
```

### Architecture Changes
- `enemy.js`: Add type constants, `getEnemyType()`, extend `generateRoomEnemies` to return `type` field, extend `updateEnemyAI` with `attack` state for spitters and type-aware speeds
- `combat.js`: Add per-type HP and damage constants
- `scaling.js`: No changes — functions already accept base values as parameters
- `GameScene.js`: Generate textures per type, create enemy bullet group, extend `onEnemyContact` to read per-enemy damage, add enemy bullet update/expiry/collision handlers
- `shooting.js`: Add `ENEMY_BULLET_SPEED`, `ENEMY_BULLET_RANGE` constants (or keep in enemy.js)

### Key Design Constraint
- `onEnemyContact()` currently accepts no arguments (line 671 in GameScene). Phaser overlap callbacks pass `(obj1, obj2)` but the function ignores them. Must change to `onEnemyContact(player, enemySprite)` to look up per-enemy damage.
- Alternatively, store `contactDamage` as a property on the enemy state and look up by sprite reference (same pattern as `onBulletHitEnemy` finding `enemyState`)

## Stairs / Vertical Room Connections Research

### Design Decision: Multi-Floor in Same Scene (Teleportation)

The APPLICATION_SPEC says "rooms are connected to each other in a variety of ways, including stairs." Since the game requires the player to return to the exit before battery dies, stairs must be bidirectional — the player can go down and come back up. This rules out the one-way "scene restart per floor" approach used by Binding of Isaac/Enter the Gungeon.

**Approach:** Generate multiple floors in the same Phaser scene, offset far apart in world space. Stairs are overlap zones (like the exit zone) that teleport the player with a camera fade transition.

### Floor Generation Strategy

- Each floor is generated independently by calling `generateLevel(seed + floor * 1000, roomCount)`
- Floor 0: 4 rooms (room 0 is the furniture store start)
- Floor 1: 3 rooms (deeper backrooms — more dangerous, no safe starting room)
- Room IDs offset per floor to remain globally unique
- Floor separation: `FLOOR_Y_OFFSET = 10000` pixels (floors never visually overlap)
- Room data extended with `floor` field for filtering

### Stair Connection Architecture

- 1 stair pair connects floor 0 to floor 1 (bidirectional)
- Stair placement: pick a non-room-0 room on floor 0, pick any room on floor 1
- Use seeded PRNG (seed offset +50000) for deterministic stair placement
- Stair zones are 60x60 overlap areas (same pattern as exit zone)
- Each stair has a counterpart: "stairs down" on floor 0, "stairs up" on floor 1

### Teleportation Pattern (from Phaser 3 research)

```javascript
onStairEnter(player, stairZone) {
  if (this.isTeleporting || this.dayEnding) return;
  this.isTeleporting = true;
  player.body.stop();
  player.body.enable = false;

  this.cameras.main.fadeOut(300, 0, 0, 0);
  this.cameras.main.once('camerafadeoutcomplete', () => {
    // Reposition player to destination stair
    player.body.reset(destX, destY);
    player.body.enable = true;
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.cameras.main.once('camerafadeincomplete', () => {
      this.isTeleporting = false;
    });
  });
}
```

Key notes:
- `body.reset(x, y)` is critical (not `setPosition`) — clears velocity delta
- `body.enable = false` during transition prevents collision glitches
- Boolean flag `isTeleporting` prevents repeated overlap triggers
- Camera already follows player via `startFollow` — auto-snaps after reset

### Minimap Changes

- `getMinimapData` must filter rooms by current floor
- `levelBounds` computed per-floor (not across all floors) for proper scaling
- Floor indicator ("B1", "B2") shown on minimap
- Stair positions shown as markers on minimap

### Stair Visual Design

- "Stairs down" on floor 0: dark rectangular hole with diagonal lines (4-5 parallel lines suggesting steps descending)
- "Stairs up" on floor 1: same but lines go the other way
- Pulsing dim purple glow around stair edges (similar to crack glow but purple = deeper, more ominous)
- Rendered at depth 2 (same as crack — below darkness, visible in flashlight and lit rooms)
- Interaction prompt: "Press SPACE to descend" / "Press SPACE to ascend" when near

### Architecture: Pure Module `stairs.js`

- `FLOOR_Y_OFFSET = 10000`
- `STAIR_WIDTH = 60`, `STAIR_HEIGHT = 60`
- `FLOOR_ROOM_COUNTS = [4, 3]` — rooms per floor
- `generateMultiFloorLevel(seed, floorRoomCounts)` → `{ rooms, wallSegments, stairs }`
  - Calls `generateLevel` per floor, offsets room IDs and Y positions
  - Creates stair connections between floors
  - Returns combined data
- `createStairConnections(rooms, seed)` → `[{ id, fromRoomId, toRoomId, fromPos, toPos, floor }]`
- `getStairPosition(room)` → center of room (avoiding furniture zone)
- `getFloorBounds(rooms, floor)` → `{ minX, minY, maxX, maxY }` for a specific floor

### Integration Points

- `GameScene.create()`: Use `generateMultiFloorLevel` instead of `generateLevel`
- `GameScene.create()`: Create stair zones after exit zone
- `GameScene.setupCamera()`: Use full level bounds (both floors) for camera/physics bounds
- `GameScene.updateDarkness()`: Darkness rect covers full level bounds (already does this)
- `GameScene.update()`: Track current floor, pass to minimap
- `exploration.js`: Add `currentFloor` to state, filter `getMinimapData` by floor
- HUD: Add floor indicator text ("B1" / "B2")

### Performance Considerations

- Wall segments from both floors in `this.wallSegments`: ~200 total for 7 rooms — negligible for raycasting
- Physics world bounds span both floors but Phaser RTree handles spatial indexing efficiently
- Darkness rect size increases but is just a single fill operation
- Enemy AI only checks nearby segments (detection range ~300px) — floor 2 segments 10000px away are never relevant

### Known Limitations for MVP

- Only 2 floors for now (easily extensible to 3+ later via FLOOR_ROOM_COUNTS array)
- Stairs always auto-teleport on overlap (no confirmation prompt needed — simpler interaction)
- Enemies do not follow player between floors (they stay on their floor)
- Battery continues draining during stair transition (intentional tension)

## Weapon Switching System Research

### Design Decisions

**Slot System**: 2 weapon slots (Nuclear Throne pattern)
- Slot 0: always has pistol (default weapon)
- Slot 1: empty at start, filled by picking up weapons found in rooms
- Simple cycling with Q key (wraps around)
- Spec says "q/e to switch weapons" but E is already bound to interactions (doors/switches/hiding). Using Q alone for cycling is sufficient with only 2 slots.

**Weapon Types (3 types for MVP)**:
| Stat | Pistol | Shotgun | Rifle |
|------|--------|---------|-------|
| Damage | 25 | 10 (per pellet) | 50 |
| Fire Rate (ms) | 200 | 800 | 600 |
| Bullet Count | 1 | 4 | 1 |
| Spread Angle | 0 | PI/5 (36°) | 0 |
| Bullet Speed | 500 | 400 | 600 |
| Range | 600 | 350 | 900 |
| Color | 0xffdd44 (yellow) | 0xff8844 (orange) | 0x44ddff (cyan) |

**Design rationale**: Pistol is balanced all-rounder. Shotgun is high burst at close range (rewards risky play in a horror game). Rifle is long range precision (lets player engage from safety but slow fire rate means missed shots are costly).

**Pickup Mechanism**: E-key interaction (same system as doors/switches/hiding)
- Weapon pickups are added as a 4th candidate type in `updateInteractPrompt()`
- "Press E to pick up [weapon name]" prompt when near
- If slot 1 is empty: add weapon to slot 1
- If slot 1 is full: swap current slot 1 weapon — drop the old one on the ground at that position
- Prevents accidental weapon swaps (unlike auto-pickup items)

**Upgrade Interaction**: Upgrades apply as flat bonuses to current weapon's base stats
- `weaponDamage` upgrade: adds +10/level to current weapon's base damage
- `fireRate` upgrade: subtracts 30ms/level from current weapon's base fire rate
- `bulletRange` upgrade: adds +100/level to current weapon's base range
- This means upgrades improve ALL weapons equally (not just pistol)

**Persistence**: Weapons do NOT persist between runs
- Player always starts with pistol each run
- Weapons found in rooms are ephemeral (same as battery/treasure items)
- Fitting for horror: player is always somewhat underpowered

### Architecture: Pure Module `weapons.js`

- `src/systems/weapons.js` — pure functions for weapon definitions and state
- `WEAPON_TYPES` array: `{ id, name, damage, fireRate, speed, range, bulletCount, spreadAngle, color, pickupColor }`
- `createWeaponState()` returns `{ slots: [pistolWeapon, null], activeSlot: 0 }`
- `switchWeapon(state)` returns state with `activeSlot` toggled (wraps, skips null slots)
- `pickupWeapon(state, weaponType)` returns `{ state, droppedWeapon }` — adds to empty slot or swaps
- `getActiveWeapon(state)` returns current weapon definition
- `getEffectiveStats(weapon, upgradeBonuses)` returns stats with upgrade bonuses applied

### Weapon Spawning

- Follow items.js pattern: seeded PRNG placement in rooms
- Seed offset: +60000 (next in sequence after stairs +50000)
- 1 weapon per level (rare, meaningful find) — spawns in a random non-room-0 room
- Weapon type selection: seeded random from shotgun/rifle (pistol is never a floor drop)
- Visual: colored rectangle pickup sprite (larger than coins, weapon-shaped) at depth 5

### Shotgun Spread Implementation

```javascript
function calculateShotgunSpread(originX, originY, targetX, targetY, speed, bulletCount, spreadAngle) {
  const baseAngle = Math.atan2(targetY - originY, targetX - originX);
  const halfSpread = spreadAngle / 2;
  const pellets = [];
  for (let i = 0; i < bulletCount; i++) {
    const offset = -halfSpread + (spreadAngle * i / (bulletCount - 1));
    const angle = baseAngle + offset;
    pellets.push({ vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }
  return pellets;
}
```

### HUD Changes

- Add weapon name text below battery/treasure text (y ~86)
- Format: "PISTOL" / "SHOTGUN" / "RIFLE" in weapon color
- When 2 weapons held, show both with active one highlighted

### Input Changes

- Register Q key in `setupInput()`
- On Q JustDown: cycle weapon forward (wraps around non-null slots)
- Fire logic modified: read stats from `getActiveWeapon(state)` instead of flat `this.bulletDamage` etc.
- Shotgun fire: loop over pellets from `calculateShotgunSpread()`

### Bullet Pool Sizing

- Current pool: maxSize 20
- Shotgun fires 4 pellets per shot → need larger pool
- Increase to maxSize 30 (accounts for shotgun bursts)

### Integration Points

- `GameScene.init()`: create weapon state, compute effective stats from active weapon + upgrades
- `GameScene.create()`: generate weapon pickup textures, spawn weapon in level
- `GameScene.setupInput()`: add Q key binding
- `GameScene.fireBullet()`: read from active weapon stats (damage, speed, count, spread)
- `GameScene.updateBullets()`: per-bullet range check (store weapon range on bullet data)
- `GameScene.onBulletHitEnemy()`: per-bullet damage (store damage on bullet data)
- `GameScene.updateInteractPrompt()`: add weapon pickup as candidate type
- `GameScene.drawHUD()`: add weapon indicator text
- `shooting.js`: add `calculateShotgunSpread()` export

## Backpack / Inventory Capacity Research

### Design Decision: Counted Capacity System

Based on analysis of Motherload (direct inspiration), RE4, Enter the Gungeon, and Binding of Isaac:

- **Motherload pattern**: cargo capacity limits how many minerals you can carry per trip. Fuel/repair items DO count against capacity. Starting capacity is small (~7), upgradeable in shop.
- **RE4 pattern**: grid-based, "inventory full" blocks pickup (items stay on ground).
- **This game**: items are auto-pickup on overlap with no slots (just counters). Simplest approach: count total items picked up.

### Capacity Design

**Base capacity**: 8 items per run
- 6 rooms × ~3.5 items avg = ~21 items available per run
- 8/21 = ~38% collection rate at base — forces meaningful decisions
- Battery items count against capacity (creates utility vs profit tension)
- Using a battery frees a slot (consumed items decrement count)

**Upgrade tiers** (Backpack upgrade in shop):
- Level 0: 8 capacity (base)
- Level 1: 12 capacity (+4)
- Level 2: 16 capacity (+4)
- Level 3: 20 capacity (+4)

At max (20/21), player can grab nearly everything — reward for investment.
Cost: [100, 300, 800] (same as other upgrades).

**When full**: items remain on ground, NOT destroyed. Player sees but cannot pick up.
- This is the RE4/Motherload pattern — no permanent item loss, just capacity constraint
- Prevents frustration from accidentally losing valuable gems

### Architecture: Modify Existing `inventory.js`

**State change:**
```javascript
{
  batteries: 0,
  treasureValue: 0,
  itemCount: 0,     // NEW: current items in inventory
  maxItems: 8,      // NEW: capacity limit (from backpack upgrade)
}
```

**New functions:**
- `createInventoryState(maxItems = 8)` — accepts capacity from upgrade level
- `canPickupItem(state)` — returns `state.itemCount < state.maxItems`
- `pickupItem(state, item)` — now also increments `itemCount`
- `useBattery(state)` — now also decrements `itemCount` (frees a slot)

**New constant:**
- `BASE_INVENTORY_CAPACITY = 8`
- `INVENTORY_CAPACITY_PER_LEVEL = 4`

### Shop Integration

Add to UPGRADES array:
```javascript
{
  id: 'backpack',
  name: 'Backpack Size',
  description: 'Carry more items per run',
  maxLevel: 3,
  costs: [100, 300, 800],
  base: 8,
  perLevel: 4,
}
```

`createShopState()` auto-adds `backpack: 0` to upgrades object.

### GameScene Integration

- `init()`: read backpack upgrade level, compute `maxItems = getUpgradeValue('backpack', level)`
- `createInventoryState(maxItems)` called with computed capacity
- `onItemPickup()`: check `canPickupItem()` before pickup — if false, skip destroy and return early
- `drawHUD()`: add capacity indicator text (e.g., "4/8" near treasure display)

### HUD Display

- Add capacity text after treasure text: `"[4/8]"` in white/gray
- When full: text turns red to signal "inventory full"
- Position: after treasureText at x ~220, y 66 (same row as battery/treasure)

### ShopScene Layout

- 8 upgrades total: reduce rowHeight further if needed (currently 60px → try 55px)
- Canvas height 768px, 8 rows × 55 = 440, plus title + button = ~540px total (fits)

## Maze-Like Room Design Research

### Approach: Recursive Division for Internal Walls
- Start with room interior bounds (inset from walls by wallThickness + margin)
- Recursively subdivide with horizontal/vertical walls that have gaps (passage openings)
- Each wall becomes 1-2 `{x1,y1,x2,y2}` segments (wall minus gap)
- Connectivity guaranteed by construction: every wall added has a passage opening
- Terminate when sub-region is below minimum size (~200px)
- Use seeded PRNG for determinism (seed offset +70000 for internal walls)

### Room Variety Strategy
- Not all rooms should be maze-like. Use seeded PRNG to determine room type:
  - ~40% open (current behavior, no internal walls)
  - ~30% maze-like (recursive division, 2-3 depth)
  - ~30% columns (grid of small pillars creating shadow patterns)
- Room 0 (furniture store) is never maze-like — uses hand-crafted layout
- Floor 1 rooms have higher chance of maze-like (deeper = more labyrinthine)

### Column Pattern
- Small square pillars (24x24px) in a staggered grid (spacing ~200px)
- Each column = 4 wall segments for raycasting
- Creates interesting shadow interplay with flashlight
- Staggered grid prevents player from seeing long straight corridors

### Tables Not Blocking Light
- Current: ALL furniture types generate wall segments via `createFurnitureSegments()`
- Fix: Add `blocksLight` property to FURNITURE_TYPES
- Tables and desks are low furniture — light passes over them (blocksLight: false)
- Shelves and bookcases are tall — they still block light (blocksLight: true)
- In GameScene line 219: conditionally skip pushing segments for non-blocking furniture
- Physics collision still applies (player can't walk through tables)

### More Doors Between Rooms
- Current: exactly 1 door per room connection (parent-child during generation)
- Fix: post-placement pass in `generateLevel()` — check all grid-adjacent room pairs
- For each adjacent pair without a door: ~50% chance to add an extra door
- Extra doors use same format: `{ wall, offset, width, targetRoomId }`
- This creates loops in the level graph (more navigability, less dead-ends)

### More Stair Connections
- Current: exactly 1 stair between floor 0 and floor 1
- Fix: create 2 stair connections per floor pair
- Pick 2 distinct rooms on each floor
- Gives player more routing options between floors

### Architecture: New Pure Module `maze.js`
- `src/systems/maze.js` — pure functions for internal room generation
- `generateMazeWalls(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, doors)` — returns array of wall segments
- `generateColumns(roomX, roomY, roomWidth, roomHeight, wallThickness, seed)` — returns array of column descriptors
- `getRoomType(seed)` — returns 'open' | 'maze' | 'columns' based on seeded random
- Each column: `{ x, y, size }` → converted to segments via existing `createFurnitureSegments`
- Internal walls avoid overlapping door zones (need door positions as input)

### Performance Considerations
- Raycasting is O(rays × segments). Adding ~20-30 internal segments per maze room across 7 rooms = ~150 extra segments worst case.
- With current 6-ray system this is negligible.
- Physics uses RTree spatial indexing — hundreds of extra static bodies are fine.

### Integration Points
- `furniture.js`: Add `blocksLight` to FURNITURE_TYPES
- `level.js`: Add post-placement door pass before generating wall segments
- `stairs.js`: Modify `createStairConnections` to create 2 stairs
- `GameScene.js` line 219: Check `blocksLight` before pushing segments
- `GameScene.js`: After `createRoomFurniture`, call maze wall generation and push to wallSegments + create physics zones
- New `maze.js`: Room type determination, recursive division, column generation

## Weaponless Start + Ammo System Research

### Design Decision: No Starting Gun + Per-Weapon Ammo

The spec says "player shouldn't start with a gun" and "guns should have ammo." Research across survival horror (RE, Silent Hill, Amnesia) and roguelikes (Enter the Gungeon, Nuclear Throne, Dead Cells) reveals:

1. **No roguelike successfully makes the player fully weaponless.** The proven pattern is "weak/underpowered start, not absent." However, the spec explicitly says no gun — and this game already has hiding mechanics and closable doors as defensive tools.
2. **Per-weapon ammo (Enter the Gungeon model)** creates more tension than shared pools (Nuclear Throne model) — each weapon has its own ammo count.
3. **Guaranteed weapon placement** in early rooms prevents softlocks while maintaining tension.
4. **Ammo pickups** should restore ~20-30% of max capacity per pickup.

### Ammo System Design

**Per-weapon ammo with these values:**
| Weapon | Start Ammo | Max Ammo | Ammo Per Pickup |
|--------|-----------|----------|-----------------|
| Pistol | 15 | 50 | 10 |
| Shotgun | 6 | 20 | 4 |
| Rifle | 4 | 15 | 3 |

- Shotgun fires 4 pellets but consumes 1 ammo per shot (not per pellet)
- Ammo is tracked per-weapon-slot, not globally
- When ammo reaches 0, weapon cannot fire (no infinite fallback)

### Weaponless Start Design

**Approach:**
- `createWeaponState()` starts with `slots: [null, null]` — no weapon
- Player must find weapons in rooms (already spawns 1 per level)
- Increase weapon spawns: guarantee at least 1 weapon on floor 0 and 1 on floor 1
- Add "Starting Pistol" shop upgrade: gives pistol with ammo at run start (expensive — 500 gold)
- When unarmed: left-click does nothing, Q does nothing, HUD shows "UNARMED"
- Weapon pickup fills first empty slot (slot 0 first, then slot 1)

### Ammo Pickup Spawning

- New item type `ammo` added to ITEM_TYPES in items.js (weight: 12, between gem and battery)
- Ammo pickups restore ammo for currently equipped weapon
- If no weapon equipped, ammo pickups are still collected (stored as generic ammo for next weapon found)
- Alternative: ammo pickups are weapon-specific — simpler but may feel unfair if you find ammo for a weapon you don't have

**Decision: Generic ammo pickups that restore the current weapon's ammo.** Simpler implementation, avoids the problem of finding shotgun ammo without a shotgun.

### Shop Integration

- New shop item: "Starting Pistol" (id: `startingPistol`) — single tier, cost 500
- When purchased: player starts each run with a pistol + 15 ammo
- Fits the Motherload pattern: invest in starting equipment for easier exploration

### Architecture Changes

- `weapons.js`: Add `ammo` and `maxAmmo` fields to WEAPON_TYPES. Modify `createWeaponState()` to start empty. Add `consumeAmmo(state)`, `addAmmo(state, amount)`, `hasAmmo(state)`, `canFire(state)` functions.
- `shooting.js`: No changes needed (already pure velocity/cooldown functions)
- `items.js`: Add `ammo` item type to ITEM_TYPES
- `inventory.js`: Handle ammo pickup (add to current weapon's ammo)
- `shop.js`: Add `startingPistol` upgrade
- `GameScene.js`: Guard `fireBullet()` with ammo check, decrement ammo on fire, display ammo in HUD, handle weaponless state (disable fire, update HUD)

## Minimap as Shop Upgrade Research

### Design Decision: Permanent Unlock (Single Tier, Expensive)

The spec says "the map should not be available immediately (it should be very expensive)." Research across Enter the Gungeon (per-floor consumable), Binding of Isaac (run-length passive items), and Dead Cells (permanent rune) shows three models. Since this game has a persistent shop between runs, a **permanent unlock** (buy once, have minimap every run after) is the cleanest fit.

### UX Pattern
- No existing roguelike fully hides the minimap frame. Most show fog-of-war only.
- For this game: when minimap is not purchased, the top-right area is simply empty (no minimap graphics created). The exploration state still tracks visited rooms internally (useful for future features like achievements).
- Once purchased: minimap appears as it currently does (fog-of-war reveals visited rooms).

### Pricing
- Current income: copper (10), silver (50), gold (200), gem (1000). A typical successful run yields ~200-500 gold.
- "Very expensive" per the spec. Current most expensive: Starting Pistol at 500 gold.
- Decision: **1500 gold** — requires 3-5 successful runs of saving. Late-game quality-of-life investment.
- This follows the Slay the Spire principle: expensive items cost 2-3x a single run's income.

### Architecture: Follow `startingPistol` Pattern
- Add `minimap` entry to UPGRADES in shop.js: `{ id: 'minimap', name: 'Minimap', description: 'Reveals explored rooms on a map', maxLevel: 1, costs: [1500], base: 0, perLevel: 1 }`
- In GameScene.init(): `this.hasMinimap = (levels.minimap || 0) > 0`
- Guard minimap creation in createHUD(): only create `minimapGraphics` and `floorText` if `this.hasMinimap`
- Guard drawMinimap(): early-return if `!this.hasMinimap`
- Keep updateExploration() running unconditionally (cheap, useful for future)

### Integration Points
- `shop.js` line 83: Add minimap to UPGRADES array
- `GameScene.js` init() ~line 44: Read minimap upgrade level
- `GameScene.js` createHUD() ~line 715-757: Conditionally create minimap graphics + floor text
- `GameScene.js` drawMinimap() line 1190: Early-return guard
- `ShopScene.js`: Auto-picks up new upgrade from UPGRADES array (no changes needed)

## Reduced Light Switch Frequency Research

### Rationale
- Spec says "most rooms should NOT have light switches"
- Current: SWITCH_CHANCE = 0.4 (40% of rooms have switches)
- With 6 non-starting rooms, 40% means ~2.4 rooms lit per run — too many for horror atmosphere
- Target: 15% chance → ~0.9 rooms per run (often zero, occasionally one)

### Implementation
- Single constant change in lightswitch.js line 4: `SWITCH_CHANCE = 0.4` → `SWITCH_CHANCE = 0.15`
- No tests directly assert the distribution, so no test breakage expected
- Add a statistical distribution test to validate the new rate

## Movement While Hidden Research

### Design Decision: Constrained Movement Under Furniture

The spec says "the player should be able to move around under a table while hidden." Current behavior: any WASD press exits hiding, velocity is zeroed while hiding. Target: player can crawl within furniture bounds while remaining hidden/invisible to enemies.

### Phaser 3 Approach: `body.setBoundsRectangle()`

Available since Phaser 3.20. Key API:
- `body.setBoundsRectangle(new Phaser.Geom.Rectangle(x, y, w, h))` — sets per-body custom collision boundary
- `body.setCollideWorldBounds(true)` — enables the boundary collision check
- Physics engine handles clamping internally — body stays entirely within the rectangle
- To release: `body.setCollideWorldBounds(false)`

Important: the engine keeps the ENTIRE body inside the rectangle (not just center point). With a 20x20 body in an 80x50 furniture rect, center can move in a 60x30 area.

Player does NOT currently use `setCollideWorldBounds` (only enemies do). Player is constrained only by wall colliders. This means toggling `setCollideWorldBounds` for hiding is safe.

### Design Decisions

1. **Speed**: Half speed while hidden (`HIDING_SPEED_MULTIPLIER = 0.5`). Thematically = crawling under furniture.
2. **Enter hiding**: Snap player to furniture center via `body.reset()`. Prevents partial-outside issues.
3. **Exit hiding**: E key only (not WASD). Player movement no longer exits hiding.
4. **Bounds**: Exact furniture rectangle. `setBoundsRectangle` keeps body inside automatically.
5. **Shooting**: Still disabled while hiding (existing guard remains).
6. **Damage immunity**: Still immune while hiding (existing guard remains).
7. **Enemy AI**: Still can't see player while hiding (existing `playerHidden` flag remains).

### Architecture

- `hiding.js`: Add `HIDING_SPEED_MULTIPLIER = 0.5` and `getHidingBounds(furniture)` → `{x, y, width, height}`
- `GameScene.js`: On enter hiding → snap to center + `setBoundsRectangle` + `setCollideWorldBounds(true)`
- `GameScene.js`: On exit hiding → `setCollideWorldBounds(false)`
- `GameScene.js`: Update loop → allow `calculateVelocity(keyState, speed * HIDING_SPEED_MULTIPLIER)` while hiding
- Remove the "exit on WASD" behavior (lines 1399-1401)

### Gotchas
- `body.reset(x, y)` zeros velocity — use only on entering hiding (intentional: start still, then move)
- Must call `setBoundsRectangle` AFTER `body.reset` (reset may clear bounds)
- Wall colliders still active while hiding — but player is inside furniture bounds which are inside room bounds, so no conflict
- Furniture physics zones: player collides with `furnitureGroup` via `this.physics.add.collider(this.player, this.furnitureGroup)` (line 520). Currently not stored in a variable. Need to store as `this.playerFurnitureCollider` and toggle `.active = false` while hiding (otherwise physics pushes player out of the furniture body). Re-enable on exit hiding.
- Player body is 20x20 (set at line 517 via `body.setSize(20, 20, true)`)

## Starting Location Entry Consistency & Shop Positioning Research

### Problem Statement
The spec says: "the starting location should have a standard entry -- that entry shouldn't move; and the 'shop' should be in the center of the 'furniture shop' and not in the edge blocking the door"

Current issues:
1. Room 0's first door (the crack to the backrooms) can be on ANY wall depending on the random seed — it should be consistent
2. The exit zone (triggers ShopScene) is at center-north of room 0 (`y: room.y + wallThickness + 32`), which could be near a door and blocks the "front" of the store
3. The shop counter furniture is at `relX: 0.08` (far left), not centered

### Design Decision: Spatial Separation Pattern

Based on research of Hades, Dead Cells, Enter the Gungeon, and Binding of Isaac hub rooms:
- All roguelite hubs use **spatial separation** between spawn and exit
- No game uses proximity-only auto-trigger for run-starting exits
- Shops are placed on the mandatory path between spawn and exit

**Chosen layout for room 0:**
- **Crack (backrooms entry)**: Always east wall — forced in level generation
- **Exit zone (front entrance)**: West side of room 0, centered vertically — the "front door"
- **Player spawn**: Center of room 0 (unchanged)
- **Shop counter**: Center-ish position (relX ~0.35, relY ~0.42)

Flow: Player spawns at center → walks east to crack → explores backrooms → returns through crack → walks west to exit (front door) → ShopScene

### Architecture: Changes Required

1. **`level.js` line 46**: Force `DIRECTIONS[1]` (east) for `i === 1` so room 0's first connection is always east
2. **`startroom.js` `getExitPosition()`**: Change from north-center to west side (`x: room.x + wallThickness + 40, y: room.y + room.height / 2`)
3. **`startroom.js` `STORE_FURNITURE`**: Move counter to `relX: 0.35, relY: 0.42` — centered-ish without overlapping spawn exclusion zone (60x60 centered at room center)
4. **Store furniture**: Move east-side furniture (bookcases at relX: 0.75) to avoid blocking the always-east crack doorway

### Spawn Zone vs Counter Overlap Analysis
- Room: 1200x1000, wallThickness: 16, innerW: 1168, innerH: 968
- Spawn exclusion zone: 60x60 centered at (600, 500)
- Counter at relX:0.35, relY:0.42: x=16+round(0.35*1168)=425, y=16+round(0.42*968)=423
- Counter bounds: x=[425, 545], y=[423, 463]. Spawn zone: x=[570, 630], y=[470, 530]
- No overlap — counter is safely placed

### Exit Zone vs Player Spawn Separation
- Player spawns at: (600, 500) — center of 1200x1000 room
- Exit zone at: (56, 500) — west side, 40px from left wall
- Separation: ~544px horizontal distance
- Exit zone is 64x64 — player body is 20x20 — no overlap on spawn

### Test Impact
- `getExitPosition` tests check "inside room bounds" — passes at any interior position
- Level tests check determinism, connectivity, pairing — all pass with forced east
- "flashlight through doorway" test with seed 42 and 2 rooms: room 1 forced to east, angle from room0 center to room1 center still works
- "produces different layouts for different seeds" test: seeds 1 vs 2 still differ (rooms 2+ are random)

### Gotchas
- Must still consume `rand()` on first iteration or PRNG state shifts for subsequent rooms — consume and discard
- East-wall bookcases in store layout might visually overlap the crack doorway — reposition them
- `createCrackVisual()` already handles all 4 wall directions generically via switch on `door.wall`
- `addExtraDoors` may add extra doors to room 0 on other walls — room.doors[0] remains the east door since it was pushed first

## Lore Items Research

### Design Decisions
- Lore items are collectible notes/papers found in rooms — read-only, do NOT consume inventory space
- Follow existing item spawning pattern: seeded PRNG, furniture overlap avoidance, skip room 0
- Seed offset: +90000 (next available in the scheme: +0 furniture, +10000 enemies, +20000 items, +30000 doors, +40000 switches, +50000 stairs, +60000 weapons, +70000 maze, +80000 extra doors)
- Separate `lore.js` module rather than mixing into `items.js` — keeps spawn sequences independent
- ~25% chance per non-room-0 room to contain a lore note (sparse, not every room)
- 0-1 lore items per room (when present)
- Persist collected lore IDs across runs in localStorage (meta-progression)
- Each lore entry has a unique numeric ID for deduplication

### Lore Display UX
- When player walks over a lore note, show a text popup on screen
- Text popup: semi-transparent dark background, light text, centered on screen
- Auto-dismiss after ~5 seconds (short notes don't need player-dismissed in an action game where enemies may be nearby)
- Phaser Text object with setScrollFactor(0) at depth 1000 (same as HUD)
- Fade-in/fade-out via Phaser tweens for polish

### Lore Content Themes (Backrooms-authentic)
- Survival warnings (practical tips from predecessors)
- Psychological deterioration journals (diary entries showing mental decline)
- Cryptic/ominous fragments (unsettling observations)
- Desperate pleas (final messages)
- Existential dread (time distortion, identity loss)
- Sensory details (the buzzing, the yellow, the carpet smell)

### Visual Design
- Small paper/note shape — off-white/aged paper color (0xDDCCAA)
- Rendered at depth 5 (same as items — hidden by darkness, only visible in flashlight)
- Distinct from coins/batteries/ammo to be visually recognizable

### Persistence Integration
- Add `collectedLore` field (array of IDs) to save format
- Bump SAVE_VERSION to 2 (v1 saves load fine with `collectedLore` defaulting to [])
- Update saveGame/loadGame signatures
- Skip spawning notes the player has already collected (deduplication per-seed)
- Since level seeds change per run, lore ID = index into global LORE_ENTRIES array, assigned deterministically per room via seeded PRNG

### Implementation Pattern
- `src/systems/lore.js` — pure function module
  - LORE_ENTRIES: array of { id, text } — ~20 entries
  - generateRoomLore(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, furnitureItems, roomId, collectedLoreIds)
  - Returns [] for room 0, or 0-1 lore items with position and entry ID
- GameScene integration:
  - createLoreTexture() — paper icon
  - createLoreItems() — separate physics group
  - onLorePickup() — show text, add to collected set, destroy sprite
  - showLorePopup(text) — tween-animated text overlay
  - hideLorePopup() — auto-called after timeout

## Run-Scaling Floor Counts Research

### Design Decision: Run-Count Gated Floor Progression

Based on research across Spelunky 2 (shortcut-gated worlds), Dead Cells (boss-stem-cell gated biomes), Binding of Isaac (boss-defeat gated chapters), and Enter the Gungeon (secret-condition gated chambers):

- Win-count gating is ideal but requires tracking wins (not currently tracked)
- Run-count gating is simpler and still provides progression — experienced players see more content
- No bosses exist in this game yet, so boss-gating is not applicable

### Progression Table

| Run Count | Floors | Rooms per Floor | Total Rooms | Notes |
|-----------|--------|-----------------|-------------|-------|
| 0-1       | 2      | [4, 3]          | 7           | Current baseline |
| 2-3       | 3      | [4, 3, 3]       | 10          | +1 floor, more to explore |
| 4+        | 4      | [4, 3, 3, 2]    | 12          | Maximum depth |

### Key Design Constraints

- **Battery timer is the natural limiter**: more floors = more traversal time = more battery drain
- **3-5 rooms per floor** keeps horror pacing tight (unlike action roguelikes with 20+ rooms/floor)
- **New floors start small (2-3 rooms)** — contained introduction before expansion
- **4 floor cap** prevents battery from becoming impossible without max upgrades
- **Deeper floors have fewer rooms** — more dangerous per room (harder enemies from scaling.js) but less total area

### Architecture: Generalized N-Floor Stair Connections

Current limitation: `createStairConnections()` in stairs.js is hardcoded to connect floor 0 and floor 1 only. For N floors:

1. Iterate adjacent floor pairs: floor 0→1, floor 1→2, floor 2→3, etc.
2. For each pair, create up to 2 stair connections between distinct rooms
3. Skip room 0 (starting room) for floor 0 stairs (existing constraint)
4. Each stair gets `fromFloor` and `toFloor` fields for GameScene to use

### GameScene Changes for N-Floor Stairs

Current `createStairs()` hardcodes `destFloor` to 0 or 1:
```javascript
fromZone.setData('destFloor', 1);  // always 1
toZone.setData('destFloor', 0);    // always 0
```

Fix: derive `destFloor` from stair data:
```javascript
fromZone.setData('destFloor', stair.toFloor);
toZone.setData('destFloor', stair.fromFloor);
```

Stair visual direction ('up'/'down') should also be derived from floor indices rather than assumed.

### Minimap/HUD Changes

- Floor indicator already uses `B${this.currentFloor + 1}` — works for N floors
- `getFloorBounds()` already accepts any floor index — works for N floors
- `getMinimapData()` already accepts `floorFilter` — works for N floors
- No minimap changes needed

### Seed Offset Scheme for Additional Floors

Existing scheme: `floorSeed = seed + floor * 1000`. For floors 2 and 3:
- Floor 2: `seed + 2000`
- Floor 3: `seed + 3000`
No collision with per-system offsets (+10000, +20000, etc.) since floor offsets are < 10000.

## Alternate Exit Locations Research

### Design Decision: Permanent Unlock via Rare Alternate Exits

Based on research across Dead Cells (rune-unlocked alternate routes), Hades (hub evolution), and the Backrooms creepypasta lore:

- **Dead Cells model**: Rare items found in specific zones permanently unlock alternate routes/exits. The unlock key itself is the discovery.
- **No existing roguelike swaps the starting hub** based on exit choice — this is a novel mechanic.
- **Alternate exits should be rare and meaningful**: ~15-20% chance of one spawning per level, only on floors 1+.
- **Permanent unlocks**: Once found, the location is always available. Fits the meta-progression pattern of the shop system.
- **Location selector in shop**: Player can cycle through unlocked locations before entering the backrooms.

### Backrooms-Themed Alternate Locations

Based on Backrooms lore research — key quality is "liminal": spaces people pass *through*, not spaces they *inhabit*. Transitional, utilitarian, slightly wrong.

| Location ID | Name | Floor Color | Wall Color | Theme | Furniture |
|---|---|---|---|---|---|
| `store` | Furniture Store | `0x5c4a3a` | `0x7a6b5a` | Warm wood tones (existing) | Counter, shelves, couches, tables |
| `office` | Office Building | `0x5a5548` | `0x6a6558` | Beige carpet, fluorescents | Cubicle walls, desks, water cooler, filing cabinet |
| `garage` | Parking Garage | `0x4a4a4a` | `0x5a5a5a` | Concrete, fog, echoing | Concrete pillars, barrier rails, utility boxes |
| `hotel` | Hotel Lobby | `0x4a2a2a` | `0x6a4a3a` | Maroon carpet, dark wood | Reception desk, potted plants, armchairs, luggage rack |
| `laundromat` | Laundromat | `0x485058` | `0x586068` | Blue-white fluorescent | Washing machines, folding tables, plastic chairs, vending machine |

### Architecture: New Pure Module `locations.js`

- `src/systems/locations.js` — pure functions for location definitions and layouts
- `LOCATIONS` array: `{ id, name, floorColor, wallColor, furniture: [...], description }`
- `getLocation(locationId)` — returns location data by ID
- `getLocationLayout(locationId, roomX, roomY, roomWidth, roomHeight, wallThickness)` — returns furniture for that location (same signature as `generateStoreLayout`)
- `getLocationExitPosition(locationId, room, wallThickness)` — returns exit position for that location
- Each location's furniture array follows the `startroom.js` pattern: relative positions (`relX`, `relY`), spawn zone avoidance, bounds checking

### Alternate Exit Zone Design

- **Spawn location**: One per level, on a non-zero floor, in a random non-stair room
- **Spawn chance**: Seeded PRNG (seed offset +100000) — pick one eligible room, ~20% chance of spawning
- **Zone visual**: Glowing portal effect (pulsing colored glow, distinct from stairs/exit)
  - Blue-white color (0x88aaff) for otherworldly feel
  - 60x60 zone with pulsing alpha
- **On overlap**: Same pattern as onDayComplete — fade out, transition to ShopScene with `{ treasureEarned, usedAlternateExit: locationId }`
- **Only spawns if there are locations still to unlock**
- **Zone shows the location name** as a label (interaction prompt style)

### Persistence Changes

- Add `unlockedLocations` (array of location IDs, always includes `'store'`) to save data
- Add `activeLocation` (location ID string) to save data
- Bump SAVE_VERSION to 3 (backward compat: v2 saves default to `unlockedLocations: ['store']`, `activeLocation: 'store'`)
- Save when alternate exit is used (location unlocked)

### ShopScene Changes

- Show current starting location name below title
- If multiple locations unlocked, show left/right arrows to cycle (`<` and `>` buttons)
- Active location stored in registry, read by GameScene in `init()`
- Active location persisted in save data

### GameScene Integration Points

- `init()`: Read `activeLocation` from registry (default `'store'`)
- `drawRoom()`: Use location's colors for room 0 instead of hardcoded STORE colors
- `drawDoorways()`: Use location's floor color for room 0
- `createRoomFurniture()`: Use `getLocationLayout(locationId, ...)` for room 0
- `createExitZone()`: Use `getLocationExitPosition(locationId, ...)` for exit position
- `createAlternateExits()`: New method — create alternate exit zones on deeper floors
- `onAlternateExitComplete()`: New handler — unlock location, transition to shop
- `onDayComplete()`: Pass `usedAlternateExit: null` (or the locationId if alternate exit used)

### Edge Cases

- **All locations unlocked**: No alternate exit spawns (nothing to discover)
- **Player uses alternate exit on first run**: Next run starts from that location
- **Player dies after finding alternate exit but before using it**: Location not unlocked (must use the exit)
- **Multiple alternate exits per level**: Cap at 1 to keep it rare
- **Save backward compatibility**: v2 saves load with default `['store']` for unlockedLocations

### Seed Offset

- Alternate exits: +100000 (next available, well above existing +90000 for lore)
