# Current Progress

## Status: Multi-Room Level Generation Complete

The game now generates multiple connected rooms with doorways. The player can walk between rooms, and the flashlight illuminates through doorways into adjacent rooms.

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
- 42 unit tests covering movement, raycasting, visibility, room generation, furniture, level generation, and flashlight-through-doorway integration
- Documentation (docs.md files for root, src, systems, scenes)

## Architecture
- `src/systems/` — Pure functions (movement, visibility/raycasting, room, furniture, level, random) — testable without Phaser
- `src/scenes/` — Phaser scene classes that wire systems together for rendering
- Darkness uses BitmapMask with invertAlpha on a Graphics overlay
- Furniture segments use the same `{x1,y1,x2,y2}` format as walls — concatenated into `wallSegments` for raycasting with zero visibility code changes
- Level generation uses a growth algorithm on a logical grid — rooms placed in adjacent cells, connected via paired doorways
- Doorways are gaps in wall segments — the visibility system naturally handles light passing through without any changes

## Next Steps
- Add enemies (zombies with line-of-sight AI)
- Implement flashlight battery drain and day/exit cycle
- Add items and inventory system
- Implement shooting mechanics
- Add shop/upgrade system between runs
- Add starting room (furniture store with crack in wall)
- Add closable doors to some room connections
- Add light switches that prevent enemy spawning
