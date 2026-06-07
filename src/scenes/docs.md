# Noridoc: scenes

Path: @/src/scenes

### Overview
- Phaser Scene subclasses that wire pure game systems to Phaser's rendering, physics, and input APIs
- Currently contains a single scene (`GameScene`) that implements the core gameplay loop including player movement, flashlight/darkness, and enemy AI

### How it fits into the larger codebase
- `@/src/main.js` registers scene classes with the Phaser.Game instance
- Scenes import pure functions from `@/src/systems/` for game math (level generation, movement, visibility, room geometry, furniture, enemy AI) and handle all Phaser-specific concerns: sprite creation, physics bodies, input binding, camera, and Graphics drawing
- Scenes are the only place in the codebase that depends on Phaser -- this boundary is intentional to keep game logic testable
- `GameScene` consumes the output of `generateLevel()` from `@/src/systems/level.js` to set up the entire multi-room level at scene creation time
- `GameScene` calls `generateRoomEnemies()` from `@/src/systems/enemy.js` at creation and `updateEnemyAI()` every frame, bridging the pure AI state machine to Phaser physics bodies

### Core Implementation
- **GameScene lifecycle**: `create()` runs once when the scene starts, `update()` runs every frame
- **create() setup sequence**:
  1. Calls `generateLevel(LEVEL_SEED, ROOM_COUNT)` to get the full level data (`rooms` array + `wallSegments`)
  2. `createRooms()` -- iterates over all rooms: draws each room's floor and walls, creates physics bodies (with door gaps), generates and renders furniture per room, then draws doorway floor tiles over wall graphics so doorways appear open
  3. `createPlayer()` -- spawns the player at the center of room 0
  4. `createEnemies()` -- generates a procedural enemy texture, spawns enemies in all rooms except room 0, sets up enemy physics group with colliders against walls/furniture/other enemies, and creates a player overlap trigger
  5. `setupInput()` -- binds WASD keys
  6. `setupCamera()` -- computes the bounding box of all rooms, sets camera follow bounds and physics world bounds to cover the entire level
  7. `createDarknessOverlay()` -- creates the three-layer darkness system (see below)
- **update() frame loop**: reads WASD key state -> `calculateVelocity()` -> sets player physics velocity -> computes aim angle from mouse world position -> `updateEnemies(delta)` runs the AI state machine for every enemy and applies returned velocities -> redraws player graphic -> recomputes and redraws flashlight visibility polygon
- **Enemy integration pattern**: `GameScene` maintains a parallel `enemyStates` array alongside the Phaser physics sprites in `enemyGroup`. Each frame, `updateEnemies()` syncs sprite positions into the state objects, calls the pure `updateEnemyAI()` function, copies the returned state back, and applies velocity to the sprite. This keeps the AI logic testable in `@/src/systems/enemy.js` while letting Phaser handle physics resolution

### Things to Know
- **Depth layering order** controls what is visible through the darkness:

  | Layer | Depth | Purpose |
  |-------|-------|---------|
  | furniture graphics | 50 | Furniture rendered below enemies |
  | enemy sprites | 60 | Enemies hidden by darkness (below mask) |
  | `lightGraphics` | 99 | Faint yellow tint drawn under the flashlight cone |
  | `darkGraphics` | 100 | Black rectangle covering the entire level (the darkness) |
  | `playerGraphics` | 200 | Player always visible (above darkness) |

  Because enemies render at depth 60 (below darkness at 100), they are automatically hidden by the darkness overlay and only revealed when the flashlight cone reaches them
- **Darkness system architecture**: the BitmapMask has `invertAlpha = true`, so white pixels in `maskGraphics` punch transparent holes in `darkGraphics`, revealing the room beneath the flashlight cone
- **Enemy physics uses a dynamic group** (unlike walls and furniture which are static groups). Enemies collide with walls, furniture, and each other. Player-enemy interaction uses `overlap` (not `collider`), triggering `onEnemyContact()` which currently shakes the camera
- **Multi-room physics with door gaps**: `createRoomPhysics()` splits each wall into physics zones that skip over door offsets. This mirrors the raycasting segments produced by `createRoomWalls()` so that physics collision and flashlight occlusion agree on where doors are
- **Wall dual-purpose**: walls exist as both Phaser Arcade Physics static zones (for player collision) and as line segments from `createRoomWalls()` (for raycasting). Furniture follows the same pattern -- each item is both a physics zone and a set of raycasting segments. Enemies do not produce segments; they are dynamic actors, not static occluders
- **Player rendering**: the player is a Graphics object (`playerGraphics`) drawn at depth 200 (above the darkness overlay at depth 100), so the player is always visible regardless of flashlight direction
- Camera and physics bounds are computed dynamically from the level's room positions, so they adapt to however many rooms the level generator produces

Created and maintained by Nori.
