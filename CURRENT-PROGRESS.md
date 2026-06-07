# Current Progress

## Status: Zombie Enemy System Complete

The game now has zombie enemies that spawn in rooms, chase the player when they have line-of-sight, and wander randomly when they can't see the player. Enemies are hidden by the darkness/flashlight system and collide with walls, furniture, and each other.

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
- 59 unit tests covering movement, raycasting, visibility, room generation, furniture, level generation, enemy spawning, LOS detection, and AI state machine
- Documentation (docs.md files for root, src, systems, scenes)

## Architecture
- `src/systems/` — Pure functions (movement, visibility/raycasting, room, furniture, level, random, enemy) — testable without Phaser
- `src/scenes/` — Phaser scene classes that wire systems together for rendering
- Darkness uses BitmapMask with invertAlpha on a Graphics overlay
- Furniture segments use the same `{x1,y1,x2,y2}` format as walls — concatenated into `wallSegments` for raycasting with zero visibility code changes
- Level generation uses a growth algorithm on a logical grid — rooms placed in adjacent cells, connected via paired doorways
- Doorways are gaps in wall segments — the visibility system naturally handles light passing through without any changes
- Enemy LOS reuses `raySegmentIntersection` from visibility.js — single ray from enemy to player, checked against wall segments
- Enemy AI is a pure function state machine — takes state in, returns updated state with velocity

## Next Steps
- Implement flashlight battery drain and day/exit cycle
- Add items and inventory system
- Implement shooting mechanics
- Add player health/damage system (currently just camera shake on contact)
- Add shop/upgrade system between runs
- Add starting room (furniture store with crack in wall)
- Add closable doors to some room connections
- Add light switches that prevent enemy spawning
- Add hiding mechanics (interact with canHide furniture to become invisible to enemies)
