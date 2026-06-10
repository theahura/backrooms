import { mulberry32 } from './random.js';

const ALTERNATE_EXIT_SEED_OFFSET = 100000;
const ALTERNATE_EXIT_CHANCE = 0.20;

export const LOCATIONS = [
  {
    id: 'store',
    name: 'Furniture Store',
    floorColor: 0x5c4a3a,
    wallColor: 0x7a6b5a,
    furniture: [
      { type: 'counter', relX: 0.35, relY: 0.33, width: 120, height: 40, color: 0x5c3a21, canHide: false },
      { type: 'shelf', relX: 0.55, relY: 0.08, width: 100, height: 20, color: 0x6b4e2a, canHide: false },
      { type: 'shelf', relX: 0.55, relY: 0.18, width: 100, height: 20, color: 0x6b4e2a, canHide: false },
      { type: 'shelf', relX: 0.55, relY: 0.28, width: 100, height: 20, color: 0x6b4e2a, canHide: false },
      { type: 'bookcase', relX: 0.62, relY: 0.55, width: 30, height: 80, color: 0x4a2c17, canHide: false },
      { type: 'couch', relX: 0.08, relY: 0.6, width: 90, height: 50, color: 0x8b6b4e, canHide: false },
      { type: 'table', relX: 0.25, relY: 0.65, width: 40, height: 40, color: 0xc19a6b, canHide: true },
      { type: 'desk', relX: 0.08, relY: 0.15, width: 60, height: 40, color: 0x3a3a3a, canHide: true },
      { type: 'table', relX: 0.35, relY: 0.15, width: 80, height: 50, color: 0x5c3a21, canHide: true },
      { type: 'bookcase', relX: 0.62, relY: 0.08, width: 30, height: 80, color: 0x4a2c17, canHide: false },
    ],
  },
  {
    id: 'office',
    name: 'Office Building',
    floorColor: 0x5a5548,
    wallColor: 0x6a6558,
    furniture: [
      { type: 'desk', relX: 0.08, relY: 0.12, width: 80, height: 50, color: 0x6b6b6b, canHide: true },
      { type: 'desk', relX: 0.08, relY: 0.55, width: 80, height: 50, color: 0x6b6b6b, canHide: true },
      { type: 'bookcase', relX: 0.30, relY: 0.08, width: 20, height: 120, color: 0x888888, canHide: false },
      { type: 'bookcase', relX: 0.30, relY: 0.50, width: 20, height: 120, color: 0x888888, canHide: false },
      { type: 'desk', relX: 0.45, relY: 0.12, width: 80, height: 50, color: 0x6b6b6b, canHide: true },
      { type: 'desk', relX: 0.45, relY: 0.55, width: 80, height: 50, color: 0x6b6b6b, canHide: true },
      { type: 'shelf', relX: 0.70, relY: 0.20, width: 60, height: 20, color: 0x505050, canHide: false },
      { type: 'table', relX: 0.70, relY: 0.60, width: 50, height: 50, color: 0x7a7a7a, canHide: true },
      { type: 'bookcase', relX: 0.62, relY: 0.08, width: 30, height: 80, color: 0x555555, canHide: false },
    ],
  },
  {
    id: 'garage',
    name: 'Parking Garage',
    floorColor: 0x4a4a4a,
    wallColor: 0x5a5a5a,
    furniture: [
      { type: 'bookcase', relX: 0.15, relY: 0.15, width: 24, height: 24, color: 0x606060, canHide: false },
      { type: 'bookcase', relX: 0.15, relY: 0.55, width: 24, height: 24, color: 0x606060, canHide: false },
      { type: 'bookcase', relX: 0.40, relY: 0.15, width: 24, height: 24, color: 0x606060, canHide: false },
      { type: 'bookcase', relX: 0.40, relY: 0.55, width: 24, height: 24, color: 0x606060, canHide: false },
      { type: 'shelf', relX: 0.08, relY: 0.35, width: 100, height: 12, color: 0x707070, canHide: false },
      { type: 'shelf', relX: 0.55, relY: 0.35, width: 100, height: 12, color: 0x707070, canHide: false },
      { type: 'table', relX: 0.70, relY: 0.70, width: 60, height: 40, color: 0x585858, canHide: true },
      { type: 'desk', relX: 0.70, relY: 0.12, width: 50, height: 30, color: 0x484848, canHide: true },
    ],
  },
  {
    id: 'hotel',
    name: 'Hotel Lobby',
    floorColor: 0x4a2a2a,
    wallColor: 0x6a4a3a,
    furniture: [
      { type: 'counter', relX: 0.35, relY: 0.10, width: 140, height: 35, color: 0x5c3a21, canHide: false },
      { type: 'couch', relX: 0.08, relY: 0.25, width: 80, height: 50, color: 0x6b3a3a, canHide: false },
      { type: 'couch', relX: 0.08, relY: 0.55, width: 80, height: 50, color: 0x6b3a3a, canHide: false },
      { type: 'table', relX: 0.25, relY: 0.40, width: 50, height: 50, color: 0x8b6b4e, canHide: true },
      { type: 'bookcase', relX: 0.62, relY: 0.08, width: 30, height: 80, color: 0x4a2c17, canHide: false },
      { type: 'shelf', relX: 0.55, relY: 0.65, width: 80, height: 20, color: 0x5c3a21, canHide: false },
      { type: 'desk', relX: 0.45, relY: 0.55, width: 60, height: 40, color: 0x3a2a1a, canHide: true },
      { type: 'table', relX: 0.70, relY: 0.40, width: 40, height: 40, color: 0x8b6b4e, canHide: true },
    ],
  },
  {
    id: 'laundromat',
    name: 'Laundromat',
    floorColor: 0x485058,
    wallColor: 0x586068,
    furniture: [
      { type: 'shelf', relX: 0.08, relY: 0.08, width: 60, height: 60, color: 0xcccccc, canHide: false },
      { type: 'shelf', relX: 0.22, relY: 0.08, width: 60, height: 60, color: 0xcccccc, canHide: false },
      { type: 'shelf', relX: 0.08, relY: 0.55, width: 60, height: 60, color: 0xcccccc, canHide: false },
      { type: 'shelf', relX: 0.22, relY: 0.55, width: 60, height: 60, color: 0xcccccc, canHide: false },
      { type: 'table', relX: 0.45, relY: 0.15, width: 100, height: 40, color: 0x9a9a9a, canHide: true },
      { type: 'table', relX: 0.45, relY: 0.60, width: 100, height: 40, color: 0x9a9a9a, canHide: true },
      { type: 'desk', relX: 0.70, relY: 0.35, width: 50, height: 60, color: 0x707070, canHide: true },
      { type: 'shelf', relX: 0.62, relY: 0.08, width: 30, height: 80, color: 0x888888, canHide: false },
    ],
  },
];

export function getLocation(locationId) {
  return LOCATIONS.find(l => l.id === locationId) ?? null;
}

export function getLocationLayout(locationId, roomX, roomY, roomWidth, roomHeight, wallThickness) {
  const location = getLocation(locationId);
  if (!location) return [];

  const innerX = roomX + wallThickness;
  const innerY = roomY + wallThickness;
  const innerW = roomWidth - wallThickness * 2;
  const innerH = roomHeight - wallThickness * 2;

  const spawnCX = roomX + roomWidth / 2;
  const spawnCY = roomY + roomHeight / 2;
  const spawnHalf = 30;

  const result = [];

  for (const def of location.furniture) {
    const x = innerX + Math.round(def.relX * innerW);
    const y = innerY + Math.round(def.relY * innerH);

    const overlapsSpawnX = x < spawnCX + spawnHalf && x + def.width > spawnCX - spawnHalf;
    const overlapsSpawnY = y < spawnCY + spawnHalf && y + def.height > spawnCY - spawnHalf;
    if (overlapsSpawnX && overlapsSpawnY) continue;

    if (x + def.width > roomX + roomWidth - wallThickness) continue;
    if (y + def.height > roomY + roomHeight - wallThickness) continue;

    result.push({
      type: def.type,
      x,
      y,
      width: def.width,
      height: def.height,
      color: def.color,
      canHide: def.canHide,
    });
  }

  return result;
}

export function getLocationExitPosition(locationId, room, wallThickness) {
  return {
    x: room.x + wallThickness + 40,
    y: room.y + room.height / 2,
  };
}

export function generateAlternateExit(rooms, stairs, seed, unlockedLocationIds) {
  const lockable = LOCATIONS.filter(l => !unlockedLocationIds.includes(l.id));
  if (lockable.length === 0) return null;

  const deepRooms = rooms.filter(r => r.floor > 0);
  if (deepRooms.length === 0) return null;

  const stairRoomIds = new Set();
  for (const stair of stairs) {
    stairRoomIds.add(stair.fromRoomId);
    stairRoomIds.add(stair.toRoomId);
  }

  const eligible = deepRooms.filter(r => !stairRoomIds.has(r.id));
  if (eligible.length === 0) return null;

  const rand = mulberry32(seed + ALTERNATE_EXIT_SEED_OFFSET);

  if (rand() > ALTERNATE_EXIT_CHANCE) return null;

  const roomIndex = Math.floor(rand() * eligible.length);
  const room = eligible[roomIndex];

  const locationIndex = Math.floor(rand() * lockable.length);
  const location = lockable[locationIndex];

  const offsetX = (rand() - 0.5) * (room.width * 0.4);
  const offsetY = (rand() - 0.5) * (room.height * 0.4);

  return {
    roomId: room.id,
    locationId: location.id,
    position: {
      x: room.x + room.width / 2 + offsetX,
      y: room.y + room.height / 2 + offsetY,
    },
  };
}
