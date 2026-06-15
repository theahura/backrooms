import { mulberry32 } from './random.js';
import { generateLevel } from './level.js';

export const FLOOR_Y_OFFSET = 10000;
export const STAIR_SIZE = 60;
export const STAIR_MARGIN = 100;
export const FLOOR_ROOM_COUNTS = [4, 3];

// The stair is a fixed square centered in the room (margin inset on every side).
// Centering it -- rather than searching for a clear spot -- keeps the
// stair-landing math (see getStairLandingPosition, which lands the player
// relative to the room center) valid. Rooms with a stair instead carve their
// maze walls away from this square (see stairKeepOut) so the stair is never
// inside a wall.
export function getStairTopLeft(room, stairSize = STAIR_SIZE, margin = STAIR_MARGIN) {
  const innerW = room.width - 2 * margin;
  return {
    x: room.x + margin + (innerW - stairSize) / 2,
    y: room.y + margin + (room.height - 2 * margin - stairSize) / 2,
  };
}

// Where the player materializes after using a stair: horizontally centered,
// dropped below the centered stair so re-entry does not instantly re-fire the
// stair overlap (which would bounce the player between floors). Single-sourced
// here and in GameScene.onStairEnter.
export const STAIR_LANDING_DROP = STAIR_SIZE + 80;

export function getStairLandingPosition(room) {
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2 + STAIR_LANDING_DROP,
  };
}

// A square keep-out around the landing point -- passed to the maze and furniture
// generators (like stairKeepOut) so nothing spawns where the player lands.
export function stairLandingKeepOut(room, size = STAIR_SIZE) {
  const { x, y } = getStairLandingPosition(room);
  return {
    x: x - size / 2,
    y: y - size / 2,
    width: size,
    height: size,
  };
}

// The stair's footprint inflated by `padding` on every side -- passed to
// generateMazeWalls as a keep-out zone so walls give the stair breathing room.
export function stairKeepOut(room, stairSize = STAIR_SIZE, margin = STAIR_MARGIN, padding = 0) {
  const { x, y } = getStairTopLeft(room, stairSize, margin);
  return {
    x: x - padding,
    y: y - padding,
    width: stairSize + 2 * padding,
    height: stairSize + 2 * padding,
  };
}

// Enemies within this radius of the stair landing are pushed out the moment the
// player materializes after a transition -- the spec's "limitation on enemies
// ... being near stairs ... even when the player cannot see the character yet."
// The spawn keep-out only stops enemies spawning ON the landing; enemies move, so
// one can wander next to the landing and attack the instant the arrival
// invulnerability expires. Sized to exceed the LARGEST enemy attack range
// (spitter projectiles, 250px in enemy.js) so even a ranged enemy is out of range
// on arrival -- not just contact range -- while staying under the 300px detection
// range so relocated enemies remain a threat once the player advances. Tuned by
// playtest.
export const STAIR_LANDING_SAFE_RADIUS = 280;

// The walkable interior box of a room (same inset generateRoomEnemies uses:
// wall thickness + a 40px margin), used to clamp relocated enemies so they never
// land in the wall band.
const ENEMY_SPAWN_MARGIN = 40;
export function roomInteriorBounds(room, wallThickness, margin = ENEMY_SPAWN_MARGIN) {
  return {
    minX: room.x + wallThickness + margin,
    minY: room.y + wallThickness + margin,
    maxX: room.x + room.width - wallThickness - margin,
    maxY: room.y + room.height - wallThickness - margin,
  };
}

// Project `point` onto the circle of radius `radius` centered at `center`, along
// the center->point ray. When the point coincides with the center the direction
// is undefined, so fall back to straight below (deterministic, never NaN).
export function pushOutsideRadius(center, point, radius) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { x: center.x, y: center.y + radius };
  const scale = radius / dist;
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

function farthestCorner(from, bounds) {
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.maxY },
  ];
  let best = corners[0];
  let bestDist = -1;
  for (const c of corners) {
    const d = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

// Relocate an enemy out of the landing safe zone. Enemies already outside the
// radius are returned unchanged. Otherwise push radially out to the radius and
// clamp into the room interior; if the room is too small in that direction (the
// clamped point is still inside the zone) fall back to the interior corner
// farthest from the landing -- the most separation the room allows.
export function relocateEnemyFromLanding(enemyPos, landing, bounds, radius = STAIR_LANDING_SAFE_RADIUS) {
  const dx = enemyPos.x - landing.x;
  const dy = enemyPos.y - landing.y;
  if (dx * dx + dy * dy >= radius * radius) return { x: enemyPos.x, y: enemyPos.y };

  const pushed = pushOutsideRadius(landing, enemyPos, radius);
  const clamped = {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, pushed.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, pushed.y)),
  };

  // The radial push lands at exactly the radius. If it is already inside the
  // room (no clamping), use it -- it keeps the enemy on its own bearing instead
  // of flinging it across the room. Only when clamping pulls the point back
  // inside the safe zone (room too small in that direction) do we need a fallback.
  if (clamped.x === pushed.x && clamped.y === pushed.y) return clamped;

  const cdx = clamped.x - landing.x;
  const cdy = clamped.y - landing.y;
  if (cdx * cdx + cdy * cdy >= radius * radius) return clamped;

  return farthestCorner(landing, bounds);
}

export function getFloorRoomCounts(runCount) {
  if (runCount >= 4) return [4, 3, 3, 2];
  if (runCount >= 2) return [4, 3, 3];
  return [4, 3];
}

export function generateMultiFloorLevel(seed, floorRoomCounts) {
  const allRooms = [];
  const allSegments = [];
  let roomIdOffset = 0;

  for (let floor = 0; floor < floorRoomCounts.length; floor++) {
    const floorSeed = seed + floor * 1000;
    const { rooms, wallSegments } = generateLevel(floorSeed, floorRoomCounts[floor]);

    const offsetY = floor * FLOOR_Y_OFFSET;

    for (const room of rooms) {
      room.id += roomIdOffset;
      room.y += offsetY;
      room.floor = floor;
      for (const door of room.doors) {
        door.targetRoomId += roomIdOffset;
      }
    }

    for (const seg of wallSegments) {
      seg.y1 += offsetY;
      seg.y2 += offsetY;
    }

    allRooms.push(...rooms);
    allSegments.push(...wallSegments);
    roomIdOffset += rooms.length;
  }

  const stairs = createStairConnections(allRooms, seed);

  return { rooms: allRooms, wallSegments: allSegments, stairs };
}

function createStairConnections(rooms, seed) {
  const rand = mulberry32(seed + 50000);
  const floors = new Map();
  for (const room of rooms) {
    if (!floors.has(room.floor)) floors.set(room.floor, []);
    floors.get(room.floor).push(room);
  }

  const floorIndices = [...floors.keys()].sort((a, b) => a - b);
  const stairs = [];
  let stairId = 0;
  const roomStairCount = new Map();

  for (let i = 0; i < floorIndices.length - 1; i++) {
    const fromFloor = floorIndices[i];
    const toFloor = floorIndices[i + 1];
    let fromCandidates = floors.get(fromFloor);
    const toCandidates = floors.get(toFloor);

    if (fromFloor === 0) {
      fromCandidates = fromCandidates.filter(r => r.id !== 0);
    }

    if (fromCandidates.length === 0 || toCandidates.length === 0) continue;

    const targetCount = Math.min(2, fromCandidates.length, toCandidates.length);
    const usedFrom = new Set();
    const usedTo = new Set();

    for (let j = 0; j < targetCount; j++) {
      const availableFrom = fromCandidates.filter(r => !usedFrom.has(r.id));
      const availableTo = toCandidates.filter(r => !usedTo.has(r.id));
      if (availableFrom.length === 0 || availableTo.length === 0) break;

      const fromRoom = availableFrom[Math.floor(rand() * availableFrom.length)];
      const toRoom = availableTo[Math.floor(rand() * availableTo.length)];

      usedFrom.add(fromRoom.id);
      usedTo.add(toRoom.id);

      const fromIdx = roomStairCount.get(fromRoom.id) || 0;
      const toIdx = roomStairCount.get(toRoom.id) || 0;
      roomStairCount.set(fromRoom.id, fromIdx + 1);
      roomStairCount.set(toRoom.id, toIdx + 1);

      stairs.push({
        id: stairId++,
        fromRoomId: fromRoom.id,
        toRoomId: toRoom.id,
        fromPos: getStairPosition(fromRoom, fromIdx),
        toPos: getStairPosition(toRoom, toIdx),
        fromFloor,
        toFloor,
      });
    }
  }

  return stairs;
}

function getStairPosition(room, index) {
  const margin = 100;
  const innerW = room.width - 2 * margin;
  const cx = room.x + margin + (innerW - STAIR_SIZE) / 2;
  const cy = room.y + margin + (room.height - 2 * margin - STAIR_SIZE) / 2;
  const offset = (index || 0) * (STAIR_SIZE + 20);
  return { x: cx + offset, y: cy };
}

export function getFloorBounds(rooms, floor) {
  const floorRooms = rooms.filter(r => r.floor === floor);
  if (floorRooms.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  const minX = Math.min(...floorRooms.map(r => r.x));
  const minY = Math.min(...floorRooms.map(r => r.y));
  const maxX = Math.max(...floorRooms.map(r => r.x + r.width));
  const maxY = Math.max(...floorRooms.map(r => r.y + r.height));

  return { minX, minY, maxX, maxY };
}
