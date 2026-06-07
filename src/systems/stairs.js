import { mulberry32 } from './random.js';
import { generateLevel } from './level.js';

export const FLOOR_Y_OFFSET = 10000;
export const STAIR_SIZE = 60;
export const FLOOR_ROOM_COUNTS = [4, 3];

export function generateMultiFloorLevel(seed, floorRoomCounts) {
  const allRooms = [];
  const allSegments = [];
  let roomIdOffset = 0;

  for (let floor = 0; floor < floorRoomCounts.length; floor++) {
    const floorSeed = seed + floor * 1000;
    const { rooms, wallSegments } = generateLevel(floorSeed, floorRoomCounts[floor]);

    const offsetY = floor * FLOOR_Y_OFFSET;

    for (const room of rooms) {
      room.id += roomIdOffset;
      room.y += offsetY;
      room.floor = floor;
      for (const door of room.doors) {
        door.targetRoomId += roomIdOffset;
      }
    }

    for (const seg of wallSegments) {
      seg.y1 += offsetY;
      seg.y2 += offsetY;
    }

    allRooms.push(...rooms);
    allSegments.push(...wallSegments);
    roomIdOffset += rooms.length;
  }

  const stairs = createStairConnections(allRooms, seed);

  return { rooms: allRooms, wallSegments: allSegments, stairs };
}

function createStairConnections(rooms, seed) {
  const rand = mulberry32(seed + 50000);
  const floor0Rooms = rooms.filter(r => r.floor === 0 && r.id !== 0);
  const floor1Rooms = rooms.filter(r => r.floor === 1);

  if (floor0Rooms.length === 0 || floor1Rooms.length === 0) return [];

  const stairs = [];
  const targetCount = Math.min(2, floor0Rooms.length, floor1Rooms.length);
  const usedFrom = new Set();
  const usedTo = new Set();

  for (let i = 0; i < targetCount; i++) {
    const availableFrom = floor0Rooms.filter(r => !usedFrom.has(r.id));
    const availableTo = floor1Rooms.filter(r => !usedTo.has(r.id));
    if (availableFrom.length === 0 || availableTo.length === 0) break;

    const fromRoom = availableFrom[Math.floor(rand() * availableFrom.length)];
    const toRoom = availableTo[Math.floor(rand() * availableTo.length)];

    usedFrom.add(fromRoom.id);
    usedTo.add(toRoom.id);

    stairs.push({
      id: i,
      fromRoomId: fromRoom.id,
      toRoomId: toRoom.id,
      fromPos: getStairPosition(fromRoom),
      toPos: getStairPosition(toRoom),
    });
  }

  return stairs;
}

function getStairPosition(room) {
  const margin = 100;
  return {
    x: room.x + margin + (room.width - 2 * margin - STAIR_SIZE) / 2,
    y: room.y + margin + (room.height - 2 * margin - STAIR_SIZE) / 2,
  };
}

export function getFloorBounds(rooms, floor) {
  const floorRooms = rooms.filter(r => r.floor === floor);
  if (floorRooms.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  const minX = Math.min(...floorRooms.map(r => r.x));
  const minY = Math.min(...floorRooms.map(r => r.y));
  const maxX = Math.max(...floorRooms.map(r => r.x + r.width));
  const maxY = Math.max(...floorRooms.map(r => r.y + r.height));

  return { minX, minY, maxX, maxY };
}
