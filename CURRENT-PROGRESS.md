# Current Progress

## Status: Items & Inventory System Complete

The game now has collectible items and an inventory system. Rooms contain 2-5 items (batteries, copper/silver/gold coins, gems) spawned with seeded PRNG and weighted rarity. Auto-pickup on overlap. Batteries are stored and usable via right-click to recharge the flashlight (+30%). Treasure value accumulates for the future shop system. HUD shows health bar, battery bar, battery count, and treasure value.

## Completed
- Application spec written
- Project scaffolding: Phaser 3 + Vite + Vitest
- Player character (green circle with direction indicator) with WASD movement
- Mouse-based aiming (player/flashlight follows mouse cursor)
- Camera follows player with smooth lerp
- Single room with physics walls (player collides with walls)
- 2D raycasting visibility system (rays cast to wall segment endpoints)
- Flashlight cone (90-degree cone clipped from visibility polygon)
- Darkness overlay with BitmapMask (only flashlight area is visible)
- Player rendered above darkness layer (always visible)
- Room furniture/obstacles (tables, shelves, desks, bookcases) that block flashlight rays and provide physics collision
- Seeded PRNG for deterministic furniture placement (4-8 items per room, no overlaps)
- Furniture marked with `canHide` flag for future hiding mechanics
- Multi-room level generation with seeded growth algorithm (6 connected rooms)
- Doorways between rooms (gaps in wall segments that allow light and movement)
- Paired door system (if room A connects to room B, room B connects back)
- Room wall segments support door specifications (split segments with gaps)
- Shared seeded PRNG module (`random.js`) for deterministic level generation
- Camera and physics bounds dynamically computed from all room positions
- Each room gets its own furniture with a unique seed
- Zombie enemies with line-of-sight AI
  - LOS detection reuses `raySegmentIntersection` from visibility system (single ray from enemy to player)
  - Three-state AI: idle (wander randomly), chase (pursue player), search (go to last known position then give up)
  - 1-2 enemies spawn per room (except starting room), placed avoiding furniture with seeded PRNG
  - Enemy physics: dynamic group with wall/furniture/enemy colliders and player overlap detection
  - Enemies render at depth 60 (below darkness at 100) — automatically hidden by flashlight mask
  - Camera shake on player-enemy contact (placeholder for future damage system)
  - `generateTexture` creates red circle sprite for enemies
- Player health/damage system
  - 100 HP, 20 damage per enemy contact, 1 second invulnerability cooldown after hit
  - Camera shake + red flash on damage, player turns red/translucent during invulnerability
  - Death at 0 HP: camera fade to black, scene restart
  - HUD health bar (top-left, always visible above darkness)
- Shooting mechanics
  - Left-click fires yellow projectile bullets toward mouse cursor
  - Bullet speed 500, max range 600px, fire rate 200ms cooldown
  - Bullets collide with walls and furniture (destroyed on impact)
  - Bullets damage enemies (25 per hit, 2 shots to kill)
  - Object pooling via Phaser physics group (max 20 active bullets)
  - Bullets render at depth 150 (visible above darkness layer)
- Enemy health system
  - 50 HP per zombie, killed after 2 bullet hits
  - Dead enemies removed from physics and AI updates
- Flashlight battery drain system
  - 90-second full drain, battery depletes linearly over time
  - Flashlight cone angle scales from 100% to 25% of base as battery drains
  - Below 25% battery: deterministic sine-wave flickering effect
  - At 0% battery: flashlight dies completely (total darkness)
  - HUD battery bar below health bar (yellow > orange > red color transitions)
- Exit zone and day/exit cycle
  - Green exit marker in top-left of room 0 (starting room)
  - Overlap detection triggers day completion (camera fadeout + scene restart)
  - `dayEnding` flag freezes game state during exit transition
- Items and inventory system
  - 5 item types with weighted rarity: battery (15%), copper coin (40%), silver coin (25%), gold coin (15%), gem (5%)
  - Seeded PRNG spawning (seed + 20000 offset) with furniture overlap avoidance
  - 2-5 items per room, no items in room 0 (starting room)
  - Auto-pickup via overlap detection, items destroyed on contact
  - Inventory tracks battery count and treasure value total
  - Right-click uses a stored battery to recharge flashlight by 30%
  - Browser context menu disabled for right-click input
  - HUD shows battery count (yellow) and treasure value (gold) below the bars
  - Items render at depth 5 (hidden by darkness, only visible in flashlight)
  - Item textures generated once per type (rect for coins/batteries, triangle for gems)
- Battery recharge system
  - `rechargeBattery(state, amount)` restores flashlight charge, capped at max
  - Recharging a depleted battery restores functionality (resets isDepleted)
  - BATTERY_RECHARGE_AMOUNT = 30 (restores ~27 seconds of flashlight)
- 115 unit tests covering movement, raycasting, visibility, room generation, furniture, level generation, enemy spawning, LOS detection, AI state machine, combat, shooting, battery, items, and inventory
- Documentation (docs.md files for root, src, systems, scenes)

## Architecture
- `src/systems/` — Pure functions (movement, visibility/raycasting, room, furniture, level, random, enemy, items, inventory) — testable without Phaser
- `src/scenes/` — Phaser scene classes that wire systems together for rendering
- Darkness uses BitmapMask with invertAlpha on a Graphics overlay
- Furniture segments use the same `{x1,y1,x2,y2}` format as walls — concatenated into `wallSegments` for raycasting with zero visibility code changes
- Level generation uses a growth algorithm on a logical grid — rooms placed in adjacent cells, connected via paired doorways
- Doorways are gaps in wall segments — the visibility system naturally handles light passing through without any changes
- Enemy LOS reuses `raySegmentIntersection` from visibility.js — single ray from enemy to player, checked against wall segments
- Enemy AI is a pure function state machine — takes state in, returns updated state with velocity
- Combat/shooting/battery/inventory are pure function modules (`combat.js`, `shooting.js`, `battery.js`, `inventory.js`) — same architecture pattern as enemy/movement
- Items system (`items.js`) follows same spawning pattern as enemy.js: seeded PRNG, furniture overlap avoidance, skip room 0
- Player combat, battery, and inventory states are immutable objects; enemy health is a mutable field on the enemy state (asymmetry: player state is passed through pure functions, enemy health is mutated in-place in the scene callback)
- Item spawning uses seed offset +20000 (furniture: +0, enemies: +10000) to avoid correlation
- Bullet physics group uses Phaser's built-in pooling (`maxSize: 20`, `getFirstDead`)
- HUD uses `setScrollFactor(0)` at depth 1000 to stay fixed on screen above all game layers
- Battery feeds into flashlight rendering: `getFlashlightConeAngle()` scales the cone angle passed to `getFlashlightPolygon()` — no changes to the visibility system itself
- Exit zone uses Phaser's zone + overlap detection pattern (same as enemy contact)

## Next Steps
- Add shop/upgrade system between runs (trade valuables for upgrades)
- Add day-complete scoring/summary screen (show items collected, treasure earned)
- Add starting room (furniture store with crack in wall)
- Add closable doors to some room connections
- Add light switches that prevent enemy spawning
- Add hiding mechanics (interact with canHide furniture to become invisible to enemies)
- Add day-complete scoring/summary screen (currently just restarts)
- Add compass/map that fills in as the player explores
