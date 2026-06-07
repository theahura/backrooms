# Noridoc: systems

Path: @/src/systems

### Overview
- Pure functions implementing game math: player movement, 2D raycasting visibility, and room wall geometry
- Deliberately free of Phaser dependencies so they can be unit-tested in Node without a browser
- Tests live in `@/src/systems/__tests__/`

### How it fits into the larger codebase
- `@/src/scenes/GameScene.js` imports and calls all three system modules every frame during `update()`
- Movement system output (`{x, y}` velocity) is passed directly to `player.setVelocity()`
- Room system output (wall segments as `{x1, y1, x2, y2}` objects) serves dual purpose: Phaser Arcade Physics static bodies for collision AND raycasting segments for the visibility system
- Visibility system output (polygon as `{x, y}` point array) is drawn into a Phaser Graphics object used as a BitmapMask to punch a hole in the darkness overlay
- The dependency flow is: `room.js` produces segments -> `visibility.js` consumes segments + player position -> `GameScene` renders the result

### Core Implementation
- **Movement** (`@/src/systems/movement.js`): `calculateVelocity(keys, speed)` takes a key-state object `{up, down, left, right}` and a speed scalar, returns `{x, y}` velocity. Normalizes diagonal movement so it matches cardinal speed (prevents faster diagonal movement)
- **Room geometry** (`@/src/systems/room.js`): `createRoomWalls(x, y, width, height)` returns four line segments forming a closed rectangular boundary. Segments are ordered clockwise: top, right, bottom, left. Each endpoint connects to the next segment's start point
- **Visibility / raycasting** (`@/src/systems/visibility.js`): implements the "Sight and Light" 2D visibility algorithm:
  1. `getVisibilityPolygon(origin, segments)` -- casts rays toward every segment endpoint plus tiny offset angles (plus/minus 0.00001 radians) to peek around corners, finds the closest intersection for each ray, sorts hits by angle to form a visibility polygon
  2. `getFlashlightPolygon(origin, angle, coneAngle, segments)` -- computes the full visibility polygon then clips it to a cone defined by `angle` (center direction) and `coneAngle` (half-width). Also casts rays along the cone's left and right edges to find their wall intersections, adds the origin point, deduplicates, and sorts by angle
  3. `raySegmentIntersection(ray, segment)` -- parametric ray-segment intersection test returning `{x, y, t}` or null. `t` is the ray parameter (distance along ray direction)

### Things to Know
- The visibility algorithm casts three rays per segment endpoint (the endpoint angle, plus two tiny offsets) to handle the corner-peeking problem where a ray landing exactly on a corner would miss the space behind it
- `getFlashlightPolygon` adds the player origin as a polygon point with angle `angle + PI` (opposite the aim direction) -- this ensures the polygon always closes back to the player position, creating a proper fan shape
- `normalizeAngle` wraps angles to [-PI, PI] range; `isAngleInCone` uses this to correctly handle cones that straddle the -PI/+PI boundary
- The `raySegmentIntersection` function rejects parallel rays (denominator near zero), rays pointing away from the segment (t1 < 0), and intersections outside the segment bounds (t2 < 0 or t2 > 1)
- Wall segments use a coordinate convention where `{x1, y1}` is the start and `{x2, y2}` is the end -- the closed-loop invariant (each segment's end matches the next segment's start) is validated in the room tests

Created and maintained by Nori.
