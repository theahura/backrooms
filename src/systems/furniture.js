import { mulberry32 } from './random.js';

export const FURNITURE_TYPES = {
  table: { width: 80, height: 50, color: 0x5c3a21, canHide: true },
  shelf: { width: 100, height: 20, color: 0x6b4e2a, canHide: false },
  desk: { width: 60, height: 40, color: 0x3a3a3a, canHide: true },
  bookcase: { width: 30, height: 80, color: 0x4a2c17, canHide: false },
};

const TYPE_KEYS = Object.keys(FURNITURE_TYPES);

export function createFurnitureSegments(x, y, width, height) {
  return [
    { x1: x, y1: y, x2: x + width, y2: y },
    { x1: x + width, y1: y, x2: x + width, y2: y + height },
    { x1: x + width, y1: y + height, x2: x, y2: y + height },
    { x1: x, y1: y + height, x2: x, y2: y },
  ];
}

function rectsOverlap(a, b, padding) {
  return (
    a.x - padding < b.x + b.width + padding &&
    a.x + a.width + padding > b.x - padding &&
    a.y - padding < b.y + b.height + padding &&
    a.y + a.height + padding > b.y - padding
  );
}

export function generateRoomFurniture(roomX, roomY, roomWidth, roomHeight, wallThickness, seed) {
  const rand = mulberry32(seed);
  const minX = roomX + wallThickness + 40;
  const minY = roomY + wallThickness + 40;
  const maxX = roomX + roomWidth - wallThickness - 40;
  const maxY = roomY + roomHeight - wallThickness - 40;

  const count = 4 + Math.floor(rand() * 5);
  const placed = [];

  const spawnZone = {
    x: roomX + roomWidth / 2 - 30,
    y: roomY + roomHeight / 2 - 30,
    width: 60,
    height: 60,
  };

  for (let attempt = 0; attempt < count * 20 && placed.length < count; attempt++) {
    const typeKey = TYPE_KEYS[Math.floor(rand() * TYPE_KEYS.length)];
    const def = FURNITURE_TYPES[typeKey];

    const availableW = maxX - minX - def.width;
    const availableH = maxY - minY - def.height;
    if (availableW <= 0 || availableH <= 0) continue;

    const x = minX + Math.floor(rand() * availableW);
    const y = minY + Math.floor(rand() * availableH);

    const candidate = { type: typeKey, x, y, width: def.width, height: def.height, color: def.color, canHide: def.canHide };

    const overlaps = placed.some(existing => rectsOverlap(existing, candidate, 20));
    if (overlaps) continue;
    if (rectsOverlap(candidate, spawnZone, 20)) continue;

    placed.push(candidate);
  }

  return placed;
}
