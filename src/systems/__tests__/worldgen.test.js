import { describe, it, expect } from 'vitest';
import {
  getRoomAt,
  roomsWithinRadius,
  hasStairDown,
  localDistance,
  isRiftDoor,
  ROOM_WIDTH,
  ROOM_HEIGHT,
} from '../worldgen.js';

const doorOn = (room, wall) => room.doors.find((d) => d.wall === wall);

describe('getRoomAt determinism', () => {
  it('returns an identical room for the same seed and coords regardless of when it is generated', () => {
    const a = getRoomAt(42, 3, -2);
    const b = getRoomAt(42, 3, -2);
    expect(b).toEqual(a);
  });

  it('places the room at the grid-derived world position', () => {
    const room = getRoomAt(1, 4, -3);
    expect(room.x).toBe(4 * ROOM_WIDTH);
    expect(room.y).toBe(-3 * ROOM_HEIGHT);
    expect(room.gridX).toBe(4);
    expect(room.gridY).toBe(-3);
  });
});

describe('neighbor door agreement', () => {
  it('east/west and north/south doors between adjacent cells always agree on existence and offset', () => {
    for (const seed of [1, 7, 9999]) {
      for (let gx = -3; gx <= 3; gx++) {
        for (let gy = -3; gy <= 3; gy++) {
          const room = getRoomAt(seed, gx, gy);
          const east = getRoomAt(seed, gx + 1, gy);
          const south = getRoomAt(seed, gx, gy + 1);

          const eDoor = doorOn(room, 'east');
          const wDoor = doorOn(east, 'west');
          expect(Boolean(eDoor)).toBe(Boolean(wDoor));
          if (eDoor) expect(eDoor.offset).toBe(wDoor.offset);

          const sDoor = doorOn(room, 'south');
          const nDoor = doorOn(south, 'north');
          expect(Boolean(sDoor)).toBe(Boolean(nDoor));
          if (sDoor) expect(sDoor.offset).toBe(nDoor.offset);
        }
      }
    }
  });

  it('doors reference the correct neighbor room id', () => {
    const room = getRoomAt(5, 2, 2);
    const eDoor = doorOn(room, 'east');
    if (eDoor) expect(eDoor.targetRoomId).toBe(getRoomAt(5, 3, 2).id);
    const nDoor = doorOn(room, 'north');
    if (nDoor) expect(nDoor.targetRoomId).toBe(getRoomAt(5, 2, 1).id);
  });
});

describe('entrance guarantees', () => {
  it('the entrance room (0,0) always has an east door so the crack/entry is consistent', () => {
    for (const seed of [1, 2, 3, 100, 5000]) {
      expect(doorOn(getRoomAt(seed, 0, 0), 'east')).toBeTruthy();
    }
  });
});

describe('roomsWithinRadius', () => {
  it('radius 0 yields only the center room', () => {
    const rooms = roomsWithinRadius(3, 0, 0, 0);
    expect(rooms.map((r) => r.id)).toEqual([getRoomAt(3, 0, 0).id]);
  });

  it('radius 1 yields the center plus exactly its door-connected neighbors', () => {
    const center = getRoomAt(3, 0, 0);
    const rooms = roomsWithinRadius(3, 0, 0, 1);
    const ids = new Set(rooms.map((r) => r.id));
    expect(ids.has(center.id)).toBe(true);
    expect(rooms.length).toBe(1 + center.doors.length);
    for (const door of center.doors) {
      expect(ids.has(door.targetRoomId)).toBe(true);
    }
  });

  it('radius 2 is a connected superset of radius 1', () => {
    const r1 = new Set(roomsWithinRadius(8, 1, 1, 1).map((r) => r.id));
    const r2 = roomsWithinRadius(8, 1, 1, 2);
    const r2ids = new Set(r2.map((r) => r.id));
    for (const id of r1) expect(r2ids.has(id)).toBe(true);
    expect(r2.length).toBeGreaterThanOrEqual(r1.size);
  });
});

describe('deep-link stairs', () => {
  it('is deterministic and never places a down-stair on the entrance', () => {
    expect(hasStairDown(5, 0, 0)).toBe(false);
    expect(hasStairDown(5, 4, 1)).toBe(hasStairDown(5, 4, 1));
  });

  it('places stairs sparsely but not nowhere across a region', () => {
    let count = 0;
    let total = 0;
    for (let gx = -10; gx <= 10; gx++) {
      for (let gy = -10; gy <= 10; gy++) {
        total++;
        if (hasStairDown(123, gx, gy)) count++;
      }
    }
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(total / 2);
  });
});

describe('unbounded generation', () => {
  it('generates well-formed far-away rooms deterministically', () => {
    const room = getRoomAt(77, 500, -500);
    expect(room.gridX).toBe(500);
    expect(room.doors.every((d) => d.width > 0 && d.offset >= 0)).toBe(true);
    expect(localDistance(500, -500)).toBe(1000);
  });
});

describe('per-seed variation', () => {
  it('produces materially different layouts for different seeds', () => {
    const signature = (seed) =>
      Array.from({ length: 49 }, (_, i) => {
        const gx = (i % 7) - 3;
        const gy = Math.floor(i / 7) - 3;
        return getRoomAt(seed, gx, gy).doors.length;
      }).join(',');
    expect(signature(1)).not.toBe(signature(2));
  });
});

describe('single entrance to the backrooms', () => {
  it('the store (0,0) has exactly one door: the east rift', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const room = getRoomAt(seed, 0, 0);
      expect(room.doors, `seed ${seed}`).toHaveLength(1);
      expect(room.doors[0].wall).toBe('east');
    }
  });

  it('no neighbor opens into the store except through the rift', () => {
    for (const seed of [1, 7, 42, 1234]) {
      expect(getRoomAt(seed, -1, 0).doors.some(d => d.targetRoomId === '0,0')).toBe(false);
      expect(getRoomAt(seed, 0, -1).doors.some(d => d.targetRoomId === '0,0')).toBe(false);
      expect(getRoomAt(seed, 0, 1).doors.some(d => d.targetRoomId === '0,0')).toBe(false);
      expect(getRoomAt(seed, 1, 0).doors.some(d => d.targetRoomId === '0,0')).toBe(true);
    }
  });

  it('isRiftDoor identifies the rift from both sides of the opening', () => {
    const store = getRoomAt(5, 0, 0);
    const east = store.doors.find(d => d.wall === 'east');
    expect(isRiftDoor(store, east)).toBe(true);

    const firstBackroom = getRoomAt(5, 1, 0);
    const west = firstBackroom.doors.find(d => d.wall === 'west');
    expect(isRiftDoor(firstBackroom, west)).toBe(true);

    const other = getRoomAt(5, 3, 2);
    for (const d of other.doors) {
      expect(isRiftDoor(other, d)).toBe(false);
    }
  });
});
