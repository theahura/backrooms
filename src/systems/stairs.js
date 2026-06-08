import { mulberry32 } from './random.js';
import { generateLevel } from './level.js';

export const FLOOR_Y_OFFSET = 10000;
export const STAIR_SIZE = 60;
export const FLOOR_ROOM_COUNTS = [4, 3];

export function getFloorRoomCounts(runCount) {
  if (runCount >= 4) return [4, 3, 3, 2];
  if (runCount >= 2) return [4, 3, 3];
  return [4, 3];
}

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
  const floors = new Map();
  for (const room of rooms) {
    if (!floors.has(room.floor)) floors.set(room.floor, []);
    floors.get(room.floor).push(room);
  }

  const floorIndices = [...floors.keys()].sort((a, b) => a - b);
  const stairs = [];
  let stairId = 0;
  const roomStairCount = new Map();

  for (let i = 0; i < floorIndices.length - 1; i++) {
    const fromFloor = floorIndices[i];
    const toFloor = floorIndices[i + 1];
    let fromCandidates = floors.get(fromFloor);
    const toCandidates = floors.get(toFloor);

    if (fromFloor === 0) {
      fromCandidates = fromCandidates.filter(r => r.id !== 0);
    }

    if (fromCandidates.length === 0 || toCandidates.length === 0) continue;

    const targetCount = Math.min(2, fromCandidates.length, toCandidates.length);
    const usedFrom = new Set();
    const usedTo = new Set();

    for (let j = 0; j < targetCount; j++) {
      const availableFrom = fromCandidates.filter(r => !usedFrom.has(r.id));
      const availableTo = toCandidates.filter(r => !usedTo.has(r.id));
      if (availableFrom.length === 0 || availableTo.length === 0) break;

      const fromRoom = availableFrom[Math.floor(rand() * availableFrom.length)];
      const toRoom = availableTo[Math.floor(rand() * availableTo.length)];

      usedFrom.add(fromRoom.id);
      usedTo.add(toRoom.id);

      const fromIdx = roomStairCount.get(fromRoom.id) || 0;
      const toIdx = roomStairCount.get(toRoom.id) || 0;
      roomStairCount.set(fromRoom.id, fromIdx + 1);
      roomStairCount.set(toRoom.id, toIdx + 1);

      stairs.push({
        id: stairId++,
        fromRoomId: fromRoom.id,
        toRoomId: toRoom.id,
        fromPos: getStairPosition(fromRoom, fromIdx),
        toPos: getStairPosition(toRoom, toIdx),
        fromFloor,
        toFloor,
      });
    }
  }

  return stairs;
}

function getStairPosition(room, index) {
  const margin = 100;
  const innerW = room.width - 2 * margin;
  const cx = room.x + margin + (innerW - STAIR_SIZE) / 2;
  const cy = room.y + margin + (room.height - 2 * margin - STAIR_SIZE) / 2;
  const offset = (index || 0) * (STAIR_SIZE + 20);
  return { x: cx + offset, y: cy };
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
