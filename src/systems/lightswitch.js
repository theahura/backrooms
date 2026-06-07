import { mulberry32 } from './random.js';

export const SWITCH_INTERACT_RANGE = 80;
const SWITCH_CHANCE = 0.4;

function computeSwitchPosition(room, wall, wallThickness) {
  const inset = wallThickness + 4;
  if (wall === 'north') {
    return { x: room.x + room.width / 2, y: room.y + inset };
  }
  if (wall === 'south') {
    return { x: room.x + room.width / 2, y: room.y + room.height - inset };
  }
  if (wall === 'east') {
    return { x: room.x + room.width - inset, y: room.y + room.height / 2 };
  }
  return { x: room.x + inset, y: room.y + room.height / 2 };
}

const WALLS = ['north', 'south', 'east', 'west'];

export function createSwitchStates(rooms, seed, wallThickness) {
  const rand = mulberry32(seed + 40000);
  const states = [];
  let nextId = 0;

  for (const room of rooms) {
    if (room.id === 0) continue;

    if (rand() >= SWITCH_CHANCE) continue;

    const wall = WALLS[Math.floor(rand() * WALLS.length)];
    const pos = computeSwitchPosition(room, wall, wallThickness);

    states.push({
      id: nextId++,
      roomId: room.id,
      x: pos.x,
      y: pos.y,
      isOn: false,
    });
  }

  return states;
}

export function toggleSwitch(switchStates, switchId) {
  return switchStates.map(s =>
    s.id === switchId ? { ...s, isOn: !s.isOn } : s
  );
}

export function findNearestSwitch(switchStates, px, py, maxRange) {
  let nearest = null;
  let nearestDist = maxRange + 1;

  for (const sw of switchStates) {
    const dx = px - sw.x;
    const dy = py - sw.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= maxRange && dist < nearestDist) {
      nearest = sw;
      nearestDist = dist;
    }
  }

  return nearest;
}

export function getLitRoomIds(switchStates) {
  return switchStates.filter(s => s.isOn).map(s => s.roomId);
}

export function isPointInRoom(room, x, y) {
  return x >= room.x && x <= room.x + room.width &&
         y >= room.y && y <= room.y + room.height;
}
