import { mulberry32 } from './random.js';
import { createRoomWalls } from './room.js';

const ROOM_WIDTH = 1200;
const ROOM_HEIGHT = 1000;
const DOOR_WIDTH = 80;
const DOOR_MIN_OFFSET = 100;

const DIRECTIONS = [
  { dx: 0, dy: -1, wall: 'north', oppositeWall: 'south' },
  { dx: 1, dy: 0, wall: 'east', oppositeWall: 'west' },
  { dx: 0, dy: 1, wall: 'south', oppositeWall: 'north' },
  { dx: -1, dy: 0, wall: 'west', oppositeWall: 'east' },
];

function getDoorMaxOffset(wall) {
  const wallLength = (wall === 'north' || wall === 'south') ? ROOM_WIDTH : ROOM_HEIGHT;
  return wallLength - DOOR_MIN_OFFSET - DOOR_WIDTH;
}

export function generateLevel(seed, roomCount) {
  const rand = mulberry32(seed);
  const grid = new Map();
  const rooms = [];

  const firstRoom = {
    id: 0,
    gridX: 0,
    gridY: 0,
    x: 0,
    y: 0,
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    doors: [],
    seed: seed,
  };
  rooms.push(firstRoom);
  grid.set('0,0', firstRoom);

  for (let i = 1; i < roomCount; i++) {
    let placed = false;

    for (let attempt = 0; attempt < 100 && !placed; attempt++) {
      const parentIdx = Math.floor(rand() * rooms.length);
      const parent = rooms[parentIdx];
      const dir = DIRECTIONS[Math.floor(rand() * DIRECTIONS.length)];

      const newGridX = parent.gridX + dir.dx;
      const newGridY = parent.gridY + dir.dy;
      const key = `${newGridX},${newGridY}`;

      if (grid.has(key)) continue;

      const maxOffset = getDoorMaxOffset(dir.wall);
      const doorOffset = DOOR_MIN_OFFSET + Math.floor(rand() * (maxOffset - DOOR_MIN_OFFSET + 1));

      const newRoom = {
        id: i,
        gridX: newGridX,
        gridY: newGridY,
        x: newGridX * ROOM_WIDTH,
        y: newGridY * ROOM_HEIGHT,
        width: ROOM_WIDTH,
        height: ROOM_HEIGHT,
        doors: [{ wall: dir.oppositeWall, offset: doorOffset, width: DOOR_WIDTH, targetRoomId: parent.id }],
        seed: seed + i,
      };

      parent.doors.push({ wall: dir.wall, offset: doorOffset, width: DOOR_WIDTH, targetRoomId: newRoom.id });

      rooms.push(newRoom);
      grid.set(key, newRoom);
      placed = true;
    }
  }

  const wallSegments = [];
  for (const room of rooms) {
    const roomWalls = createRoomWalls(room.x, room.y, room.width, room.height, room.doors);
    wallSegments.push(...roomWalls);
  }

  return { rooms, wallSegments };
}
