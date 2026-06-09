import { describe, it, expect } from 'vitest';
import { getLightSpillZones, isDoorOpen, LIGHT_SPILL_DEPTH } from '../lightSpill.js';

function makeRoom(id, gridX, gridY, doors) {
  return {
    id,
    gridX,
    gridY,
    x: gridX * 1200,
    y: gridY * 1000,
    width: 1200,
    height: 1000,
    doors,
    seed: 42 + id,
  };
}

describe('isDoorOpen', () => {
  it('returns true when no matching doorState exists (permanently open)', () => {
    expect(isDoorOpen(0, 1, [])).toBe(true);
  });

  it('returns false when matching doorState is closed', () => {
    const doorStates = [
      { id: 0, roomId: 0, targetRoomId: 1, isClosed: true },
    ];
    expect(isDoorOpen(0, 1, doorStates)).toBe(false);
  });

  it('returns true when matching doorState is open', () => {
    const doorStates = [
      { id: 0, roomId: 0, targetRoomId: 1, isClosed: false },
    ];
    expect(isDoorOpen(0, 1, doorStates)).toBe(true);
  });

  it('finds door state regardless of which room ID is passed first', () => {
    const doorStates = [
      { id: 0, roomId: 0, targetRoomId: 1, isClosed: true },
    ];
    expect(isDoorOpen(1, 0, doorStates)).toBe(false);
  });
});

describe('getLightSpillZones', () => {
  it('returns empty array when no rooms are lit', () => {
    const rooms = [makeRoom(0, 0, 0, [])];
    expect(getLightSpillZones(rooms, [], [])).toEqual([]);
  });

  it('produces a spill zone for an open door to a dark room', () => {
    const rooms = [
      makeRoom(0, 0, 0, [
        { wall: 'east', offset: 200, width: 80, targetRoomId: 1 },
      ]),
      makeRoom(1, 1, 0, [
        { wall: 'west', offset: 200, width: 80, targetRoomId: 0 },
      ]),
    ];
    const zones = getLightSpillZones(rooms, [0], []);
    expect(zones.length).toBe(1);
    expect(zones[0].x).toBe(0 + 1200);
    expect(zones[0].y).toBe(0 + 200);
    expect(zones[0].width).toBe(LIGHT_SPILL_DEPTH);
    expect(zones[0].height).toBe(80);
  });

  it('produces no spill zone when the door is closed', () => {
    const rooms = [
      makeRoom(0, 0, 0, [
        { wall: 'east', offset: 200, width: 80, targetRoomId: 1 },
      ]),
      makeRoom(1, 1, 0, [
        { wall: 'west', offset: 200, width: 80, targetRoomId: 0 },
      ]),
    ];
    const doorStates = [
      { id: 0, roomId: 0, targetRoomId: 1, isClosed: true },
    ];
    const zones = getLightSpillZones(rooms, [0], doorStates);
    expect(zones.length).toBe(0);
  });

  it('produces no spill when both rooms are lit', () => {
    const rooms = [
      makeRoom(0, 0, 0, [
        { wall: 'east', offset: 200, width: 80, targetRoomId: 1 },
      ]),
      makeRoom(1, 1, 0, [
        { wall: 'west', offset: 200, width: 80, targetRoomId: 0 },
      ]),
    ];
    const zones = getLightSpillZones(rooms, [0, 1], []);
    expect(zones.length).toBe(0);
  });

  it('produces multiple zones for multiple open doors to dark rooms', () => {
    const rooms = [
      makeRoom(0, 0, 0, [
        { wall: 'east', offset: 200, width: 80, targetRoomId: 1 },
        { wall: 'south', offset: 300, width: 80, targetRoomId: 2 },
      ]),
      makeRoom(1, 1, 0, [
        { wall: 'west', offset: 200, width: 80, targetRoomId: 0 },
      ]),
      makeRoom(2, 0, 1, [
        { wall: 'north', offset: 300, width: 80, targetRoomId: 0 },
      ]),
    ];
    const zones = getLightSpillZones(rooms, [0], []);
    expect(zones.length).toBe(2);
  });

  it('north wall door spills upward with correct gradient direction', () => {
    const rooms = [
      makeRoom(0, 0, 1, [
        { wall: 'north', offset: 400, width: 80, targetRoomId: 1 },
      ]),
      makeRoom(1, 0, 0, [
        { wall: 'south', offset: 400, width: 80, targetRoomId: 0 },
      ]),
    ];
    const zones = getLightSpillZones(rooms, [0], []);
    expect(zones.length).toBe(1);
    const z = zones[0];
    expect(z.x).toBe(0 + 400);
    expect(z.y).toBe(1000 - LIGHT_SPILL_DEPTH);
    expect(z.width).toBe(80);
    expect(z.height).toBe(LIGHT_SPILL_DEPTH);
    expect(z.alphas.topLeft).toBe(0);
    expect(z.alphas.bottomLeft).toBe(1);
  });

  it('south wall door spills downward with correct gradient direction', () => {
    const rooms = [
      makeRoom(0, 0, 0, [
        { wall: 'south', offset: 400, width: 80, targetRoomId: 1 },
      ]),
      makeRoom(1, 0, 1, [
        { wall: 'north', offset: 400, width: 80, targetRoomId: 0 },
      ]),
    ];
    const zones = getLightSpillZones(rooms, [0], []);
    const z = zones[0];
    expect(z.x).toBe(0 + 400);
    expect(z.y).toBe(0 + 1000);
    expect(z.width).toBe(80);
    expect(z.height).toBe(LIGHT_SPILL_DEPTH);
    expect(z.alphas.topLeft).toBe(1);
    expect(z.alphas.bottomLeft).toBe(0);
  });

  it('east wall door spills rightward with correct gradient direction', () => {
    const rooms = [
      makeRoom(0, 0, 0, [
        { wall: 'east', offset: 300, width: 80, targetRoomId: 1 },
      ]),
      makeRoom(1, 1, 0, [
        { wall: 'west', offset: 300, width: 80, targetRoomId: 0 },
      ]),
    ];
    const zones = getLightSpillZones(rooms, [0], []);
    const z = zones[0];
    expect(z.x).toBe(0 + 1200);
    expect(z.y).toBe(0 + 300);
    expect(z.width).toBe(LIGHT_SPILL_DEPTH);
    expect(z.height).toBe(80);
    expect(z.alphas.topLeft).toBe(1);
    expect(z.alphas.topRight).toBe(0);
    expect(z.alphas.bottomLeft).toBe(1);
    expect(z.alphas.bottomRight).toBe(0);
  });

  it('west wall door spills leftward with correct gradient direction', () => {
    const rooms = [
      makeRoom(0, 1, 0, [
        { wall: 'west', offset: 300, width: 80, targetRoomId: 1 },
      ]),
      makeRoom(1, 0, 0, [
        { wall: 'east', offset: 300, width: 80, targetRoomId: 0 },
      ]),
    ];
    const zones = getLightSpillZones(rooms, [0], []);
    const z = zones[0];
    expect(z.x).toBe(1200 - LIGHT_SPILL_DEPTH);
    expect(z.y).toBe(0 + 300);
    expect(z.width).toBe(LIGHT_SPILL_DEPTH);
    expect(z.height).toBe(80);
    expect(z.alphas.topLeft).toBe(0);
    expect(z.alphas.topRight).toBe(1);
    expect(z.alphas.bottomLeft).toBe(0);
    expect(z.alphas.bottomRight).toBe(1);
  });

  it('skips lit room IDs that do not match any room', () => {
    expect(getLightSpillZones([], [999], [])).toEqual([]);
  });
});
