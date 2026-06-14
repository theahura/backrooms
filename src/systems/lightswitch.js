import { mulberry32 } from './random.js';

export const SWITCH_INTERACT_RANGE = 80;
const SWITCH_CHANCE = 0.15;

// Keep the switch off the corners and clear of door gaps. A switch must sit
// flush against solid wall, never across a doorway or open entrance.
const SWITCH_CORNER_MARGIN = 40;
const SWITCH_DOOR_CLEARANCE = 30;

// The along-wall offset (from the room origin) where the switch sits: the center
// of the largest free span on that wall after removing door gaps (inflated by
// clearance) and the corners. This is what keeps switches off doorways.
function freeWallOffset(room, wall) {
  const span = wall === 'north' || wall === 'south' ? room.width : room.height;
  const lo = SWITCH_CORNER_MARGIN;
  const hi = span - SWITCH_CORNER_MARGIN;

  const blocked = (room.doors || [])
    .filter(d => d.wall === wall)
    .map(d => [d.offset - SWITCH_DOOR_CLEARANCE, d.offset + d.width + SWITCH_DOOR_CLEARANCE])
    .sort((a, b) => a[0] - b[0]);

  let best = null;
  let bestLen = -1;
  let cursor = lo;
  for (const [bStart, bEnd] of blocked) {
    const gapEnd = Math.min(bStart, hi);
    if (gapEnd - cursor > bestLen) {
      bestLen = gapEnd - cursor;
      best = (cursor + gapEnd) / 2;
    }
    cursor = Math.max(cursor, bEnd);
  }
  if (hi - cursor > bestLen) {
    bestLen = hi - cursor;
    best = (cursor + hi) / 2;
  }

  // Degenerate: a wall so full of doors there is no clear span. Fall back to the
  // midpoint (rare; better than throwing).
  if (best === null || bestLen <= 0) return span / 2;
  return best;
}

export function computeSwitchPosition(room, wall, wallThickness) {
  const inset = wallThickness + 4;
  const off = freeWallOffset(room, wall);
  if (wall === 'north') {
    return { x: room.x + off, y: room.y + inset };
  }
  if (wall === 'south') {
    return { x: room.x + off, y: room.y + room.height - inset };
  }
  if (wall === 'east') {
    return { x: room.x + room.width - inset, y: room.y + off };
  }
  return { x: room.x + inset, y: room.y + off };
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
