# Noridoc: systems

Path: @/src/systems

### Overview
- Pure functions implementing game math: player movement, 2D raycasting visibility, room wall geometry, and furniture/obstacle placement
- Deliberately free of Phaser dependencies so they can be unit-tested in Node without a browser
- Tests live in `@/src/systems/__tests__/`

### How it fits into the larger codebase
- `@/src/scenes/GameScene.js` imports and calls all system modules during scene creation and on every frame during `update()`
- Movement system output (`{x, y}` velocity) is passed directly to `player.setVelocity()`
- Room and furniture systems both produce segments as `{x1, y1, x2, y2}` objects -- these serve dual purpose: Phaser Arcade Physics static bodies for collision AND raycasting segments for the visibility system
- Visibility system output (polygon as `{x, y}` point array) is drawn into a Phaser Graphics object used as a BitmapMask to punch a hole in the darkness overlay
- The dependency flow is: `room.js` + `furniture.js` produce segments -> all segments are concatenated into a single array -> `visibility.js` consumes segments + player position -> `GameScene` renders the result

### Core Implementation
- **Movement** (`@/src/systems/movement.js`): `calculateVelocity(keys, speed)` takes a key-state object `{up, down, left, right}` and a speed scalar, returns `{x, y}` velocity. Normalizes diagonal movement so it matches cardinal speed (prevents faster diagonal movement)
- **Room geometry** (`@/src/systems/room.js`): `createRoomWalls(x, y, width, height)` returns four line segments forming a closed rectangular boundary. Segments are ordered clockwise: top, right, bottom, left. Each endpoint connects to the next segment's start point
- **Furniture** (`@/src/systems/furniture.js`): two main exports:
  - `createFurnitureSegments(x, y, width, height)` -- produces four `{x1,y1,x2,y2}` line segments forming a closed rectangle (same format as wall segments, so the visibility system handles them identically)
  - `generateRoomFurniture(roomX, roomY, roomWidth, roomHeight, wallThickness, seed)` -- uses a seeded PRNG (mulberry32) to deterministically place furniture items within the room's inner bounds, enforcing no-overlap with 20px padding between items
- **Visibility / raycasting** (`@/src/systems/visibility.js`): implements the "Sight and Light" 2D visibility algorithm:
  1. `getVisibilityPolygon(origin, segments)` -- casts rays toward every segment endpoint plus tiny offset angles (plus/minus 0.00001 radians) to peek around corners, finds the closest intersection for each ray, sorts hits by angle to form a visibility polygon
  2. `getFlashlightPolygon(origin, angle, coneAngle, segments)` -- computes the full visibility polygon then clips it to a cone defined by `angle` (center direction) and `coneAngle` (half-width). Also casts rays along the cone's left and right edges to find their wall intersections, adds the origin point, deduplicates, and sorts by angle
  3. `raySegmentIntersection(ray, segment)` -- parametric ray-segment intersection test returning `{x, y, t}` or null. `t` is the ray parameter (distance along ray direction)

### Things to Know
- **Segment format is the universal integration contract**: any system that produces `{x1, y1, x2, y2}` segments can participate in the visibility/raycasting pipeline with zero changes to `visibility.js`. Furniture leverages this by producing segments in the same format as walls
- The visibility algorithm casts three rays per segment endpoint (the endpoint angle, plus two tiny offsets) to handle the corner-peeking problem where a ray landing exactly on a corner would miss the space behind it
- `getFlashlightPolygon` adds the player origin as a polygon point with angle `angle + PI` (opposite the aim direction) -- this ensures the polygon always closes back to the player position, creating a proper fan shape
- `normalizeAngle` wraps angles to [-PI, PI] range; `isAngleInCone` uses this to correctly handle cones that straddle the -PI/+PI boundary
- The `raySegmentIntersection` function rejects parallel rays (denominator near zero), rays pointing away from the segment (t1 < 0), and intersections outside the segment bounds (t2 < 0 or t2 > 1)
- **Furniture placement uses a retry-based algorithm**: it attempts `count * 20` placements and discards any candidate that overlaps an already-placed item (with 20px padding). This means fewer items may be placed than requested if the room is small or densely packed
- Furniture items carry a `canHide` boolean flag (tables and desks are hideable, shelves and bookcases are not) for future hiding mechanics -- this flag is not yet consumed by any game logic

Created and maintained by Nori.
