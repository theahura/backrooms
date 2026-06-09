export const LIGHT_SPILL_DEPTH = 150;

export function isDoorOpen(roomIdA, roomIdB, doorStates) {
  const lo = Math.min(roomIdA, roomIdB);
  const hi = Math.max(roomIdA, roomIdB);
  const state = doorStates.find(d => d.roomId === lo && d.targetRoomId === hi);
  if (!state) return true;
  return !state.isClosed;
}

export function getLightSpillZones(rooms, litRoomIds, doorStates) {
  const zones = [];
  const litSet = new Set(litRoomIds);

  for (const roomId of litRoomIds) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) continue;

    for (const door of room.doors) {
      if (litSet.has(door.targetRoomId)) continue;
      if (!isDoorOpen(roomId, door.targetRoomId, doorStates)) continue;

      const zone = computeSpillZone(room, door);
      zones.push(zone);
    }
  }

  return zones;
}

function computeSpillZone(room, door) {
  const { wall, offset, width } = door;

  if (wall === 'north') {
    return {
      x: room.x + offset,
      y: room.y - LIGHT_SPILL_DEPTH,
      width: width,
      height: LIGHT_SPILL_DEPTH,
      alphas: { topLeft: 0, topRight: 0, bottomLeft: 1, bottomRight: 1 },
    };
  }

  if (wall === 'south') {
    return {
      x: room.x + offset,
      y: room.y + room.height,
      width: width,
      height: LIGHT_SPILL_DEPTH,
      alphas: { topLeft: 1, topRight: 1, bottomLeft: 0, bottomRight: 0 },
    };
  }

  if (wall === 'east') {
    return {
      x: room.x + room.width,
      y: room.y + offset,
      width: LIGHT_SPILL_DEPTH,
      height: width,
      alphas: { topLeft: 1, topRight: 0, bottomLeft: 1, bottomRight: 0 },
    };
  }

  return {
    x: room.x - LIGHT_SPILL_DEPTH,
    y: room.y + offset,
    width: LIGHT_SPILL_DEPTH,
    height: width,
    alphas: { topLeft: 0, topRight: 1, bottomLeft: 0, bottomRight: 1 },
  };
}
