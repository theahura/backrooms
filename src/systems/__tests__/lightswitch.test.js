import { describe, it, expect } from 'vitest';
import {
  createSwitchStates,
  toggleSwitch,
  findNearestSwitch,
  getLitRoomIds,
  isPointInRoom,
  SWITCH_INTERACT_RANGE,
} from '../lightswitch.js';

const WALL_THICKNESS = 16;

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
