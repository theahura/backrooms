# Current Progress

## Status: Core Foundation Complete

The project scaffolding and core gameplay loop are implemented. A player can walk around a dark room with a flashlight as their only light source.

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
- 17 unit tests covering movement, raycasting, visibility polygon, and room generation
- Documentation (docs.md files for root, src, systems, scenes)

## Architecture
- `src/systems/` — Pure functions (movement, visibility/raycasting, room) — testable without Phaser
- `src/scenes/` — Phaser scene classes that wire systems together for rendering
- Darkness uses BitmapMask with invertAlpha on a Graphics overlay

## Next Steps
- Add room furniture/obstacles (tables, shelves) that block flashlight rays and provide hiding spots
- Implement multiple connected rooms with doorways
- Add enemies (zombies with line-of-sight AI)
- Implement flashlight battery drain and day/exit cycle
- Add items and inventory system
- Implement shooting mechanics
- Add shop/upgrade system between runs
- Add starting room (furniture store with crack in wall)
