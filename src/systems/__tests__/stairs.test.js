import { describe, it, expect } from 'vitest';
import { generateMultiFloorLevel, getFloorBounds, getFloorRoomCounts, FLOOR_Y_OFFSET, STAIR_SIZE, STAIR_MARGIN, getStairTopLeft, stairKeepOut, getStairLandingPosition, stairLandingKeepOut } from '../stairs.js';
import { generateMazeWalls } from '../maze.js';
import { generateRoomFurniture } from '../furniture.js';

describe('getFloorRoomCounts', () => {
  it('returns [4, 3] for run 0', () => {
    expect(getFloorRoomCounts(0)).toEqual([4, 3]);
  });

  it('returns [4, 3] for run 1', () => {
    expect(getFloorRoomCounts(1)).toEqual([4, 3]);
  });

  it('returns [4, 3, 3] for run 2', () => {
    expect(getFloorRoomCounts(2)).toEqual([4, 3, 3]);
  });

  it('returns [4, 3, 3] for run 3', () => {
    expect(getFloorRoomCounts(3)).toEqual([4, 3, 3]);
  });

  it('returns [4, 3, 3, 2] for run 4', () => {
    expect(getFloorRoomCounts(4)).toEqual([4, 3, 3, 2]);
  });

  it('caps at [4, 3, 3, 2] for very high run counts', () => {
    expect(getFloorRoomCounts(100)).toEqual([4, 3, 3, 2]);
  });
});

describe('generateMultiFloorLevel', () => {
  const seed = 42;
  const floorRoomCounts = [4, 3];

  it('generates rooms across multiple floors with correct total count', () => {
    const { rooms } = generateMultiFloorLevel(seed, floorRoomCounts);
    expect(rooms.length).toBe(7);
  });

  it('assigns globally unique room IDs', () => {
    const { rooms } = generateMultiFloorLevel(seed, floorRoomCounts);
    const ids = rooms.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(rooms.length);
  });

  it('assigns floor field to each room matching its floor index', () => {
    const { rooms } = generateMultiFloorLevel(seed, floorRoomCounts);
    const floor0Rooms = rooms.filter(r => r.floor === 0);
    const floor1Rooms = rooms.filter(r => r.floor === 1);
    expect(floor0Rooms.length).toBe(4);
    expect(floor1Rooms.length).toBe(3);
  });

  it('offsets floor 1 rooms by FLOOR_Y_OFFSET in world Y position', () => {
    const { rooms } = generateMultiFloorLevel(seed, floorRoomCounts);
    const floor0MaxY = Math.max(...rooms.filter(r => r.floor === 0).map(r => r.y + r.height));
    const floor1MinY = Math.min(...rooms.filter(r => r.floor === 1).map(r => r.y));
    expect(floor1MinY).toBeGreaterThanOrEqual(FLOOR_Y_OFFSET);
    expect(floor1MinY - floor0MaxY).toBeGreaterThan(0);
  });

  it('creates at least one stair connection per adjacent floor pair', () => {
    const { stairs } = generateMultiFloorLevel(seed, floorRoomCounts);
    expect(stairs.length).toBeGreaterThanOrEqual(1);
  });

  it('stair connections use distinct rooms on each side', () => {
    const { stairs } = generateMultiFloorLevel(seed, floorRoomCounts);
    const sameFloorStairs = stairs.filter(s => s.fromFloor === 0 && s.toFloor === 1);
    if (sameFloorStairs.length >= 2) {
      expect(sameFloorStairs[0].fromRoomId).not.toBe(sameFloorStairs[1].fromRoomId);
      expect(sameFloorStairs[0].toRoomId).not.toBe(sameFloorStairs[1].toRoomId);
    }
  });

  it('stair fromRoomId is never room 0 (starting room)', () => {
    const { stairs } = generateMultiFloorLevel(seed, floorRoomCounts);
    for (const stair of stairs) {
      expect(stair.fromRoomId).not.toBe(0);
    }
  });

  it('stairs have fromFloor and toFloor fields matching their rooms', () => {
    const { rooms, stairs } = generateMultiFloorLevel(seed, floorRoomCounts);
    for (const stair of stairs) {
      const fromRoom = rooms.find(r => r.id === stair.fromRoomId);
      const toRoom = rooms.find(r => r.id === stair.toRoomId);
      expect(fromRoom.floor).toBe(stair.fromFloor);
      expect(toRoom.floor).toBe(stair.toFloor);
    }
  });

  it('stair positions are within bounds of their respective rooms', () => {
    const { rooms, stairs } = generateMultiFloorLevel(seed, floorRoomCounts);
    for (const stair of stairs) {
      const fromRoom = rooms.find(r => r.id === stair.fromRoomId);
      const toRoom = rooms.find(r => r.id === stair.toRoomId);

      expect(stair.fromPos.x).toBeGreaterThanOrEqual(fromRoom.x);
      expect(stair.fromPos.x + STAIR_SIZE).toBeLessThanOrEqual(fromRoom.x + fromRoom.width);
      expect(stair.fromPos.y).toBeGreaterThanOrEqual(fromRoom.y);
      expect(stair.fromPos.y + STAIR_SIZE).toBeLessThanOrEqual(fromRoom.y + fromRoom.height);

      expect(stair.toPos.x).toBeGreaterThanOrEqual(toRoom.x);
      expect(stair.toPos.x + STAIR_SIZE).toBeLessThanOrEqual(toRoom.x + toRoom.width);
      expect(stair.toPos.y).toBeGreaterThanOrEqual(toRoom.y);
      expect(stair.toPos.y + STAIR_SIZE).toBeLessThanOrEqual(toRoom.y + toRoom.height);
    }
  });

  it('is deterministic (same seed produces same output)', () => {
    const result1 = generateMultiFloorLevel(seed, floorRoomCounts);
    const result2 = generateMultiFloorLevel(seed, floorRoomCounts);
    expect(result1.rooms.map(r => r.id)).toEqual(result2.rooms.map(r => r.id));
    expect(result1.stairs).toEqual(result2.stairs);
  });

  it('door targetRoomId references point to existing rooms', () => {
    const { rooms } = generateMultiFloorLevel(seed, floorRoomCounts);
    const allIds = new Set(rooms.map(r => r.id));
    for (const room of rooms) {
      for (const door of room.doors) {
        expect(allIds.has(door.targetRoomId)).toBe(true);
      }
    }
  });

  it('wall segments include segments from both floors', () => {
    const { rooms, wallSegments } = generateMultiFloorLevel(seed, floorRoomCounts);
    const floor1MinY = Math.min(...rooms.filter(r => r.floor === 1).map(r => r.y));
    const hasFloor1Segments = wallSegments.some(s => s.y1 >= floor1MinY || s.y2 >= floor1MinY);
    expect(hasFloor1Segments).toBe(true);
  });
});

describe('generateMultiFloorLevel with 3 floors', () => {
  const seed = 42;
  const threeFloors = [4, 3, 3];

  it('generates correct total room count for 3 floors', () => {
    const { rooms } = generateMultiFloorLevel(seed, threeFloors);
    expect(rooms.length).toBe(10);
  });

  it('assigns rooms to all 3 floors', () => {
    const { rooms } = generateMultiFloorLevel(seed, threeFloors);
    expect(rooms.filter(r => r.floor === 0).length).toBe(4);
    expect(rooms.filter(r => r.floor === 1).length).toBe(3);
    expect(rooms.filter(r => r.floor === 2).length).toBe(3);
  });

  it('creates stairs connecting floor 0 to 1 and floor 1 to 2', () => {
    const { stairs } = generateMultiFloorLevel(seed, threeFloors);
    const pairs = stairs.map(s => `${s.fromFloor}-${s.toFloor}`);
    expect(pairs).toContain('0-1');
    expect(pairs).toContain('1-2');
  });

  it('stair rooms match their fromFloor and toFloor fields', () => {
    const { rooms, stairs } = generateMultiFloorLevel(seed, threeFloors);
    for (const stair of stairs) {
      const fromRoom = rooms.find(r => r.id === stair.fromRoomId);
      const toRoom = rooms.find(r => r.id === stair.toRoomId);
      expect(fromRoom.floor).toBe(stair.fromFloor);
      expect(toRoom.floor).toBe(stair.toFloor);
    }
  });

  it('stair positions are within room bounds for all floors', () => {
    const { rooms, stairs } = generateMultiFloorLevel(seed, threeFloors);
    for (const stair of stairs) {
      const fromRoom = rooms.find(r => r.id === stair.fromRoomId);
      const toRoom = rooms.find(r => r.id === stair.toRoomId);
      expect(stair.fromPos.x).toBeGreaterThanOrEqual(fromRoom.x);
      expect(stair.fromPos.x + STAIR_SIZE).toBeLessThanOrEqual(fromRoom.x + fromRoom.width);
      expect(stair.toPos.x).toBeGreaterThanOrEqual(toRoom.x);
      expect(stair.toPos.x + STAIR_SIZE).toBeLessThanOrEqual(toRoom.x + toRoom.width);
    }
  });

  it('assigns globally unique room IDs across all 3 floors', () => {
    const { rooms } = generateMultiFloorLevel(seed, threeFloors);
    const ids = rooms.map(r => r.id);
    expect(new Set(ids).size).toBe(rooms.length);
  });

  it('is deterministic for 3 floors', () => {
    const r1 = generateMultiFloorLevel(seed, threeFloors);
    const r2 = generateMultiFloorLevel(seed, threeFloors);
    expect(r1.rooms.map(r => r.id)).toEqual(r2.rooms.map(r => r.id));
    expect(r1.stairs).toEqual(r2.stairs);
  });
});

describe('generateMultiFloorLevel with 4 floors', () => {
  const seed = 42;
  const fourFloors = [4, 3, 3, 2];

  it('generates correct total room count for 4 floors', () => {
    const { rooms } = generateMultiFloorLevel(seed, fourFloors);
    expect(rooms.length).toBe(12);
  });

  it('creates stairs for all 3 adjacent floor pairs', () => {
    const { stairs } = generateMultiFloorLevel(seed, fourFloors);
    const pairs = new Set(stairs.map(s => `${s.fromFloor}-${s.toFloor}`));
    expect(pairs.has('0-1')).toBe(true);
    expect(pairs.has('1-2')).toBe(true);
    expect(pairs.has('2-3')).toBe(true);
  });

  it('room 0 is never used as a stair source across any floor pair', () => {
    const { stairs } = generateMultiFloorLevel(seed, fourFloors);
    for (const stair of stairs) {
      expect(stair.fromRoomId).not.toBe(0);
    }
  });

  it('stair endpoints in the same room do not overlap', () => {
    const { stairs } = generateMultiFloorLevel(seed, fourFloors);
    const positionsByRoom = new Map();
    for (const stair of stairs) {
      for (const [roomId, pos] of [[stair.fromRoomId, stair.fromPos], [stair.toRoomId, stair.toPos]]) {
        if (!positionsByRoom.has(roomId)) positionsByRoom.set(roomId, []);
        positionsByRoom.get(roomId).push(pos);
      }
    }
    for (const [roomId, positions] of positionsByRoom) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dx = Math.abs(positions[i].x - positions[j].x);
          const dy = Math.abs(positions[i].y - positions[j].y);
          const overlaps = dx < STAIR_SIZE && dy < STAIR_SIZE;
          expect(overlaps, `room ${roomId}: stair positions overlap at (${positions[i].x},${positions[i].y}) and (${positions[j].x},${positions[j].y})`).toBe(false);
        }
      }
    }
  });
});

describe('getFloorBounds', () => {
  it('returns bounds encompassing only rooms on the specified floor', () => {
    const { rooms } = generateMultiFloorLevel(42, [4, 3]);
    const bounds0 = getFloorBounds(rooms, 0);
    const bounds1 = getFloorBounds(rooms, 1);

    const floor0Rooms = rooms.filter(r => r.floor === 0);
    const floor1Rooms = rooms.filter(r => r.floor === 1);

    for (const room of floor0Rooms) {
      expect(room.x).toBeGreaterThanOrEqual(bounds0.minX);
      expect(room.x + room.width).toBeLessThanOrEqual(bounds0.maxX);
      expect(room.y).toBeGreaterThanOrEqual(bounds0.minY);
      expect(room.y + room.height).toBeLessThanOrEqual(bounds0.maxY);
    }

    for (const room of floor1Rooms) {
      expect(room.x).toBeGreaterThanOrEqual(bounds1.minX);
      expect(room.x + room.width).toBeLessThanOrEqual(bounds1.maxX);
      expect(room.y).toBeGreaterThanOrEqual(bounds1.minY);
      expect(room.y + room.height).toBeLessThanOrEqual(bounds1.maxY);
    }

    // Floors should not overlap
    expect(bounds1.minY).toBeGreaterThan(bounds0.maxY);
  });

  it('works for floor 2 in a 3-floor level', () => {
    const { rooms } = generateMultiFloorLevel(42, [4, 3, 3]);
    const bounds2 = getFloorBounds(rooms, 2);
    const floor2Rooms = rooms.filter(r => r.floor === 2);

    expect(floor2Rooms.length).toBeGreaterThan(0);
    for (const room of floor2Rooms) {
      expect(room.x).toBeGreaterThanOrEqual(bounds2.minX);
      expect(room.x + room.width).toBeLessThanOrEqual(bounds2.maxX);
    }
  });
});

describe('getStairTopLeft', () => {
  it('centers the stair square within the room', () => {
    const room = { x: 1000, y: 2000, width: 720, height: 600 };
    const { x, y } = getStairTopLeft(room);
    expect(x + STAIR_SIZE / 2).toBe(room.x + room.width / 2);
    expect(y + STAIR_SIZE / 2).toBe(room.y + room.height / 2);
  });

  it('keeps the stair inside the room margins', () => {
    const room = { x: 0, y: 0, width: 720, height: 600 };
    const { x, y } = getStairTopLeft(room);
    expect(x).toBeGreaterThanOrEqual(room.x + STAIR_MARGIN);
    expect(y).toBeGreaterThanOrEqual(room.y + STAIR_MARGIN);
    expect(x + STAIR_SIZE).toBeLessThanOrEqual(room.x + room.width - STAIR_MARGIN);
    expect(y + STAIR_SIZE).toBeLessThanOrEqual(room.y + room.height - STAIR_MARGIN);
  });
});

describe('stairKeepOut', () => {
  const room = { x: 1000, y: 2000, width: 720, height: 600 };

  it('with zero padding equals the stair square footprint', () => {
    const { x, y } = getStairTopLeft(room);
    expect(stairKeepOut(room, STAIR_SIZE, STAIR_MARGIN, 0)).toEqual({ x, y, width: STAIR_SIZE, height: STAIR_SIZE });
  });

  it('inflates the stair square by the padding on every side', () => {
    const pad = 16;
    const zero = stairKeepOut(room, STAIR_SIZE, STAIR_MARGIN, 0);
    const padded = stairKeepOut(room, STAIR_SIZE, STAIR_MARGIN, pad);
    expect(padded.x).toBe(zero.x - pad);
    expect(padded.y).toBe(zero.y - pad);
    expect(padded.width).toBe(zero.width + 2 * pad);
    expect(padded.height).toBe(zero.height + 2 * pad);
  });
});

describe('getStairLandingPosition', () => {
  it('is horizontally centered in the room', () => {
    const room = { x: 1000, y: 2000, width: 720, height: 600 };
    expect(getStairLandingPosition(room).x).toBe(room.x + room.width / 2);
  });

  it('lands below the room center by STAIR_SIZE + 80', () => {
    const room = { x: 1000, y: 2000, width: 720, height: 600 };
    expect(getStairLandingPosition(room).y).toBe(room.y + room.height / 2 + STAIR_SIZE + 80);
  });

  it('lands below the stair square so re-entry does not re-fire the overlap', () => {
    const room = { x: 0, y: 0, width: 720, height: 600 };
    const stair = getStairTopLeft(room);
    expect(getStairLandingPosition(room).y).toBeGreaterThan(stair.y + STAIR_SIZE);
  });

  it('lands inside the room bounds', () => {
    const room = { x: 0, y: 0, width: 720, height: 600 };
    const { x, y } = getStairLandingPosition(room);
    expect(x).toBeGreaterThan(room.x);
    expect(x).toBeLessThan(room.x + room.width);
    expect(y).toBeGreaterThan(room.y);
    expect(y).toBeLessThan(room.y + room.height);
  });
});

describe('stairLandingKeepOut', () => {
  const room = { x: 1000, y: 2000, width: 720, height: 600 };

  it('is a square centered on the landing position, defaulting to STAIR_SIZE', () => {
    const landing = getStairLandingPosition(room);
    expect(stairLandingKeepOut(room)).toEqual({
      x: landing.x - STAIR_SIZE / 2,
      y: landing.y - STAIR_SIZE / 2,
      width: STAIR_SIZE,
      height: STAIR_SIZE,
    });
  });

  it('honors a custom size while staying centered on the landing', () => {
    const landing = getStairLandingPosition(room);
    const big = stairLandingKeepOut(room, 120);
    expect(big.width).toBe(120);
    expect(big.height).toBe(120);
    expect(big.x + big.width / 2).toBe(landing.x);
    expect(big.y + big.height / 2).toBe(landing.y);
  });
});

describe('stair landing keep-out clears the spot the player materializes on', () => {
  const room = { x: 0, y: 0, width: 720, height: 600 };
  const doors = [{ wall: 'east', offset: 400, width: 80, targetRoomId: 1 }];
  const WALL_THICKNESS = 16;
  const STAIR_PAD = 16;
  const overlaps = (a, b) =>
    a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;

  it('without the landing keep-out, some seeds drop a wall AND some drop furniture on the landing', () => {
    const keep = stairLandingKeepOut(room);
    let wallBlocked = 0;
    let furnitureBlocked = 0;
    for (let seed = 0; seed < 200; seed++) {
      const walls = generateMazeWalls(
        room.x, room.y, room.width, room.height, WALL_THICKNESS, seed, doors,
        [stairKeepOut(room, STAIR_SIZE, STAIR_MARGIN, STAIR_PAD)],
      );
      const furniture = generateRoomFurniture(
        room.x, room.y, room.width, room.height, WALL_THICKNESS, seed, undefined, walls,
      );
      if (walls.some(w => overlaps(w, keep))) wallBlocked++;
      if (furniture.some(f => overlaps(f, keep))) furnitureBlocked++;
    }
    expect(wallBlocked).toBeGreaterThan(0);
    expect(furnitureBlocked).toBeGreaterThan(0);
  });

  it('with the landing keep-out, no seed drops a wall or furniture on the landing', () => {
    const keep = stairLandingKeepOut(room);
    let wallsSeen = 0;
    for (let seed = 0; seed < 200; seed++) {
      const walls = generateMazeWalls(
        room.x, room.y, room.width, room.height, WALL_THICKNESS, seed, doors,
        [stairKeepOut(room, STAIR_SIZE, STAIR_MARGIN, STAIR_PAD), keep],
      );
      wallsSeen += walls.length;
      const furniture = generateRoomFurniture(
        room.x, room.y, room.width, room.height, WALL_THICKNESS, seed, undefined, [...walls, keep],
      );
      for (const w of walls) expect(overlaps(w, keep), `wall, seed ${seed}`).toBe(false);
      for (const f of furniture) expect(overlaps(f, keep), `furniture, seed ${seed}`).toBe(false);
    }
    expect(wallsSeen).toBeGreaterThan(0);
  });
});
