import { describe, it, expect } from 'vitest';
import {
  createSwitchStates,
  toggleSwitch,
  findNearestSwitch,
  getLitRoomIds,
  isPointInRoom,
  computeSwitchPosition,
  chooseSwitchWall,
  SWITCH_INTERACT_RANGE,
  SWITCH_HALF_W,
  SWITCH_HALF_H,
} from '../lightswitch.js';

const WALL_THICKNESS = 16;

// The switch sprite footprint, derived from the module's own half-extents so the
// tests track the real sprite size rather than hardcoding it.
const switchFootprint = pos => ({
  x: pos.x - SWITCH_HALF_W, y: pos.y - SWITCH_HALF_H,
  width: SWITCH_HALF_W * 2, height: SWITCH_HALF_H * 2,
});
const rectsOverlap = (a, b) =>
  a.x < b.x + b.width && a.x + a.width > b.x &&
  a.y < b.y + b.height && a.y + a.height > b.y;

function makeRoom(id, x, y, overrides = {}) {
  return {
    id,
    gridX: 0,
    gridY: 0,
    x,
    y,
    width: 1200,
    height: 1000,
    doors: [],
    seed: 42,
    ...overrides,
  };
}

describe('createSwitchStates', () => {
  it('returns empty array for empty rooms', () => {
    expect(createSwitchStates([], 42, WALL_THICKNESS)).toEqual([]);
  });

  it('never places a switch in room 0', () => {
    const rooms = [makeRoom(0, 0, 0), makeRoom(1, 1200, 0), makeRoom(2, 2400, 0)];
    const states = createSwitchStates(rooms, 42, WALL_THICKNESS);
    expect(states.every(s => s.roomId !== 0)).toBe(true);
  });

  it('created switches start off and can be toggled on', () => {
    const rooms = [makeRoom(0, 0, 0), makeRoom(1, 1200, 0), makeRoom(2, 2400, 0),
      makeRoom(3, 0, 1000), makeRoom(4, 1200, 1000), makeRoom(5, 2400, 1000)];
    const states = createSwitchStates(rooms, 42, WALL_THICKNESS);

    expect(states.length).toBeGreaterThan(0);
    expect(getLitRoomIds(states)).toEqual([]);

    const toggled = toggleSwitch(states, states[0].id);
    expect(getLitRoomIds(toggled).length).toBe(1);
  });

  it('is deterministic — same seed produces same switches', () => {
    const rooms = [makeRoom(0, 0, 0), makeRoom(1, 1200, 0), makeRoom(2, 2400, 0),
      makeRoom(3, 0, 1000), makeRoom(4, 1200, 1000)];
    const a = createSwitchStates(rooms, 77, WALL_THICKNESS);
    const b = createSwitchStates(rooms, 77, WALL_THICKNESS);
    expect(a).toEqual(b);
  });

  it('produces different results with different seeds', () => {
    const rooms = [makeRoom(0, 0, 0), makeRoom(1, 1200, 0), makeRoom(2, 2400, 0),
      makeRoom(3, 0, 1000), makeRoom(4, 1200, 1000), makeRoom(5, 2400, 1000),
      makeRoom(6, 0, 2000), makeRoom(7, 1200, 2000), makeRoom(8, 2400, 2000)];
    const a = createSwitchStates(rooms, 1, WALL_THICKNESS);
    const b = createSwitchStates(rooms, 9999, WALL_THICKNESS);
    const aIds = a.map(s => s.roomId).sort();
    const bIds = b.map(s => s.roomId).sort();
    expect(aIds).not.toEqual(bIds);
  });

  it('places switch positions within room bounds', () => {
    const rooms = [makeRoom(0, 0, 0), makeRoom(1, 1200, 0), makeRoom(2, 2400, 0),
      makeRoom(3, 0, 1000), makeRoom(4, 1200, 1000)];
    const states = createSwitchStates(rooms, 42, WALL_THICKNESS);

    for (const s of states) {
      const room = rooms.find(r => r.id === s.roomId);
      expect(s.x).toBeGreaterThanOrEqual(room.x);
      expect(s.x).toBeLessThanOrEqual(room.x + room.width);
      expect(s.y).toBeGreaterThanOrEqual(room.y);
      expect(s.y).toBeLessThanOrEqual(room.y + room.height);
    }
  });
});

describe('computeSwitchPosition (door-aware)', () => {
  const W = WALL_THICKNESS;

  it('does not place a north-wall switch inside a centered north doorway', () => {
    const room = makeRoom(1, 0, 0, { doors: [{ wall: 'north', offset: 560, width: 80 }] });
    const pos = computeSwitchPosition(room, 'north', W);
    // switch x must be clear of the door gap [560, 640]
    expect(pos.x >= 560 && pos.x <= 640).toBe(false);
  });

  it('does not place an east-wall switch inside a centered east doorway', () => {
    const room = makeRoom(1, 0, 0, { doors: [{ wall: 'east', offset: 460, width: 80 }] });
    const pos = computeSwitchPosition(room, 'east', W);
    // switch y must be clear of the door gap [460, 540]
    expect(pos.y >= 460 && pos.y <= 540).toBe(false);
  });

  it('avoids every door gap when a wall has multiple doors', () => {
    const room = makeRoom(1, 0, 0, {
      doors: [
        { wall: 'south', offset: 200, width: 80 },
        { wall: 'south', offset: 700, width: 80 },
      ],
    });
    const pos = computeSwitchPosition(room, 'south', W);
    expect(pos.x >= 200 && pos.x <= 280).toBe(false);
    expect(pos.x >= 700 && pos.x <= 780).toBe(false);
  });

  it('keeps the switch flush against the chosen wall', () => {
    const room = makeRoom(1, 0, 0, { doors: [{ wall: 'north', offset: 560, width: 80 }] });
    const north = computeSwitchPosition(room, 'north', W);
    expect(north.y).toBeLessThan(room.y + 4 * W); // pinned near the north wall
    const west = computeSwitchPosition(room, 'west', W);
    expect(west.x).toBeLessThan(room.x + 4 * W); // pinned near the west wall
  });

  it('stays within the room bounds', () => {
    const room = makeRoom(1, 0, 0, { doors: [{ wall: 'north', offset: 560, width: 80 }] });
    const pos = computeSwitchPosition(room, 'north', W);
    expect(pos.x).toBeGreaterThanOrEqual(room.x);
    expect(pos.x).toBeLessThanOrEqual(room.x + room.width);
  });
});

describe('computeSwitchPosition (maze-aware)', () => {
  const W = WALL_THICKNESS;

  it('moves the switch off an interior maze wall that meets the chosen wall', () => {
    const room = makeRoom(1, 0, 0); // 1200x1000, no doors
    // Where the door-only placement would sit (wall centre).
    const bare = computeSwitchPosition(room, 'north', W);
    // A 16px-thick interior wall reaching the north perimeter right under it.
    const mazeRects = [{ x: bare.x - 8, y: room.y, width: 16, height: 200 }];

    // The buggy (maze-blind) placement overlaps the wall...
    expect(rectsOverlap(switchFootprint(bare), mazeRects[0])).toBe(true);
    // ...the maze-aware placement does not.
    const pos = computeSwitchPosition(room, 'north', W, mazeRects);
    expect(rectsOverlap(switchFootprint(pos), mazeRects[0])).toBe(false);
    expect(pos.y).toBe(bare.y); // still flush against the north wall
  });

  it('is byte-identical to the 3-arg call when no maze rects are supplied (back-compat)', () => {
    const room = makeRoom(1, 0, 0, { doors: [{ wall: 'north', offset: 560, width: 80 }] });
    expect(computeSwitchPosition(room, 'north', W, [])).toEqual(computeSwitchPosition(room, 'north', W));
    expect(computeSwitchPosition(room, 'east', W, [])).toEqual(computeSwitchPosition(room, 'east', W));
  });

  it('still avoids the door gap when both a door and a maze wall are present', () => {
    const room = makeRoom(1, 0, 0, { doors: [{ wall: 'north', offset: 200, width: 80 }] });
    const mazeRects = [{ x: 900, y: room.y, width: 16, height: 200 }];
    const pos = computeSwitchPosition(room, 'north', W, mazeRects);
    expect(pos.x >= 200 && pos.x <= 280).toBe(false); // clear of the door gap
    expect(rectsOverlap(switchFootprint(pos), mazeRects[0])).toBe(false); // clear of the maze wall
  });
});

describe('chooseSwitchWall', () => {
  const W = WALL_THICKNESS;

  it('skips the starting wall when an interior maze wall has buried it and picks a clear wall', () => {
    const room = makeRoom(1, 0, 0); // 1200x1000, no doors
    // A maze wall spanning the entire north mounting band -> north has no clear span.
    const mazeRects = [{ x: room.x, y: room.y, width: room.width, height: 40 }];
    const wall = chooseSwitchWall(room, W, mazeRects, 0); // start at 'north'
    expect(wall).not.toBe('north');
    // The switch placed on the chosen wall is clear of the maze wall.
    const pos = computeSwitchPosition(room, wall, W, mazeRects);
    expect(mazeRects.some(r => rectsOverlap(switchFootprint(pos), r))).toBe(false);
  });

  it('still returns one of the four walls when every wall is buried (graceful fallback)', () => {
    const room = makeRoom(1, 0, 0);
    const mazeRects = [
      { x: room.x, y: room.y, width: room.width, height: 40 },                       // north band
      { x: room.x, y: room.y + room.height - 40, width: room.width, height: 40 },    // south band
      { x: room.x, y: room.y, width: 40, height: room.height },                      // west band
      { x: room.x + room.width - 40, y: room.y, width: 40, height: room.height },    // east band
    ];
    const wall = chooseSwitchWall(room, W, mazeRects, 2);
    expect(['north', 'south', 'east', 'west']).toContain(wall);
  });
});

describe('createSwitchStates door avoidance', () => {
  it('never places a switch inside a door gap across many seeds', () => {
    const rooms = [];
    for (let i = 1; i <= 60; i++) {
      // Each room has a door centered on every wall -- the worst case for the
      // old midpoint placement.
      rooms.push({
        id: i, gridX: 0, gridY: 0, x: i * 1200, y: 0, width: 1200, height: 1000, seed: i,
        doors: [
          { wall: 'north', offset: 560, width: 80 },
          { wall: 'south', offset: 560, width: 80 },
          { wall: 'east', offset: 460, width: 80 },
          { wall: 'west', offset: 460, width: 80 },
        ],
      });
    }
    for (let seed = 1; seed <= 8; seed++) {
      const states = createSwitchStates(rooms, seed, WALL_THICKNESS);
      for (const s of states) {
        const room = rooms.find(r => r.id === s.roomId);
        for (const d of room.doors) {
          if (d.wall === 'north' || d.wall === 'south') {
            const onWall = d.wall === 'north'
              ? s.y < room.y + 40
              : s.y > room.y + room.height - 40;
            if (onWall) {
              expect(s.x >= room.x + d.offset && s.x <= room.x + d.offset + d.width).toBe(false);
            }
          } else {
            const onWall = d.wall === 'east'
              ? s.x > room.x + room.width - 40
              : s.x < room.x + 40;
            if (onWall) {
              expect(s.y >= room.y + d.offset && s.y <= room.y + d.offset + d.width).toBe(false);
            }
          }
        }
      }
    }
  });
});

describe('toggleSwitch', () => {
  it('toggles a switch on', () => {
    const states = [{ id: 0, roomId: 1, x: 100, y: 100, isOn: false }];
    const result = toggleSwitch(states, 0);
    expect(result[0].isOn).toBe(true);
  });

  it('toggles a switch off', () => {
    const states = [{ id: 0, roomId: 1, x: 100, y: 100, isOn: true }];
    const result = toggleSwitch(states, 0);
    expect(result[0].isOn).toBe(false);
  });

  it('does not mutate the original array', () => {
    const states = [{ id: 0, roomId: 1, x: 100, y: 100, isOn: false }];
    const result = toggleSwitch(states, 0);
    expect(states[0].isOn).toBe(false);
    expect(result[0].isOn).toBe(true);
    expect(result).not.toBe(states);
  });

  it('leaves non-matching switches unchanged', () => {
    const states = [
      { id: 0, roomId: 1, x: 100, y: 100, isOn: false },
      { id: 1, roomId: 2, x: 200, y: 200, isOn: true },
    ];
    const result = toggleSwitch(states, 0);
    expect(result[0].isOn).toBe(true);
    expect(result[1].isOn).toBe(true);
  });

  it('returns unchanged array when toggling non-existent id', () => {
    const states = [{ id: 0, roomId: 1, x: 100, y: 100, isOn: false }];
    const result = toggleSwitch(states, 999);
    expect(result[0].isOn).toBe(false);
  });
});

describe('findNearestSwitch', () => {
  it('returns nearest switch when player is within range', () => {
    const states = [{ id: 0, roomId: 1, x: 100, y: 100, isOn: false }];
    const result = findNearestSwitch(states, 110, 110, SWITCH_INTERACT_RANGE);
    expect(result).not.toBeNull();
    expect(result.id).toBe(0);
  });

  it('returns null when no switches in range', () => {
    const states = [{ id: 0, roomId: 1, x: 100, y: 100, isOn: false }];
    const result = findNearestSwitch(states, 500, 500, SWITCH_INTERACT_RANGE);
    expect(result).toBeNull();
  });

  it('returns closest when multiple switches in range', () => {
    const states = [
      { id: 0, roomId: 1, x: 100, y: 100, isOn: false },
      { id: 1, roomId: 2, x: 120, y: 100, isOn: false },
    ];
    const result = findNearestSwitch(states, 115, 100, SWITCH_INTERACT_RANGE);
    expect(result.id).toBe(1);
  });

  it('returns null for empty switch array', () => {
    const result = findNearestSwitch([], 100, 100, SWITCH_INTERACT_RANGE);
    expect(result).toBeNull();
  });
});

describe('getLitRoomIds', () => {
  it('returns empty array when no switches are on', () => {
    const states = [
      { id: 0, roomId: 1, x: 100, y: 100, isOn: false },
      { id: 1, roomId: 2, x: 200, y: 200, isOn: false },
    ];
    expect(getLitRoomIds(states)).toEqual([]);
  });

  it('returns roomIds of rooms with switches turned on', () => {
    const states = [
      { id: 0, roomId: 1, x: 100, y: 100, isOn: true },
      { id: 1, roomId: 2, x: 200, y: 200, isOn: false },
      { id: 2, roomId: 3, x: 300, y: 300, isOn: true },
    ];
    expect(getLitRoomIds(states)).toEqual([1, 3]);
  });

  it('returns correct set after toggling on and off', () => {
    let states = [
      { id: 0, roomId: 1, x: 100, y: 100, isOn: false },
      { id: 1, roomId: 2, x: 200, y: 200, isOn: false },
    ];
    states = toggleSwitch(states, 0);
    states = toggleSwitch(states, 1);
    expect(getLitRoomIds(states)).toEqual([1, 2]);

    states = toggleSwitch(states, 0);
    expect(getLitRoomIds(states)).toEqual([2]);
  });
});

describe('switch frequency', () => {
  it('places switches in approximately 15% of non-starting rooms', () => {
    const rooms = [];
    for (let i = 0; i < 101; i++) {
      rooms.push(makeRoom(i, i * 1200, 0));
    }
    let totalSwitches = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const states = createSwitchStates(rooms, seed, WALL_THICKNESS);
      totalSwitches += states.length;
    }
    const totalEligibleRooms = 100 * 10;
    const rate = totalSwitches / totalEligibleRooms;
    expect(rate).toBeGreaterThan(0.05);
    expect(rate).toBeLessThan(0.25);
  });
});

describe('isPointInRoom', () => {
  const room = makeRoom(1, 100, 200);

  it('returns true for point inside room', () => {
    expect(isPointInRoom(room, 500, 500)).toBe(true);
  });

  it('returns false for point outside room', () => {
    expect(isPointInRoom(room, 50, 50)).toBe(false);
    expect(isPointInRoom(room, 2000, 2000)).toBe(false);
  });

  it('returns true for point on room boundary', () => {
    expect(isPointInRoom(room, 100, 200)).toBe(true);
    expect(isPointInRoom(room, 1300, 1200)).toBe(true);
  });
});
