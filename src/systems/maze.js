import { mulberry32 } from './random.js';

const MAZE_SEED_OFFSET = 70000;
const MIN_SUBDIVISION_SIZE = 200;
const GAP_WIDTH = 80;
const COLUMN_SIZE = 24;
const COLUMN_SPACING = 200;

const CORRIDOR_MIN_SIZE = 120;
const CORRIDOR_GAP_WIDTH = 60;
const CORRIDOR_MAX_DEPTH = 4;

const CRATE_SIZES = [
  { w: 40, h: 40 },
  { w: 60, h: 40 },
  { w: 80, h: 60 },
];
const CRATE_COUNT = 8;
const CRATE_GAP = 50;
const CRATE_MAX_ATTEMPTS = 240;

const CUBICLE_CELL_SIZE = 150;
const CUBICLE_WALL_LENGTH = 120;

export function getRoomType(seed) {
  const rand = mulberry32(seed + MAZE_SEED_OFFSET);
  const roll = rand();
  if (roll < 0.20) return 'open';
  if (roll < 0.35) return 'maze';
  if (roll < 0.50) return 'columns';
  if (roll < 0.70) return 'corridor';
  if (roll < 0.85) return 'storage';
  return 'cubicles';
}

export function generateMazeWalls(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, doors) {
  const type = getRoomType(seed);
  if (type === 'open') return [];

  const rand = mulberry32(seed + MAZE_SEED_OFFSET + 1);
  const innerX = roomX + wallThickness;
  const innerY = roomY + wallThickness;
  const innerW = roomWidth - 2 * wallThickness;
  const innerH = roomHeight - 2 * wallThickness;
  const doorZones = (doors || []).map(d => getDoorZone(roomX, roomY, roomWidth, roomHeight, wallThickness, d));

  if (type === 'columns') {
    const columns = generateColumns(roomX, roomY, roomWidth, roomHeight, wallThickness, seed);
    const segments = [];
    for (const col of columns) {
      const half = col.size / 2;
      const colSegs = [
        { x1: col.x - half, y1: col.y - half, x2: col.x + half, y2: col.y - half },
        { x1: col.x + half, y1: col.y - half, x2: col.x + half, y2: col.y + half },
        { x1: col.x + half, y1: col.y + half, x2: col.x - half, y2: col.y + half },
        { x1: col.x - half, y1: col.y + half, x2: col.x - half, y2: col.y - half },
      ];
      const blocked = colSegs.some(s => segmentCrossesDoorZone(s, doorZones));
      if (!blocked) {
        segments.push(...colSegs);
      }
    }
    return segments;
  }

  if (type === 'maze') {
    const segments = [];
    subdivideGeneric(
      { x: innerX, y: innerY, width: innerW, height: innerH },
      segments, rand, doorZones, 0, 2, MIN_SUBDIVISION_SIZE, GAP_WIDTH
    );
    return segments;
  }

  if (type === 'corridor') {
    const segments = [];
    subdivideGeneric(
      { x: innerX, y: innerY, width: innerW, height: innerH },
      segments, rand, doorZones, 0, CORRIDOR_MAX_DEPTH, CORRIDOR_MIN_SIZE, CORRIDOR_GAP_WIDTH
    );
    return segments;
  }

  if (type === 'storage') {
    return generateStorageWalls(roomX, roomY, roomWidth, roomHeight, wallThickness, rand, doorZones);
  }

  if (type === 'cubicles') {
    return generateCubicleWalls(roomX, roomY, roomWidth, roomHeight, wallThickness, rand, doorZones);
  }

  return [];
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

function segmentCrossesDoorZone(seg, doorZones) {
  const isHorizontal = Math.abs(seg.y2 - seg.y1) < 1;
  const isVertical = Math.abs(seg.x2 - seg.x1) < 1;

  for (const zone of doorZones) {
    if (isHorizontal) {
      const minX = Math.min(seg.x1, seg.x2);
      const maxX = Math.max(seg.x1, seg.x2);
      const y = seg.y1;
      if (maxX > zone.x && minX < zone.x + zone.width &&
          y > zone.y && y < zone.y + zone.height) {
        return true;
      }
    } else if (isVertical) {
      const minY = Math.min(seg.y1, seg.y2);
      const maxY = Math.max(seg.y1, seg.y2);
      const x = seg.x1;
      if (maxY > zone.y && minY < zone.y + zone.height &&
          x > zone.x && x < zone.x + zone.width) {
        return true;
      }
    }
  }
  return false;
}

function subdivideGeneric(bounds, segments, rand, doorZones, depth, maxDepth, minSize, gapWidth) {
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

    const leftSeg = { x1: bounds.x, y1: splitY, x2: gapStart, y2: splitY };
    const rightSeg = { x1: gapEnd, y1: splitY, x2: bounds.x + bounds.width, y2: splitY };

    if (gapStart > bounds.x && !segmentCrossesDoorZone(leftSeg, doorZones)) {
      segments.push(leftSeg);
    }
    if (gapEnd < bounds.x + bounds.width && !segmentCrossesDoorZone(rightSeg, doorZones)) {
      segments.push(rightSeg);
    }

    subdivideGeneric({ x: bounds.x, y: bounds.y, width: bounds.width, height: splitY - bounds.y }, segments, rand, doorZones, depth + 1, maxDepth, minSize, gapWidth);
    subdivideGeneric({ x: bounds.x, y: splitY, width: bounds.width, height: bounds.y + bounds.height - splitY }, segments, rand, doorZones, depth + 1, maxDepth, minSize, gapWidth);
  } else {
    const splitRange = bounds.width - 2 * minSize;
    if (splitRange <= 0) return;
    const splitX = bounds.x + minSize + Math.floor(rand() * splitRange);

    const gapStart = bounds.y + Math.floor(rand() * (bounds.height - gapWidth));
    const gapEnd = gapStart + gapWidth;

    const topSeg = { x1: splitX, y1: bounds.y, x2: splitX, y2: gapStart };
    const bottomSeg = { x1: splitX, y1: gapEnd, x2: splitX, y2: bounds.y + bounds.height };

    if (gapStart > bounds.y && !segmentCrossesDoorZone(topSeg, doorZones)) {
      segments.push(topSeg);
    }
    if (gapEnd < bounds.y + bounds.height && !segmentCrossesDoorZone(bottomSeg, doorZones)) {
      segments.push(bottomSeg);
    }

    subdivideGeneric({ x: bounds.x, y: bounds.y, width: splitX - bounds.x, height: bounds.height }, segments, rand, doorZones, depth + 1, maxDepth, minSize, gapWidth);
    subdivideGeneric({ x: splitX, y: bounds.y, width: bounds.x + bounds.width - splitX, height: bounds.height }, segments, rand, doorZones, depth + 1, maxDepth, minSize, gapWidth);
  }
}

function generateStorageWalls(roomX, roomY, roomWidth, roomHeight, wallThickness, rand, doorZones) {
  const margin = wallThickness + 40;
  const innerMinX = roomX + margin;
  const innerMinY = roomY + margin;
  const innerMaxX = roomX + roomWidth - margin;
  const innerMaxY = roomY + roomHeight - margin;

  const placed = [];
  const segments = [];

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

    const crateSegs = [
      { x1: x, y1: y, x2: x + w, y2: y },
      { x1: x + w, y1: y, x2: x + w, y2: y + h },
      { x1: x + w, y1: y + h, x2: x, y2: y + h },
      { x1: x, y1: y + h, x2: x, y2: y },
    ];

    const blocked = crateSegs.some(s => segmentCrossesDoorZone(s, doorZones));
    if (blocked) continue;

    placed.push({ x, y, w, h });
    segments.push(...crateSegs);
  }

  return segments;
}

function generateCubicleWalls(roomX, roomY, roomWidth, roomHeight, wallThickness, rand, doorZones) {
  const margin = wallThickness + 40;
  const innerMinX = roomX + margin;
  const innerMinY = roomY + margin;
  const innerW = roomWidth - 2 * margin;
  const innerH = roomHeight - 2 * margin;

  const cols = Math.floor(innerW / CUBICLE_CELL_SIZE);
  const rows = Math.floor(innerH / CUBICLE_CELL_SIZE);
  const offsetX = innerMinX + (innerW - cols * CUBICLE_CELL_SIZE) / 2;
  const offsetY = innerMinY + (innerH - rows * CUBICLE_CELL_SIZE) / 2;

  const segments = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (rand() < 0.30) continue;

      const cx = offsetX + col * CUBICLE_CELL_SIZE;
      const cy = offsetY + row * CUBICLE_CELL_SIZE;
      const wl = CUBICLE_WALL_LENGTH;

      const openSide = Math.floor(rand() * 4);
      const cellSegs = getCubicleSegments(cx, cy, wl, openSide);

      const blocked = cellSegs.some(s => segmentCrossesDoorZone(s, doorZones));
      if (!blocked) {
        segments.push(...cellSegs);
      }
    }
  }

  return segments;
}

function getCubicleSegments(cx, cy, wl, openSide) {
  const segs = [];
  if (openSide !== 0) segs.push({ x1: cx, y1: cy, x2: cx + wl, y2: cy });
  if (openSide !== 1) segs.push({ x1: cx + wl, y1: cy, x2: cx + wl, y2: cy + wl });
  if (openSide !== 2) segs.push({ x1: cx + wl, y1: cy + wl, x2: cx, y2: cy + wl });
  if (openSide !== 3) segs.push({ x1: cx, y1: cy + wl, x2: cx, y2: cy });
  return segs;
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
