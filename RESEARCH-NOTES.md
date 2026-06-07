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
