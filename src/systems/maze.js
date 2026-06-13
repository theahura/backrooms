import { mulberry32 } from './random.js';

const MAZE_SEED_OFFSET = 70000;
const MIN_SUBDIVISION_SIZE = 150;
const GAP_WIDTH = 72;
const COLUMN_SIZE = 24;
const COLUMN_SPACING = 140;

const CORRIDOR_MIN_SIZE = 110;
const CORRIDOR_GAP_WIDTH = 64;
const CORRIDOR_MAX_DEPTH = 4;

const CRATE_SIZES = [
  { w: 40, h: 40 },
  { w: 60, h: 40 },
  { w: 80, h: 60 },
];
const CRATE_COUNT = 6;
const CRATE_GAP = 50;
const CRATE_MAX_ATTEMPTS = 240;

const CUBICLE_CELL_SIZE = 130;
const CUBICLE_WALL_LENGTH = 104;

export function getRoomType(seed) {
  const rand = mulberry32(seed + MAZE_SEED_OFFSET);
  const roll = rand();
  if (roll < 0.05) return 'open';
  if (roll < 0.22) return 'maze';
  if (roll < 0.36) return 'columns';
  if (roll < 0.62) return 'corridor';
  if (roll < 0.81) return 'storage';
  return 'cubicles';
}

// Walls are solid rects: the drawn footprint, the physics body, and the light
// occluder (its outline, via wallRectSegments) are all the same rectangle, so
// light can never travel inside a visually solid wall band.
export function generateMazeWalls(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, doors, keepOut = []) {
  const type = getRoomType(seed);
  if (type === 'open') return [];

  const rand = mulberry32(seed + MAZE_SEED_OFFSET + 1);
  const inner = {
    x: roomX + wallThickness,
    y: roomY + wallThickness,
    width: roomWidth - 2 * wallThickness,
    height: roomHeight - 2 * wallThickness,
  };
  // Walls are carved away from door entry zones (so doorways stay clear) and
  // from any extra keep-out zones the caller supplies (e.g. the fixed stair
  // square, so stairs never spawn inside a wall).
  const doorZones = (doors || []).map(d => getDoorZone(roomX, roomY, roomWidth, roomHeight, wallThickness, d));
  const zones = [...doorZones, ...keepOut];

  if (type === 'columns') {
    const columns = generateColumns(roomX, roomY, roomWidth, roomHeight, wallThickness, seed);
    const rects = columns.map(col => ({
      x: col.x - col.size / 2,
      y: col.y - col.size / 2,
      width: col.size,
      height: col.size,
    }));
    return rects.filter(rect => !rectOverlapsZone(rect, zones));
  }

  if (type === 'maze' || type === 'corridor') {
    const segments = [];
    if (type === 'maze') {
      subdivideGeneric(inner, segments, rand, 0, 2, MIN_SUBDIVISION_SIZE, GAP_WIDTH);
    } else {
      subdivideGeneric(inner, segments, rand, 0, CORRIDOR_MAX_DEPTH, CORRIDOR_MIN_SIZE, CORRIDOR_GAP_WIDTH);
    }
    const room = { x: roomX, y: roomY, width: roomWidth, height: roomHeight };
    return segments
      .map(seg => subdivisionWallRect(seg, wallThickness, inner, room))
      .filter(rect => rect !== null && !rectOverlapsZone(rect, zones));
  }

  if (type === 'storage') {
    return generateStorageWalls(roomX, roomY, roomWidth, roomHeight, wallThickness, rand, zones);
  }

  if (type === 'cubicles') {
    return generateCubicleWalls(roomX, roomY, roomWidth, roomHeight, wallThickness, rand, zones);
  }

  return [];
}

// Door entry zones reach 80px past the wall into the room -- the swept floor a
// player walks through to use the door. Exported so other placement systems
// (furniture) can keep this area clear, the same way maze walls already do.
export function doorEntryZones(room, wallThickness) {
  return (room.doors || []).map(d => getDoorZone(room.x, room.y, room.width, room.height, wallThickness, d));
}

export function wallRectSegments(rect) {
  return [
    { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y },
    { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height },
    { x1: rect.x + rect.width, y1: rect.y + rect.height, x2: rect.x, y2: rect.y + rect.height },
    { x1: rect.x, y1: rect.y + rect.height, x2: rect.x, y2: rect.y },
  ];
}

// The subset of a wall rect's outline that should occlude the FLASHLIGHT given a
// light origin outside it: only the edges facing AWAY from the light (the far
// faces, where the light lies on the edge's interior side). Skipping the near
// faces lets the flashlight reach across the wall band to light its near
// surface -- so the wall reads as a solid band of thickness instead of an
// infinitely-thin shadow line -- while the far faces still stop the light, so
// nothing leaks to the floor on the other side. (Enemy line-of-sight keeps the
// full wallRectSegments outline; only rendering uses this culled set.)
export function wallRectOccluders(rect, origin) {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const segments = [];
  if (origin.y >= top) segments.push({ x1: left, y1: top, x2: right, y2: top });
  if (origin.y <= bottom) segments.push({ x1: left, y1: bottom, x2: right, y2: bottom });
  if (origin.x >= left) segments.push({ x1: left, y1: top, x2: left, y2: bottom });
  if (origin.x <= right) segments.push({ x1: right, y1: top, x2: right, y2: bottom });
  return segments;
}

function rectOverlapsZone(rect, zones) {
  for (const zone of zones) {
    if (rect.x < zone.x + zone.width && rect.x + rect.width > zone.x &&
        rect.y < zone.y + zone.height && rect.y + rect.height > zone.y) {
      return true;
    }
  }
  return false;
}

// A subdivision wall is a band centered on its split line. Ends that touch the
// maze area edge are extended through the drawn perimeter band to the true
// room edge, so light cannot slip through the visually solid junction.
// The strict equality against the inner bounds relies on all coordinates being
// integers (room origins, splits, and gaps are integer-valued); fractional
// room coordinates would silently stop the extension from firing. Stubs
// shorter than the wall thickness are dropped before extension on purpose:
// nothing visually meaningful is lost, and a kept stub would be a free-floating
// square rather than a wall.
function subdivisionWallRect(seg, wallThickness, inner, room) {
  const half = wallThickness / 2;
  const horizontal = seg.y1 === seg.y2;
  if (horizontal) {
    let x = Math.min(seg.x1, seg.x2);
    let right = Math.max(seg.x1, seg.x2);
    if (right - x < wallThickness) return null;
    if (x === inner.x) x = room.x;
    if (right === inner.x + inner.width) right = room.x + room.width;
    return { x, y: seg.y1 - half, width: right - x, height: wallThickness };
  }
  let y = Math.min(seg.y1, seg.y2);
  let bottom = Math.max(seg.y1, seg.y2);
  if (bottom - y < wallThickness) return null;
  if (y === inner.y) y = room.y;
  if (bottom === inner.y + inner.height) bottom = room.y + room.height;
  return { x: seg.x1 - half, y, width: wallThickness, height: bottom - y };
}

function getDoorZone(roomX, roomY, roomWidth, roomHeight, wallThickness, door) {
  const entryDepth = 80 + wallThickness;
  if (door.wall === 'north') {
    return { x: roomX + door.offset, y: roomY, width: door.width, height: entryDepth };
  } else if (door.wall === 'south') {
    return { x: roomX + door.offset, y: roomY + roomHeight - entryDepth, width: door.width, height: entryDepth };
  } else if (door.wall === 'east') {
    return { x: roomX + roomWidth - entryDepth, y: roomY + door.offset, width: entryDepth, height: door.width };
  } else {
    return { x: roomX, y: roomY + door.offset, width: entryDepth, height: door.width };
  }
}

function subdivideGeneric(bounds, segments, rand, depth, maxDepth, minSize, gapWidth) {
  if (depth >= maxDepth) return;
  if (bounds.width < minSize * 2 || bounds.height < minSize * 2) return;

  const horizontal = bounds.width < bounds.height ? true :
                     bounds.height < bounds.width ? false :
                     rand() > 0.5;

  if (horizontal) {
    const splitRange = bounds.height - 2 * minSize;
    if (splitRange <= 0) return;
    const splitY = bounds.y + minSize + Math.floor(rand() * splitRange);

    const gapStart = bounds.x + Math.floor(rand() * (bounds.width - gapWidth));
    const gapEnd = gapStart + gapWidth;

    if (gapStart > bounds.x) {
      segments.push({ x1: bounds.x, y1: splitY, x2: gapStart, y2: splitY });
    }
    if (gapEnd < bounds.x + bounds.width) {
      segments.push({ x1: gapEnd, y1: splitY, x2: bounds.x + bounds.width, y2: splitY });
    }

    subdivideGeneric({ x: bounds.x, y: bounds.y, width: bounds.width, height: splitY - bounds.y }, segments, rand, depth + 1, maxDepth, minSize, gapWidth);
    subdivideGeneric({ x: bounds.x, y: splitY, width: bounds.width, height: bounds.y + bounds.height - splitY }, segments, rand, depth + 1, maxDepth, minSize, gapWidth);
  } else {
    const splitRange = bounds.width - 2 * minSize;
    if (splitRange <= 0) return;
    const splitX = bounds.x + minSize + Math.floor(rand() * splitRange);

    const gapStart = bounds.y + Math.floor(rand() * (bounds.height - gapWidth));
    const gapEnd = gapStart + gapWidth;

    if (gapStart > bounds.y) {
      segments.push({ x1: splitX, y1: bounds.y, x2: splitX, y2: gapStart });
    }
    if (gapEnd < bounds.y + bounds.height) {
      segments.push({ x1: splitX, y1: gapEnd, x2: splitX, y2: bounds.y + bounds.height });
    }

    subdivideGeneric({ x: bounds.x, y: bounds.y, width: splitX - bounds.x, height: bounds.height }, segments, rand, depth + 1, maxDepth, minSize, gapWidth);
    subdivideGeneric({ x: splitX, y: bounds.y, width: bounds.x + bounds.width - splitX, height: bounds.height }, segments, rand, depth + 1, maxDepth, minSize, gapWidth);
  }
}

function generateStorageWalls(roomX, roomY, roomWidth, roomHeight, wallThickness, rand, zones) {
  const margin = wallThickness + 40;
  const innerMinX = roomX + margin;
  const innerMinY = roomY + margin;
  const innerMaxX = roomX + roomWidth - margin;
  const innerMaxY = roomY + roomHeight - margin;

  const placed = [];
  const rects = [];

  for (let attempt = 0; attempt < CRATE_MAX_ATTEMPTS && placed.length < CRATE_COUNT; attempt++) {
    const sizeIdx = Math.floor(rand() * CRATE_SIZES.length);
    const { w, h } = CRATE_SIZES[sizeIdx];

    const x = innerMinX + Math.floor(rand() * (innerMaxX - innerMinX - w));
    const y = innerMinY + Math.floor(rand() * (innerMaxY - innerMinY - h));

    let overlaps = false;
    for (const p of placed) {
      if (x < p.x + p.w + CRATE_GAP && x + w + CRATE_GAP > p.x &&
          y < p.y + p.h + CRATE_GAP && y + h + CRATE_GAP > p.y) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    const rect = { x, y, width: w, height: h };
    if (rectOverlapsZone(rect, zones)) continue;

    placed.push({ x, y, w, h });
    rects.push(rect);
  }

  return rects;
}

function generateCubicleWalls(roomX, roomY, roomWidth, roomHeight, wallThickness, rand, zones) {
  const margin = wallThickness + 40;
  const innerMinX = roomX + margin;
  const innerMinY = roomY + margin;
  const innerW = roomWidth - 2 * margin;
  const innerH = roomHeight - 2 * margin;

  const cols = Math.floor(innerW / CUBICLE_CELL_SIZE);
  const rows = Math.floor(innerH / CUBICLE_CELL_SIZE);
  const offsetX = innerMinX + (innerW - cols * CUBICLE_CELL_SIZE) / 2;
  const offsetY = innerMinY + (innerH - rows * CUBICLE_CELL_SIZE) / 2;

  const rects = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (rand() < 0.30) continue;

      const cx = offsetX + col * CUBICLE_CELL_SIZE;
      const cy = offsetY + row * CUBICLE_CELL_SIZE;
      const wl = CUBICLE_WALL_LENGTH;

      const openSide = Math.floor(rand() * 4);
      const cellRects = getCubicleRects(cx, cy, wl, wallThickness, openSide);

      const blocked = cellRects.some(r => rectOverlapsZone(r, zones));
      if (!blocked) {
        rects.push(...cellRects);
      }
    }
  }

  return rects;
}

// Partition bands are centered on the cubicle's edge lines, so perpendicular
// walls of the same cubicle overlap at the corners (no see-through gap).
function getCubicleRects(cx, cy, wl, t, openSide) {
  const half = t / 2;
  const cellRects = [];
  if (openSide !== 0) cellRects.push({ x: cx, y: cy - half, width: wl, height: t });
  if (openSide !== 1) cellRects.push({ x: cx + wl - half, y: cy, width: t, height: wl });
  if (openSide !== 2) cellRects.push({ x: cx, y: cy + wl - half, width: wl, height: t });
  if (openSide !== 3) cellRects.push({ x: cx - half, y: cy, width: t, height: wl });
  return cellRects;
}

export function generateColumns(roomX, roomY, roomWidth, roomHeight, wallThickness, seed) {
  const rand = mulberry32(seed + MAZE_SEED_OFFSET + 2);
  const margin = wallThickness + 40;
  const innerMinX = roomX + margin;
  const innerMinY = roomY + margin;
  const innerMaxX = roomX + roomWidth - margin;
  const innerMaxY = roomY + roomHeight - margin;

  const columns = [];
  let row = 0;
  for (let y = innerMinY + COLUMN_SPACING / 2; y + COLUMN_SIZE / 2 <= innerMaxY; y += COLUMN_SPACING) {
    const offset = (row % 2 === 0) ? 0 : COLUMN_SPACING / 2;
    for (let x = innerMinX + COLUMN_SPACING / 2 + offset; x + COLUMN_SIZE / 2 <= innerMaxX; x += COLUMN_SPACING) {
      columns.push({ x, y, size: COLUMN_SIZE });
    }
    row++;
  }

  return columns;
}
