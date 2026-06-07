# Noridoc: scenes

Path: @/src/scenes

### Overview
- Phaser Scene subclasses that wire pure game systems to Phaser's rendering, physics, and input APIs
- Currently contains a single scene (`GameScene`) that implements the core gameplay loop

### How it fits into the larger codebase
- `@/src/main.js` registers scene classes with the Phaser.Game instance
- Scenes import pure functions from `@/src/systems/` for game math (movement, visibility, room geometry) and handle all Phaser-specific concerns: sprite creation, physics bodies, input binding, camera, and Graphics drawing
- Scenes are the only place in the codebase that depends on Phaser -- this boundary is intentional to keep game logic testable

### Core Implementation
- **GameScene lifecycle**: `create()` runs once when the scene starts, `update()` runs every frame
- **create() setup sequence**:
  1. `createRoom()` -- draws the room floor and walls as Graphics, creates Arcade Physics static bodies for wall collision, and generates wall segments via `createRoomWalls()` for the raycasting system
  2. `createFurniture()` -- generates furniture items via `generateRoomFurniture()`, renders them as filled rectangles, creates physics static bodies for collision, and appends furniture segments into `wallSegments` so they block flashlight rays
  3. `createPlayer()` -- creates a physics sprite (invisible, using `__DEFAULT` texture) with a 20x20 hitbox, plus a separate Graphics object for the visual player representation (green circle + directional triangle). Adds colliders against both `walls` and `furnitureGroup`
  4. `setupInput()` -- binds WASD keys via Phaser's keyboard API
  5. `setupCamera()` -- camera follows player with lerp 0.1, bounded to room dimensions
  6. `createDarknessOverlay()` -- creates the three-layer darkness system (see below)
- **update() frame loop**: reads WASD key state -> `calculateVelocity()` -> sets player physics velocity -> computes aim angle from mouse world position -> redraws player graphic at new position/rotation -> recomputes and redraws flashlight visibility polygon

### Things to Know
- **Darkness system architecture**: uses three Graphics objects with a BitmapMask:

  | Layer | Depth | Purpose |
  |-------|-------|---------|
  | `darkGraphics` | 100 | Black rectangle covering the room (the darkness) |
  | `lightGraphics` | 99 | Faint yellow tint drawn under the flashlight cone |
  | `maskGraphics` | off-screen | White flashlight polygon shape used as a BitmapMask |

  The BitmapMask has `invertAlpha = true`, so white pixels in `maskGraphics` punch transparent holes in `darkGraphics`, revealing the room beneath the flashlight cone
- **Wall dual-purpose**: `createRoom()` builds walls twice -- once as Phaser Arcade Physics static zones (for player collision) and once as line segments via `createRoomWalls()` (for raycasting). The physics walls use the full room bounds including wall thickness; the raycasting segments use the inner room bounds (inset by `WALL_THICKNESS` on all sides) so rays stop at the inner wall surface
- **Furniture integration**: `createFurniture()` follows the same dual-purpose pattern -- each furniture item becomes both a physics static zone (for collision) and a set of line segments (for raycasting). Furniture segments are pushed directly into the `wallSegments` array, so the visibility system treats them identically to walls. Furniture Graphics are rendered at depth 50 (below darkness at 100, so they appear only when illuminated)
- **Player rendering**: the player is a Graphics object (`playerGraphics`) drawn at depth 200 (above the darkness overlay at depth 100), so the player is always visible. The graphic rotates to face the mouse via `setRotation(playerAngle)`
- The darkness overlay and mask are redrawn from scratch every frame (`clear()` then redraw) -- there is no incremental update
- The furniture seed is currently hardcoded (42) -- same layout every time the scene loads

Created and maintained by Nori.
