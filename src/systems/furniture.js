import { mulberry32 } from './random.js';

export const FURNITURE_TYPES = {
  table: { width: 80, height: 50, color: 0x5c3a21, canHide: true, blocksLight: false },
  shelf: { width: 100, height: 20, color: 0x6b4e2a, canHide: false, blocksLight: true },
  desk: { width: 60, height: 40, color: 0x3a3a3a, canHide: true, blocksLight: false },
  bookcase: { width: 30, height: 80, color: 0x4a2c17, canHide: false, blocksLight: true },
  bed: { width: 90, height: 60, color: 0x4a3a3a, canHide: true, blocksLight: false },
  armoire: { width: 40, height: 70, color: 0x5c3a21, canHide: true, blocksLight: true },
  closet: { width: 50, height: 60, color: 0x3a3a3a, canHide: true, blocksLight: true },
  vent: { width: 30, height: 30, color: 0x666666, canHide: true, blocksLight: false },
  couch: { width: 90, height: 40, color: 0x6a5a44, canHide: false, blocksLight: false },
  counter: { width: 100, height: 30, color: 0x7a6a50, canHide: false, blocksLight: true },
};

// Furniture is placed as semantic clusters -- recognizable arrangements left
// behind by whoever furnished these rooms -- rather than uniform scatter.
// Familiar-but-abandoned groupings are what make the rooms read as liminal.
const CLUSTER_TEMPLATES = [
  // office pod: desks in a grid, all facing the same way
  [
    { type: 'desk', dx: 0, dy: 0 },
    { type: 'desk', dx: 90, dy: 0 },
    { type: 'desk', dx: 0, dy: 70 },
    { type: 'desk', dx: 90, dy: 70 },
  ],
  // waiting row: couches in a line facing nothing, table at the end
  [
    { type: 'couch', dx: 0, dy: 0 },
    { type: 'couch', dx: 100, dy: 0 },
    { type: 'couch', dx: 200, dy: 0 },
    { type: 'table', dx: 100, dy: 70 },
  ],
  // storage aisle: parallel shelving with a closet at the end
  [
    { type: 'shelf', dx: 0, dy: 0 },
    { type: 'shelf', dx: 0, dy: 50 },
    { type: 'shelf', dx: 0, dy: 100 },
    { type: 'closet', dx: 120, dy: 30 },
  ],
  // abandoned bedroom set
  [
    { type: 'bed', dx: 0, dy: 0 },
    { type: 'armoire', dx: 110, dy: 0 },
    { type: 'closet', dx: 110, dy: 80 },
  ],
  // reading corner: bookcase row with a desk pulled up to it
  [
    { type: 'bookcase', dx: 0, dy: 0 },
    { type: 'bookcase', dx: 40, dy: 0 },
    { type: 'bookcase', dx: 80, dy: 0 },
    { type: 'desk', dx: 30, dy: 95 },
  ],
  // cafeteria counter with tables pushed against it
  [
    { type: 'counter', dx: 0, dy: 0 },
    { type: 'table', dx: 10, dy: 50 },
    { type: 'table', dx: 110, dy: 50 },
  ],
];

const SINGLETON_TYPES = ['vent', 'armoire', 'closet', 'table'];
const SINGLETON_COUNT = 3;
const CLUSTER_PADDING = 16;
const SPAWN_ZONE_PADDING = 20;
// Wide enough that the wall-adjacent channel stays walkable and door entry
// zones (which reach ~80px into the room) stay mostly clear.
const WALL_MARGIN = 56;

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

function templateBounds(template) {
  let width = 0;
  let height = 0;
  for (const piece of template) {
    const def = FURNITURE_TYPES[piece.type];
    width = Math.max(width, piece.dx + def.width);
    height = Math.max(height, piece.dy + def.height);
  }
  return { width, height };
}

function makeItem(type, x, y) {
  const def = FURNITURE_TYPES[type];
  return { type, x, y, width: def.width, height: def.height, color: def.color, canHide: def.canHide };
}

export function generateRoomFurniture(roomX, roomY, roomWidth, roomHeight, wallThickness, seed) {
  const rand = mulberry32(seed);
  const minX = roomX + wallThickness + WALL_MARGIN;
  const minY = roomY + wallThickness + WALL_MARGIN;
  const maxX = roomX + roomWidth - wallThickness - WALL_MARGIN;
  const maxY = roomY + roomHeight - wallThickness - WALL_MARGIN;

  const target = Math.max(8, Math.round((roomWidth * roomHeight) / 45000));
  const placed = [];

  const spawnZone = {
    x: roomX + roomWidth / 2 - 30,
    y: roomY + roomHeight / 2 - 30,
    width: 60,
    height: 60,
  };

  const fits = candidate =>
    !rectsOverlap(candidate, spawnZone, SPAWN_ZONE_PADDING) &&
    !placed.some(existing => rectsOverlap(existing, candidate, CLUSTER_PADDING));

  const clusterBudget = target - SINGLETON_COUNT;
  for (let attempt = 0; attempt < 120 && placed.length < clusterBudget; attempt++) {
    const template = CLUSTER_TEMPLATES[Math.floor(rand() * CLUSTER_TEMPLATES.length)];
    const bounds = templateBounds(template);

    const availableW = maxX - minX - bounds.width;
    const availableH = maxY - minY - bounds.height;
    if (availableW <= 0 || availableH <= 0) continue;

    const anchorX = minX + Math.floor(rand() * availableW);
    const anchorY = minY + Math.floor(rand() * availableH);

    const pieces = template.map(p => makeItem(p.type, anchorX + p.dx, anchorY + p.dy));
    if (pieces.every(fits)) {
      placed.push(...pieces);
    }
  }

  for (let attempt = 0; attempt < 120 && placed.length < target; attempt++) {
    const type = SINGLETON_TYPES[Math.floor(rand() * SINGLETON_TYPES.length)];
    const def = FURNITURE_TYPES[type];

    const availableW = maxX - minX - def.width;
    const availableH = maxY - minY - def.height;
    if (availableW <= 0 || availableH <= 0) continue;

    const candidate = makeItem(type, minX + Math.floor(rand() * availableW), minY + Math.floor(rand() * availableH));
    if (fits(candidate)) {
      placed.push(candidate);
    }
  }

  return placed;
}
