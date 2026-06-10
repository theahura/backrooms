// Coordinate-keyed, deterministic, unbounded room generation.
//
// The world is an infinite grid of rooms. Everything about the room at grid
// cell (gx, gy) -- its content seed and its four doors -- derives from a hash
// of (floorSeed, gx, gy), so a room is identical regardless of when or in what
// order it is generated, and adjacent cells always agree on the door they
// share. This lets GameScene generate rooms lazily (a few cells ahead of the
// player) while they stay static once generated, with no fixed room count.

export const ROOM_WIDTH = 720;
export const ROOM_HEIGHT = 600;
export const DOOR_WIDTH = 80;
const DOOR_MIN_OFFSET = 100;

// Above the 2D bond-percolation threshold (0.5) so the open-door graph forms a
// single richly connected infinite cluster -- the player is never boxed in.
const DOOR_PROB = 0.62;
const STAIR_PROB = 0.08;

function hashU32(seed, gx, gy, salt) {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ ((gx | 0) + 0x85ebca6b), 0xcc9e2d51);
  h = Math.imul(h ^ ((gy | 0) + 0x165667b1), 0x1b873593);
  h = Math.imul(h ^ ((salt | 0) + 0xd3a2646c), 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}

function roomId(gx, gy) {
  return `${gx},${gy}`;
}

export function localDistance(gx, gy) {
  return Math.abs(gx) + Math.abs(gy);
}

// A door on the east side of (gx,gy) is the same physical opening as the west
// side of (gx+1,gy); both are decided here so they always agree.
//
// The store at (0,0) has exactly one opening into the backrooms: the rift in
// its east wall. Its other three edges are always sealed.
function eastEdgeOpen(seed, gx, gy) {
  if (gx === 0 && gy === 0) return true; // the rift
  if (gx === -1 && gy === 0) return false; // store west wall
  return hashU32(seed, gx, gy, 1) % 1000 < DOOR_PROB * 1000;
}

function southEdgeOpen(seed, gx, gy) {
  if (gx === 0 && (gy === 0 || gy === -1)) return false; // store south/north walls
  return hashU32(seed, gx, gy, 2) % 1000 < DOOR_PROB * 1000;
}

// The rift is the same physical opening seen from either room: the store's
// east door and the first backroom's west door.
export function isRiftDoor(room, door) {
  if (room.gridX === 0 && room.gridY === 0 && door.wall === 'east') return true;
  if (room.gridX === 1 && room.gridY === 0 && door.wall === 'west') return true;
  return false;
}

function eastEdgeOffset(seed, gx, gy) {
  const max = ROOM_HEIGHT - DOOR_MIN_OFFSET - DOOR_WIDTH;
  return DOOR_MIN_OFFSET + (hashU32(seed, gx, gy, 3) % (max - DOOR_MIN_OFFSET + 1));
}

function southEdgeOffset(seed, gx, gy) {
  const max = ROOM_WIDTH - DOOR_MIN_OFFSET - DOOR_WIDTH;
  return DOOR_MIN_OFFSET + (hashU32(seed, gx, gy, 4) % (max - DOOR_MIN_OFFSET + 1));
}

export function getRoomAt(seed, gx, gy) {
  const doors = [];

  if (eastEdgeOpen(seed, gx, gy)) {
    doors.push({ wall: 'east', offset: eastEdgeOffset(seed, gx, gy), width: DOOR_WIDTH, targetRoomId: roomId(gx + 1, gy) });
  }
  if (eastEdgeOpen(seed, gx - 1, gy)) {
    doors.push({ wall: 'west', offset: eastEdgeOffset(seed, gx - 1, gy), width: DOOR_WIDTH, targetRoomId: roomId(gx - 1, gy) });
  }
  if (southEdgeOpen(seed, gx, gy)) {
    doors.push({ wall: 'south', offset: southEdgeOffset(seed, gx, gy), width: DOOR_WIDTH, targetRoomId: roomId(gx, gy + 1) });
  }
  if (southEdgeOpen(seed, gx, gy - 1)) {
    doors.push({ wall: 'north', offset: southEdgeOffset(seed, gx, gy - 1), width: DOOR_WIDTH, targetRoomId: roomId(gx, gy - 1) });
  }

  return {
    id: roomId(gx, gy),
    gridX: gx,
    gridY: gy,
    x: gx * ROOM_WIDTH,
    y: gy * ROOM_HEIGHT,
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    doors,
    seed: hashU32(seed, gx, gy, 0),
  };
}

function neighborCoords(gx, gy, wall) {
  if (wall === 'east') return [gx + 1, gy];
  if (wall === 'west') return [gx - 1, gy];
  if (wall === 'north') return [gx, gy - 1];
  return [gx, gy + 1]; // south
}

export function roomsWithinRadius(seed, cx, cy, radius) {
  const start = getRoomAt(seed, cx, cy);
  const seen = new Map([[start.id, start]]);
  let frontier = [start];

  for (let depth = 0; depth < radius; depth++) {
    const next = [];
    for (const room of frontier) {
      for (const door of room.doors) {
        const [ngx, ngy] = neighborCoords(room.gridX, room.gridY, door.wall);
        const neighbor = getRoomAt(seed, ngx, ngy);
        if (!seen.has(neighbor.id)) {
          seen.set(neighbor.id, neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }

  return [...seen.values()];
}

export function hasStairDown(seed, gx, gy) {
  if (gx === 0 && gy === 0) return false;
  return hashU32(seed, gx, gy, 5) % 1000 < STAIR_PROB * 1000;
}
