# Noridoc: systems

Path: @/src/systems

### Overview
- Pure functions implementing game math: player movement, 2D raycasting visibility, room wall geometry, multi-room level generation, furniture/obstacle placement, enemy spawning/AI, and seeded random number generation
- Deliberately free of Phaser dependencies so they can be unit-tested in Node without a browser
- Tests live in `@/src/systems/__tests__/`

### How it fits into the larger codebase
- `@/src/scenes/GameScene.js` imports and calls all system modules during scene creation and on every frame during `update()`
- At scene start, `GameScene` calls `generateLevel()` from `level.js`, which internally calls `createRoomWalls()` from `room.js` for each room. The returned `{ rooms, wallSegments }` structure drives all subsequent setup (rendering, physics, furniture, enemies)
- Furniture segments from `furniture.js` are appended to the level's wall segments array so the visibility system treats them identically to walls
- Movement system output (`{x, y}` velocity) is passed directly to `player.setVelocity()`
- Visibility system output (polygon as `{x, y}` point array) is drawn into a Phaser Graphics object used as a BitmapMask to punch a hole in the darkness overlay
- Enemy system (`enemy.js`) reuses `raySegmentIntersection` from `visibility.js` for line-of-sight checks and `mulberry32` from `random.js` for deterministic spawning -- it follows the same pure-function, segment-based integration pattern as furniture
- The dependency flow is: `level.js` calls `room.js` to produce wall segments -> `GameScene` adds furniture segments from `furniture.js` -> all segments are concatenated into a single array -> `visibility.js` and `enemy.js` both consume this segment array for raycasting

### Core Implementation
- **Level generation** (`@/src/systems/level.js`): `generateLevel(seed, roomCount)` places rooms on a grid using a seeded growth algorithm. Starting from room 0 at grid position (0,0), each subsequent room picks a random existing room, picks a random cardinal direction, and places a new room in the adjacent grid cell if it is empty. Paired doorways are added to both rooms at the same wall offset. Returns `{ rooms, wallSegments }` where `wallSegments` is the flattened array of all room wall segments (with door gaps). This is a pure function -- no Phaser dependency
- **Room geometry** (`@/src/systems/room.js`): `createRoomWalls(x, y, width, height, doors)` returns line segments forming a rectangular boundary with gaps for doorways. When `doors` is empty or omitted, it returns four simple wall segments (backward-compatible). When doors are present, each wall is split into sub-segments around the door gaps by `splitWall()`. Segments maintain clockwise winding order -- south and west walls are reversed via `reverseSegments()` so endpoint connectivity is preserved
- **Random** (`@/src/systems/random.js`): exports `mulberry32(seed)` which returns a stateful function that produces deterministic floats in [0, 1). Used by `level.js`, `furniture.js`, and `enemy.js`
- **Movement** (`@/src/systems/movement.js`): `calculateVelocity(keys, speed)` takes a key-state object and speed scalar, returns `{x, y}` velocity. Normalizes diagonal movement to match cardinal speed
- **Furniture** (`@/src/systems/furniture.js`): `generateRoomFurniture()` uses a seeded PRNG to place furniture items within a room's inner bounds, enforcing no-overlap with 20px padding. `createFurnitureSegments()` produces four `{x1,y1,x2,y2}` segments per furniture item in the same format as wall segments
- **Enemy spawning and AI** (`@/src/systems/enemy.js`): `generateRoomEnemies()` places 1-2 enemies per room using seeded PRNG (room 0 is always empty -- it is the player spawn room). `hasLineOfSight()` casts a single ray from enemy to player against the wall segment array to determine visibility. `updateEnemyAI()` is a pure state machine (idle/chase/search) that takes current enemy state and returns updated state with new velocity -- GameScene applies the returned velocity to physics bodies
- **Visibility / raycasting** (`@/src/systems/visibility.js`): `getFlashlightPolygon(origin, angle, coneAngle, segments)` casts rays toward every segment endpoint (plus tiny offset angles to peek around corners), finds closest intersections, clips to a cone, and returns a polygon. `getVisibilityPolygon()` is the full 360-degree version. Also exports `raySegmentIntersection()` which is reused by `enemy.js` for LOS checks

### Things to Know
- **Segment format is the universal integration contract**: any system that produces `{x1, y1, x2, y2}` segments can participate in both the visibility/raycasting pipeline and enemy LOS checks with zero changes. Walls, furniture, and any future obstacles all share this format
- **Door pairing invariant**: when `level.js` connects two rooms, both rooms receive a door entry at the same `offset` and `width` on their shared wall. The parent gets `{ wall: 'east', offset, width, targetRoomId }` and the child gets the corresponding `{ wall: 'west', offset, width, targetRoomId }`. This ensures the gaps in adjacent rooms' walls align perfectly, allowing flashlight rays and player movement to pass through
- **Room coordinates are grid-based**: room pixel position is `gridX * ROOM_WIDTH` and `gridY * ROOM_HEIGHT`, so adjacent rooms share edges exactly. The level generator uses `ROOM_WIDTH = 1200` and `ROOM_HEIGHT = 1000` with `DOOR_WIDTH = 80`
- **Enemy AI state machine** (idle -> chase -> search -> idle): idle enemies wander randomly and transition to chase on LOS; chasing enemies pursue at 80px/s and transition to search when LOS breaks (recording last known player position); searching enemies walk to the last known position at 30px/s and revert to idle on arrival or after a 3-second timeout. Any state transitions to chase if LOS is reacquired
- **Enemy and furniture placement share the same retry pattern**: both attempt `count * 20` random placements and discard candidates that overlap existing objects. Fewer items may be placed than requested if the room is crowded
- `mulberry32` was extracted from `furniture.js` into `random.js` so that `level.js` and `enemy.js` could also use a seeded PRNG. All modules import from the same source to avoid duplication

Created and maintained by Nori.
