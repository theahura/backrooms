import { mulberry32 } from './random.js';

export const SWITCH_INTERACT_RANGE = 80;
const SWITCH_CHANCE = 0.15;

// Keep the switch off the corners and clear of door gaps. A switch must sit
// flush against solid wall, never across a doorway or open entrance.
const SWITCH_CORNER_MARGIN = 40;
const SWITCH_DOOR_CLEARANCE = 30;

// The switch sprite (art.js switch_off/switch_on) is 20x28 px, drawn centered
// and unscaled. Half-extents along each axis: used to inflate obstacle
// projections so the placed FOOTPRINT clears the obstacle, not just the center.
// Exported so tests assert against the real sprite footprint, not a copy.
export const SWITCH_HALF_W = 10;
export const SWITCH_HALF_H = 14;

// A clear span must fit the switch footprint (whichever axis it runs along) with
// a little breathing room.
const SWITCH_MIN_SPAN = Math.max(SWITCH_HALF_W, SWITCH_HALF_H) * 2 + 8;

// Interior maze walls (maze.js) are extended to meet the perimeter, so one can
// reach the thin band the switch sprite occupies next to a wall. Project any such
// wall onto the along-wall axis as a blocked [start,end] offset interval (offset
// from the room origin, like door offsets), inflated by the sprite half-extent so
// the footprint clears it. A maze wall counts only if it reaches the switch's
// mounting band; walls deeper in the room (the common case) are ignored.
function mazeBlockedSpans(room, wall, wallThickness, mazeRects = []) {
  const inset = wallThickness + 4;
  const spans = [];
  for (const r of mazeRects) {
    const rRight = r.x + r.width;
    const rBottom = r.y + r.height;
    if (wall === 'north' || wall === 'south') {
      const center = wall === 'north' ? room.y + inset : room.y + room.height - inset;
      if (rBottom > center - SWITCH_HALF_H && r.y < center + SWITCH_HALF_H) {
        spans.push([r.x - room.x - SWITCH_HALF_W, rRight - room.x + SWITCH_HALF_W]);
      }
    } else {
      const center = wall === 'west' ? room.x + inset : room.x + room.width - inset;
      if (rRight > center - SWITCH_HALF_W && r.x < center + SWITCH_HALF_W) {
        spans.push([r.y - room.y - SWITCH_HALF_H, rBottom - room.y + SWITCH_HALF_H]);
      }
    }
  }
  return spans;
}

// The largest free span on `wall` after removing the corners, door gaps (inflated
// by clearance), and any interior maze wall reaching the mounting band. Returns
// the span's center offset (where the switch goes) and its length (so a caller can
// compare walls and skip a wall with no clear span).
function freeWallSpan(room, wall, wallThickness, mazeRects = []) {
  const span = wall === 'north' || wall === 'south' ? room.width : room.height;
  const lo = SWITCH_CORNER_MARGIN;
  const hi = span - SWITCH_CORNER_MARGIN;

  const blocked = (room.doors || [])
    .filter(d => d.wall === wall)
    .map(d => [d.offset - SWITCH_DOOR_CLEARANCE, d.offset + d.width + SWITCH_DOOR_CLEARANCE])
    .concat(mazeBlockedSpans(room, wall, wallThickness, mazeRects))
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

  // Degenerate: a wall so full of doors/walls there is no clear span. Fall back to
  // the midpoint (rare; better than throwing).
  if (best === null || bestLen <= 0) return { offset: span / 2, length: 0 };
  return { offset: best, length: bestLen };
}

export function computeSwitchPosition(room, wall, wallThickness, mazeRects = []) {
  const inset = wallThickness + 4;
  const off = freeWallSpan(room, wall, wallThickness, mazeRects).offset;
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

// Pick the wall to mount a switch on, scanning the four walls from a (seeded)
// starting index and returning the first with a clear span big enough for the
// switch, falling back to the wall with the largest span. This keeps a switch off
// a wall that an interior maze wall has fully buried.
export function chooseSwitchWall(room, wallThickness, mazeRects, startWallIndex) {
  let fallback = null;
  for (let i = 0; i < WALLS.length; i++) {
    const wall = WALLS[(startWallIndex + i) % WALLS.length];
    const { length } = freeWallSpan(room, wall, wallThickness, mazeRects);
    if (length >= SWITCH_MIN_SPAN) return wall;
    if (!fallback || length > fallback.length) fallback = { wall, length };
  }
  return fallback.wall;
}

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
