# Current Progress

## Status: Furniture/Obstacles Complete

The room now contains furniture (tables, shelves, desks, bookcases) that cast shadows in the flashlight and block player movement. The player navigates around obstacles in a dark room.

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
- 25 unit tests covering movement, raycasting, visibility, room generation, and furniture system
- Documentation (docs.md files for root, src, systems, scenes)

## Architecture
- `src/systems/` — Pure functions (movement, visibility/raycasting, room, furniture) — testable without Phaser
- `src/scenes/` — Phaser scene classes that wire systems together for rendering
- Darkness uses BitmapMask with invertAlpha on a Graphics overlay
- Furniture segments use the same `{x1,y1,x2,y2}` format as walls — concatenated into `wallSegments` for raycasting with zero visibility code changes

## Next Steps
- Implement multiple connected rooms with doorways
- Add enemies (zombies with line-of-sight AI)
- Implement flashlight battery drain and day/exit cycle
- Add items and inventory system
- Implement shooting mechanics
- Add shop/upgrade system between runs
- Add starting room (furniture store with crack in wall)
