export const DOORWAY_SEEK_CHANCE = 0.15;
export const ROOM_TRANSITION_COOLDOWN = 10000;
export const MAX_ROOM_DISTANCE = 2;
export const MAX_ROOM_ENEMIES = 4;

export function getDoorwayCenter(room, door) {
  const { wall, offset, width } = door;
  if (wall === 'north') {
    return { x: room.x + offset + width / 2, y: room.y };
  }
  if (wall === 'south') {
    return { x: room.x + offset + width / 2, y: room.y + room.height };
  }
  if (wall === 'east') {
    return { x: room.x + room.width, y: room.y + offset + width / 2 };
  }
  return { x: room.x, y: room.y + offset + width / 2 };
}

function isDoorClosed(doorStates, roomIdA, roomIdB) {
  const lo = Math.min(roomIdA, roomIdB);
  const hi = Math.max(roomIdA, roomIdB);
  const ds = doorStates.find(d => d.roomId === lo && d.targetRoomId === hi);
  return ds ? ds.isClosed : false;
}

export function buildRoomGraph(rooms, doorStates) {
  const graph = new Map();

  for (const room of rooms) {
    graph.set(room.id, []);
  }

  for (const room of rooms) {
    for (const door of room.doors) {
      if (isDoorClosed(doorStates, room.id, door.targetRoomId)) continue;
      const doorway = getDoorwayCenter(room, door);
      graph.get(room.id).push({ targetRoomId: door.targetRoomId, doorway });
    }
  }

  return graph;
}

export function bfsFromRoom(graph, startRoomId) {
  const cameFrom = new Map();
  const queue = [startRoomId];
  const visited = new Set([startRoomId]);

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = graph.get(current) || [];

    for (const { targetRoomId } of neighbors) {
      if (visited.has(targetRoomId)) continue;
      visited.add(targetRoomId);
      cameFrom.set(targetRoomId, current);
      queue.push(targetRoomId);
    }
  }

  return cameFrom;
}

export function getRoomDistance(graph, fromId, toId) {
  if (fromId === toId) return 0;
  const cameFrom = bfsFromRoom(graph, fromId);
  if (!cameFrom.has(toId)) return -1;

  let dist = 0;
  let current = toId;
  while (current !== fromId) {
    current = cameFrom.get(current);
    dist++;
  }
  return dist;
}
