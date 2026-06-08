import { mulberry32 } from './random.js';

const MAZE_SEED_OFFSET = 70000;
const MIN_SUBDIVISION_SIZE = 200;
const GAP_WIDTH = 80;
const COLUMN_SIZE = 24;
const COLUMN_SPACING = 200;

export function getRoomType(seed) {
  const rand = mulberry32(seed + MAZE_SEED_OFFSET);
  const roll = rand();
  if (roll < 0.4) return 'open';
  if (roll < 0.7) return 'maze';
  return 'columns';
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

  const segments = [];
  subdivide(
    { x: innerX, y: innerY, width: innerW, height: innerH },
    segments, rand, doorZones, 0, 2
  );
  return segments;
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

function subdivide(bounds, segments, rand, doorZones, depth, maxDepth) {
  if (depth >= maxDepth) return;
  if (bounds.width < MIN_SUBDIVISION_SIZE * 2 || bounds.height < MIN_SUBDIVISION_SIZE * 2) return;

  const horizontal = bounds.width < bounds.height ? true :
                     bounds.height < bounds.width ? false :
                     rand() > 0.5;

  if (horizontal) {
    const splitRange = bounds.height - 2 * MIN_SUBDIVISION_SIZE;
    if (splitRange <= 0) return;
    const splitY = bounds.y + MIN_SUBDIVISION_SIZE + Math.floor(rand() * splitRange);

    const gapStart = bounds.x + Math.floor(rand() * (bounds.width - GAP_WIDTH));
    const gapEnd = gapStart + GAP_WIDTH;

    const leftSeg = { x1: bounds.x, y1: splitY, x2: gapStart, y2: splitY };
    const rightSeg = { x1: gapEnd, y1: splitY, x2: bounds.x + bounds.width, y2: splitY };

    if (gapStart > bounds.x && !segmentCrossesDoorZone(leftSeg, doorZones)) {
      segments.push(leftSeg);
    }
    if (gapEnd < bounds.x + bounds.width && !segmentCrossesDoorZone(rightSeg, doorZones)) {
      segments.push(rightSeg);
    }

    subdivide({ x: bounds.x, y: bounds.y, width: bounds.width, height: splitY - bounds.y }, segments, rand, doorZones, depth + 1, maxDepth);
    subdivide({ x: bounds.x, y: splitY, width: bounds.width, height: bounds.y + bounds.height - splitY }, segments, rand, doorZones, depth + 1, maxDepth);
  } else {
    const splitRange = bounds.width - 2 * MIN_SUBDIVISION_SIZE;
    if (splitRange <= 0) return;
    const splitX = bounds.x + MIN_SUBDIVISION_SIZE + Math.floor(rand() * splitRange);

    const gapStart = bounds.y + Math.floor(rand() * (bounds.height - GAP_WIDTH));
    const gapEnd = gapStart + GAP_WIDTH;

    const topSeg = { x1: splitX, y1: bounds.y, x2: splitX, y2: gapStart };
    const bottomSeg = { x1: splitX, y1: gapEnd, x2: splitX, y2: bounds.y + bounds.height };

    if (gapStart > bounds.y && !segmentCrossesDoorZone(topSeg, doorZones)) {
      segments.push(topSeg);
    }
    if (gapEnd < bounds.y + bounds.height && !segmentCrossesDoorZone(bottomSeg, doorZones)) {
      segments.push(bottomSeg);
    }

    subdivide({ x: bounds.x, y: bounds.y, width: splitX - bounds.x, height: bounds.height }, segments, rand, doorZones, depth + 1, maxDepth);
    subdivide({ x: splitX, y: bounds.y, width: bounds.x + bounds.width - splitX, height: bounds.height }, segments, rand, doorZones, depth + 1, maxDepth);
  }
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
