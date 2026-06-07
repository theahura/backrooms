import { mulberry32 } from './random.js';

export const DOOR_INTERACT_RANGE = 80;
const CLOSABLE_DOOR_CHANCE = 0.5;

function computeSegment(room, wall, offset, width) {
  if (wall === 'north') {
    return { x1: room.x + offset, y1: room.y, x2: room.x + offset + width, y2: room.y };
  }
  if (wall === 'south') {
    return { x1: room.x + offset + width, y1: room.y + room.height, x2: room.x + offset, y2: room.y + room.height };
  }
  if (wall === 'east') {
    return { x1: room.x + room.width, y1: room.y + offset, x2: room.x + room.width, y2: room.y + offset + width };
  }
  return { x1: room.x, y1: room.y + offset + width, x2: room.x, y2: room.y + offset };
}

export function createDoorStates(rooms, seed) {
  const rand = mulberry32(seed + 30000);
  const states = [];
  let nextId = 0;

  for (const room of rooms) {
    for (const door of room.doors) {
      if (room.id >= door.targetRoomId) continue;

      const isClosable = rand() < CLOSABLE_DOOR_CHANCE;
      if (!isClosable) continue;

      states.push({
        id: nextId++,
        roomId: room.id,
        targetRoomId: door.targetRoomId,
        wall: door.wall,
        offset: door.offset,
        width: door.width,
        isClosed: true,
        segment: computeSegment(room, door.wall, door.offset, door.width),
      });
    }
  }

  return states;
}

export function toggleDoor(doorStates, doorId) {
  return doorStates.map(d =>
    d.id === doorId ? { ...d, isClosed: !d.isClosed } : d
  );
}

export function getClosedDoorSegments(doorStates) {
  return doorStates.filter(d => d.isClosed).map(d => d.segment);
}

export function getDoorCenter(doorState, rooms) {
  const room = rooms.find(r => r.id === doorState.roomId);
  const { wall, offset, width } = doorState;

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

export function findNearestDoor(doorStates, rooms, px, py, maxRange) {
  let nearest = null;
  let nearestDist = maxRange + 1;

  for (const door of doorStates) {
    const center = getDoorCenter(door, rooms);
    const dx = px - center.x;
    const dy = py - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= maxRange && dist < nearestDist) {
      nearest = door;
      nearestDist = dist;
    }
  }

  return nearest;
}
