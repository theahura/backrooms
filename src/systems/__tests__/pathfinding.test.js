import { describe, it, expect } from 'vitest';
import {
  buildRoomGraph,
  bfsFromRoom,
  getNextDoorway,
  getDoorwayCenter,
  getRoomDistance,
} from '../pathfinding.js';

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

function makeLinearRooms() {
  return [
    makeRoom(0, 0, 0, [
      { wall: 'east', offset: 200, width: 80, targetRoomId: 1 },
    ]),
    makeRoom(1, 1, 0, [
      { wall: 'west', offset: 200, width: 80, targetRoomId: 0 },
      { wall: 'east', offset: 300, width: 80, targetRoomId: 2 },
    ]),
    makeRoom(2, 2, 0, [
      { wall: 'west', offset: 300, width: 80, targetRoomId: 1 },
    ]),
  ];
}

describe('buildRoomGraph', () => {
  it('returns correct adjacency for a 3-room linear chain', () => {
    const rooms = makeLinearRooms();
    const graph = buildRoomGraph(rooms, []);

    expect(graph.get(0).length).toBe(1);
    expect(graph.get(0)[0].targetRoomId).toBe(1);
    expect(graph.get(1).length).toBe(2);
    expect(graph.get(2).length).toBe(1);
    expect(graph.get(2)[0].targetRoomId).toBe(1);
  });

  it('excludes edges through closed doors', () => {
    const rooms = makeLinearRooms();
    const doorStates = [
      { id: 0, roomId: 0, targetRoomId: 1, wall: 'east', offset: 200, width: 80, isClosed: true, segment: {} },
    ];

    const graph = buildRoomGraph(rooms, doorStates);

    expect(graph.get(0).length).toBe(0);
    expect(graph.get(1).length).toBe(1);
    expect(graph.get(1)[0].targetRoomId).toBe(2);
  });

  it('includes edges when closable door is open', () => {
    const rooms = makeLinearRooms();
    const doorStates = [
      { id: 0, roomId: 0, targetRoomId: 1, wall: 'east', offset: 200, width: 80, isClosed: false, segment: {} },
    ];

    const graph = buildRoomGraph(rooms, doorStates);

    expect(graph.get(0).length).toBe(1);
    expect(graph.get(0)[0].targetRoomId).toBe(1);
  });

  it('includes doorway world positions in adjacency entries', () => {
    const rooms = makeLinearRooms();
    const graph = buildRoomGraph(rooms, []);

    const edge = graph.get(0)[0];
    expect(edge.doorway).toBeDefined();
    expect(typeof edge.doorway.x).toBe('number');
    expect(typeof edge.doorway.y).toBe('number');
  });
});

describe('bfsFromRoom', () => {
  it('returns cameFrom map for a linear chain', () => {
    const rooms = makeLinearRooms();
    const graph = buildRoomGraph(rooms, []);
    const cameFrom = bfsFromRoom(graph, 0);

    expect(cameFrom.get(1)).toBe(0);
    expect(cameFrom.get(2)).toBe(1);
  });

  it('handles branching graph', () => {
    const rooms = [
      makeRoom(0, 0, 0, [
        { wall: 'east', offset: 200, width: 80, targetRoomId: 1 },
        { wall: 'south', offset: 200, width: 80, targetRoomId: 2 },
      ]),
      makeRoom(1, 1, 0, [
        { wall: 'west', offset: 200, width: 80, targetRoomId: 0 },
      ]),
      makeRoom(2, 0, 1, [
        { wall: 'north', offset: 200, width: 80, targetRoomId: 0 },
      ]),
    ];
    const graph = buildRoomGraph(rooms, []);
    const cameFrom = bfsFromRoom(graph, 0);

    expect(cameFrom.get(1)).toBe(0);
    expect(cameFrom.get(2)).toBe(0);
  });

  it('does not include unreachable rooms', () => {
    const rooms = makeLinearRooms();
    const doorStates = [
      { id: 0, roomId: 0, targetRoomId: 1, wall: 'east', offset: 200, width: 80, isClosed: true, segment: {} },
    ];
    const graph = buildRoomGraph(rooms, doorStates);
    const cameFrom = bfsFromRoom(graph, 0);

    expect(cameFrom.has(1)).toBe(false);
    expect(cameFrom.has(2)).toBe(false);
  });
});

describe('getNextDoorway', () => {
  it('returns the doorway to the next room toward the player', () => {
    const rooms = makeLinearRooms();
    const graph = buildRoomGraph(rooms, []);
    const cameFrom = bfsFromRoom(graph, 0);

    const doorway = getNextDoorway(rooms, graph, cameFrom, 2, 0);

    expect(doorway).not.toBeNull();
    expect(typeof doorway.x).toBe('number');
    expect(typeof doorway.y).toBe('number');
  });

  it('returns null when enemy is already in the player room', () => {
    const rooms = makeLinearRooms();
    const graph = buildRoomGraph(rooms, []);
    const cameFrom = bfsFromRoom(graph, 0);

    const doorway = getNextDoorway(rooms, graph, cameFrom, 0, 0);

    expect(doorway).toBeNull();
  });

  it('returns null when no path exists', () => {
    const rooms = makeLinearRooms();
    const doorStates = [
      { id: 0, roomId: 0, targetRoomId: 1, wall: 'east', offset: 200, width: 80, isClosed: true, segment: {} },
    ];
    const graph = buildRoomGraph(rooms, doorStates);
    const cameFrom = bfsFromRoom(graph, 0);

    const doorway = getNextDoorway(rooms, graph, cameFrom, 2, 0);

    expect(doorway).toBeNull();
  });
});

describe('getDoorwayCenter', () => {
  const room = makeRoom(0, 0, 0, []);

  it('computes correct position for east wall door', () => {
    const door = { wall: 'east', offset: 200, width: 80 };
    const center = getDoorwayCenter(room, door);

    expect(center.x).toBe(room.x + room.width);
    expect(center.y).toBe(room.y + 200 + 40);
  });

  it('computes correct position for west wall door', () => {
    const door = { wall: 'west', offset: 300, width: 80 };
    const center = getDoorwayCenter(room, door);

    expect(center.x).toBe(room.x);
    expect(center.y).toBe(room.y + 300 + 40);
  });

  it('computes correct position for north wall door', () => {
    const door = { wall: 'north', offset: 400, width: 80 };
    const center = getDoorwayCenter(room, door);

    expect(center.x).toBe(room.x + 400 + 40);
    expect(center.y).toBe(room.y);
  });

  it('computes correct position for south wall door', () => {
    const door = { wall: 'south', offset: 500, width: 80 };
    const center = getDoorwayCenter(room, door);

    expect(center.x).toBe(room.x + 500 + 40);
    expect(center.y).toBe(room.y + room.height);
  });
});

describe('getRoomDistance', () => {
  it('returns 0 for same room', () => {
    const rooms = makeLinearRooms();
    const graph = buildRoomGraph(rooms, []);

    expect(getRoomDistance(graph, 0, 0)).toBe(0);
  });

  it('returns 1 for adjacent rooms', () => {
    const rooms = makeLinearRooms();
    const graph = buildRoomGraph(rooms, []);

    expect(getRoomDistance(graph, 0, 1)).toBe(1);
  });

  it('returns 2 for two rooms apart', () => {
    const rooms = makeLinearRooms();
    const graph = buildRoomGraph(rooms, []);

    expect(getRoomDistance(graph, 0, 2)).toBe(2);
  });

  it('returns -1 for unreachable rooms', () => {
    const rooms = makeLinearRooms();
    const doorStates = [
      { id: 0, roomId: 0, targetRoomId: 1, wall: 'east', offset: 200, width: 80, isClosed: true, segment: {} },
    ];
    const graph = buildRoomGraph(rooms, doorStates);

    expect(getRoomDistance(graph, 0, 2)).toBe(-1);
  });
});

