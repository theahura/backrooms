import { describe, it, expect } from 'vitest';
import {
  createDoorStates,
  toggleDoor,
  getClosedDoorSegments,
  getDoorCenter,
  findNearestDoor,
  DOOR_INTERACT_RANGE,
} from '../doors.js';

function makeRoom(id, x, y, doors, targetOverrides = {}) {
  return {
    id,
    gridX: 0,
    gridY: 0,
    x,
    y,
    width: 1200,
    height: 1000,
    doors,
    seed: 42,
    ...targetOverrides,
  };
}

describe('createDoorStates', () => {
  it('creates closed doors that produce blocking segments', () => {
    const rooms = [
      makeRoom(0, 0, 0, [{ wall: 'east', offset: 200, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
    ];

    const states = createDoorStates(rooms, 42);
    const segments = getClosedDoorSegments(states);

    expect(segments.length).toBeGreaterThan(0);
  });

  it('deduplicates paired doors — one state per connection', () => {
    const rooms = [
      makeRoom(0, 0, 0, [
        { wall: 'east', offset: 200, width: 80, targetRoomId: 1 },
        { wall: 'south', offset: 300, width: 80, targetRoomId: 2 },
      ]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
      makeRoom(2, 0, 1000, [{ wall: 'north', offset: 300, width: 80, targetRoomId: 0 }]),
    ];

    const states = createDoorStates(rooms, 99);

    const connections = states.map(s => [s.roomId, s.targetRoomId].sort().join('-'));
    const uniqueConnections = new Set(connections);
    expect(connections.length).toBe(uniqueConnections.size);
  });

  it('produces different closable assignments with different seeds', () => {
    const rooms = [
      makeRoom(0, 0, 0, [
        { wall: 'east', offset: 200, width: 80, targetRoomId: 1 },
        { wall: 'south', offset: 300, width: 80, targetRoomId: 2 },
        { wall: 'south', offset: 500, width: 80, targetRoomId: 3 },
        { wall: 'east', offset: 400, width: 80, targetRoomId: 4 },
      ]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
      makeRoom(2, 0, 1000, [{ wall: 'north', offset: 300, width: 80, targetRoomId: 0 }]),
      makeRoom(3, 0, 1000, [{ wall: 'north', offset: 500, width: 80, targetRoomId: 0 }]),
      makeRoom(4, 1200, 0, [{ wall: 'west', offset: 400, width: 80, targetRoomId: 0 }]),
    ];

    const states1 = createDoorStates(rooms, 1);
    const states2 = createDoorStates(rooms, 9999);

    const walls1 = states1.map(s => `${s.roomId}-${s.wall}`).sort();
    const walls2 = states2.map(s => `${s.roomId}-${s.wall}`).sort();

    expect(walls1).not.toEqual(walls2);
  });

  it('computes correct segment for a north door', () => {
    const rooms = [
      makeRoom(0, 100, 200, [{ wall: 'north', offset: 300, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 100, -800, [{ wall: 'south', offset: 300, width: 80, targetRoomId: 0 }]),
    ];

    const states = createDoorStates(rooms, 2);
    const northDoor = states.find(s => s.wall === 'north');
    expect(northDoor).toBeDefined();
    expect(northDoor.segment).toEqual({ x1: 400, y1: 200, x2: 480, y2: 200 });
  });

  it('computes correct segment for a south door', () => {
    const rooms = [
      makeRoom(0, 100, 200, [{ wall: 'south', offset: 300, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 100, 1200, [{ wall: 'north', offset: 300, width: 80, targetRoomId: 0 }]),
    ];

    const states = createDoorStates(rooms, 2);
    const southDoor = states.find(s => s.wall === 'south');
    expect(southDoor).toBeDefined();
    expect(southDoor.segment).toEqual({ x1: 480, y1: 1200, x2: 400, y2: 1200 });
  });

  it('computes correct segment for an east door', () => {
    const rooms = [
      makeRoom(0, 100, 200, [{ wall: 'east', offset: 300, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 1300, 200, [{ wall: 'west', offset: 300, width: 80, targetRoomId: 0 }]),
    ];

    const states = createDoorStates(rooms, 2);
    const eastDoor = states.find(s => s.wall === 'east');
    expect(eastDoor).toBeDefined();
    expect(eastDoor.segment).toEqual({ x1: 1300, y1: 500, x2: 1300, y2: 580 });
  });

  it('computes correct segment for a west door', () => {
    const rooms = [
      makeRoom(0, 100, 200, [{ wall: 'west', offset: 300, width: 80, targetRoomId: 1 }]),
      makeRoom(1, -1100, 200, [{ wall: 'east', offset: 300, width: 80, targetRoomId: 0 }]),
    ];

    const states = createDoorStates(rooms, 2);
    const westDoor = states.find(s => s.wall === 'west');
    expect(westDoor).toBeDefined();
    expect(westDoor.segment).toEqual({ x1: 100, y1: 580, x2: 100, y2: 500 });
  });

  it('closable doors start closed', () => {
    const rooms = [
      makeRoom(0, 0, 0, [{ wall: 'east', offset: 200, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
    ];

    const states = createDoorStates(rooms, 42);
    const closable = states.filter(s => s.isClosed !== undefined);
    for (const s of closable) {
      expect(s.isClosed).toBe(true);
    }
  });
});

describe('toggleDoor', () => {
  it('flips a closed door to open', () => {
    const rooms = [
      makeRoom(0, 0, 0, [{ wall: 'east', offset: 200, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
    ];
    const states = createDoorStates(rooms, 42);
    const doorId = states[0].id;

    const toggled = toggleDoor(states, doorId);
    const door = toggled.find(d => d.id === doorId);
    expect(door.isClosed).toBe(false);
  });

  it('flips an open door back to closed', () => {
    const rooms = [
      makeRoom(0, 0, 0, [{ wall: 'east', offset: 200, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
    ];
    const states = createDoorStates(rooms, 42);
    const doorId = states[0].id;

    const opened = toggleDoor(states, doorId);
    const closed = toggleDoor(opened, doorId);
    const door = closed.find(d => d.id === doorId);
    expect(door.isClosed).toBe(true);
  });

  it('does not mutate the original array', () => {
    const rooms = [
      makeRoom(0, 0, 0, [{ wall: 'east', offset: 200, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
    ];
    const states = createDoorStates(rooms, 42);
    const doorId = states[0].id;
    const originalClosed = states[0].isClosed;

    toggleDoor(states, doorId);
    expect(states[0].isClosed).toBe(originalClosed);
  });
});

describe('getClosedDoorSegments', () => {
  it('returns segments only for closed doors', () => {
    const rooms = [
      makeRoom(0, 0, 0, [
        { wall: 'east', offset: 200, width: 80, targetRoomId: 1 },
        { wall: 'south', offset: 300, width: 80, targetRoomId: 2 },
      ]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
      makeRoom(2, 0, 1000, [{ wall: 'north', offset: 300, width: 80, targetRoomId: 0 }]),
    ];

    const states = createDoorStates(rooms, 42);
    const closedCount = states.filter(s => s.isClosed).length;
    const segments = getClosedDoorSegments(states);

    expect(segments.length).toBe(closedCount);
  });

  it('returns empty array when all doors are open', () => {
    const rooms = [
      makeRoom(0, 0, 0, [{ wall: 'east', offset: 200, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
    ];

    let states = createDoorStates(rooms, 42);
    for (const s of states) {
      if (s.isClosed) {
        states = toggleDoor(states, s.id);
      }
    }

    expect(getClosedDoorSegments(states)).toEqual([]);
  });
});

describe('getDoorCenter', () => {
  it('returns center of a north door', () => {
    const rooms = [
      makeRoom(0, 100, 200, [{ wall: 'north', offset: 300, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 100, -800, [{ wall: 'south', offset: 300, width: 80, targetRoomId: 0 }]),
    ];
    const states = createDoorStates(rooms, 2);
    const door = states.find(s => s.wall === 'north');
    const center = getDoorCenter(door, rooms);

    expect(center.x).toBe(100 + 300 + 40);
    expect(center.y).toBe(200);
  });

  it('returns center of an east door', () => {
    const rooms = [
      makeRoom(0, 100, 200, [{ wall: 'east', offset: 300, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 1300, 200, [{ wall: 'west', offset: 300, width: 80, targetRoomId: 0 }]),
    ];
    const states = createDoorStates(rooms, 2);
    const door = states.find(s => s.wall === 'east');
    const center = getDoorCenter(door, rooms);

    expect(center.x).toBe(100 + 1200);
    expect(center.y).toBe(200 + 300 + 40);
  });

  it('returns center of a south door', () => {
    const rooms = [
      makeRoom(0, 100, 200, [{ wall: 'south', offset: 300, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 100, 1200, [{ wall: 'north', offset: 300, width: 80, targetRoomId: 0 }]),
    ];
    const states = createDoorStates(rooms, 2);
    const door = states.find(s => s.wall === 'south');
    const center = getDoorCenter(door, rooms);

    expect(center.x).toBe(100 + 300 + 40);
    expect(center.y).toBe(200 + 1000);
  });

  it('returns center of a west door', () => {
    const rooms = [
      makeRoom(0, 100, 200, [{ wall: 'west', offset: 300, width: 80, targetRoomId: 1 }]),
      makeRoom(1, -1100, 200, [{ wall: 'east', offset: 300, width: 80, targetRoomId: 0 }]),
    ];
    const states = createDoorStates(rooms, 2);
    const door = states.find(s => s.wall === 'west');
    const center = getDoorCenter(door, rooms);

    expect(center.x).toBe(100);
    expect(center.y).toBe(200 + 300 + 40);
  });
});

describe('findNearestDoor', () => {
  it('returns nearest door when player is within range', () => {
    const rooms = [
      makeRoom(0, 0, 0, [{ wall: 'east', offset: 200, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
    ];
    const states = createDoorStates(rooms, 42);
    const door = states[0];
    const center = getDoorCenter(door, rooms);

    const found = findNearestDoor(states, rooms, center.x, center.y, DOOR_INTERACT_RANGE);
    expect(found).not.toBeNull();
    expect(found.id).toBe(door.id);
  });

  it('returns null when no door is within range', () => {
    const rooms = [
      makeRoom(0, 0, 0, [{ wall: 'east', offset: 200, width: 80, targetRoomId: 1 }]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
    ];
    const states = createDoorStates(rooms, 42);

    const found = findNearestDoor(states, rooms, 500, 500, DOOR_INTERACT_RANGE);
    expect(found).toBeNull();
  });

  it('returns the closest door when multiple are in range', () => {
    const rooms = [
      makeRoom(0, 0, 0, [
        { wall: 'east', offset: 200, width: 80, targetRoomId: 1 },
        { wall: 'east', offset: 400, width: 80, targetRoomId: 2 },
      ]),
      makeRoom(1, 1200, 0, [{ wall: 'west', offset: 200, width: 80, targetRoomId: 0 }]),
      makeRoom(2, 1200, 0, [{ wall: 'west', offset: 400, width: 80, targetRoomId: 0 }]),
    ];
    const states = createDoorStates(rooms, 42);

    expect(states.length).toBeGreaterThanOrEqual(2);

    const center0 = getDoorCenter(states[0], rooms);
    const center1 = getDoorCenter(states[1], rooms);

    const found = findNearestDoor(states, rooms, center0.x, center0.y, 500);
    expect(found.id).toBe(states[0].id);
  });
});
