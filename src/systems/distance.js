export function computeRoomDistances(rooms, stairs) {
  const adjacency = new Map();
  const addEdge = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a).add(b);
  };

  for (const room of rooms) {
    if (!adjacency.has(room.id)) adjacency.set(room.id, new Set());
    for (const door of room.doors ?? []) {
      addEdge(room.id, door.targetRoomId);
      addEdge(door.targetRoomId, room.id);
    }
  }

  for (const stair of stairs ?? []) {
    addEdge(stair.fromRoomId, stair.toRoomId);
    addEdge(stair.toRoomId, stair.fromRoomId);
  }

  const distances = new Map();
  const queue = [0];
  distances.set(0, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentDistance = distances.get(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDistance + 1);
        queue.push(neighbor);
      }
    }
  }

  return distances;
}
