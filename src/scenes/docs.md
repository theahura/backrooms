# Noridoc: scenes

Path: @/src/scenes

### Overview
- Phaser Scene subclasses that wire pure game systems to Phaser's rendering, physics, and input APIs
- Currently contains a single scene (`GameScene`) that implements the core gameplay loop

### How it fits into the larger codebase
- `@/src/main.js` registers scene classes with the Phaser.Game instance
- Scenes import pure functions from `@/src/systems/` for game math (level generation, movement, visibility, room geometry, furniture) and handle all Phaser-specific concerns: sprite creation, physics bodies, input binding, camera, and Graphics drawing
- Scenes are the only place in the codebase that depends on Phaser -- this boundary is intentional to keep game logic testable
- `GameScene` consumes the output of `generateLevel()` from `@/src/systems/level.js` to set up the entire multi-room level at scene creation time

### Core Implementation
- **GameScene lifecycle**: `create()` runs once when the scene starts, `update()` runs every frame
- **create() setup sequence**:
  1. Calls `generateLevel(LEVEL_SEED, ROOM_COUNT)` to get the full level data (`rooms` array + `wallSegments`)
  2. `createRooms()` -- iterates over all rooms: draws each room's floor and walls, creates physics bodies (with door gaps), generates and renders furniture per room, then draws doorway floor tiles over wall graphics so doorways appear open
  3. `createPlayer()` -- spawns the player at the center of room 0
  4. `setupInput()` -- binds WASD keys
  5. `setupCamera()` -- computes the bounding box of all rooms, sets camera follow bounds and physics world bounds to cover the entire level
  6. `createDarknessOverlay()` -- creates the three-layer darkness system (see below)
- **update() frame loop**: reads WASD key state -> `calculateVelocity()` -> sets player physics velocity -> computes aim angle from mouse world position -> redraws player graphic at new position/rotation -> recomputes and redraws flashlight visibility polygon

### Things to Know
- **Darkness system architecture**: uses three Graphics objects with a BitmapMask:

  | Layer | Depth | Purpose |
  |-------|-------|---------|
  | `darkGraphics` | 100 | Black rectangle covering the entire level (the darkness) |
  | `lightGraphics` | 99 | Faint yellow tint drawn under the flashlight cone |
  | `maskGraphics` | off-screen | White flashlight polygon shape used as a BitmapMask |

  The BitmapMask has `invertAlpha = true`, so white pixels in `maskGraphics` punch transparent holes in `darkGraphics`, revealing the room beneath the flashlight cone
- **Multi-room physics with door gaps**: `createRoomPhysics()` splits each wall into physics zones that skip over door offsets. For each wall, if it has doors, the wall is broken into sub-zones before and after each door gap. This mirrors the raycasting segments produced by `createRoomWalls()` so that physics collision and flashlight occlusion agree on where doors are
- **Doorway rendering**: `drawDoorways()` paints room-floor-colored rectangles over wall graphics at door positions, visually opening the passages between rooms
- **Wall dual-purpose**: walls exist as both Phaser Arcade Physics static zones (for player collision) and as line segments from `createRoomWalls()` (for raycasting). Furniture follows the same pattern -- each item is both a physics zone and a set of raycasting segments
- **Player rendering**: the player is a Graphics object (`playerGraphics`) drawn at depth 200 (above the darkness overlay at depth 100), so the player is always visible regardless of flashlight direction
- The darkness overlay covers the full level bounding box (plus 100px margin) and is redrawn from scratch every frame
- Camera and physics bounds are computed dynamically from the level's room positions, so they adapt to however many rooms the level generator produces

Created and maintained by Nori.
