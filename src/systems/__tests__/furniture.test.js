import { describe, it, expect } from 'vitest';
import { createFurnitureSegments, generateRoomFurniture, FURNITURE_TYPES } from '../furniture.js';
import { getFlashlightPolygon } from '../visibility.js';
import { createRoomWalls } from '../room.js';

describe('createFurnitureSegments', () => {
  it('returns 4 segments forming a closed boundary', () => {
    const segments = createFurnitureSegments(50, 50, 80, 40);

    expect(segments).toHaveLength(4);
    for (let i = 0; i < segments.length; i++) {
      const current = segments[i];
      const next = segments[(i + 1) % segments.length];
      expect(current.x2).toBeCloseTo(next.x1, 5);
      expect(current.y2).toBeCloseTo(next.y1, 5);
    }
  });

  it('segments span the correct dimensions', () => {
    const segments = createFurnitureSegments(30, 40, 100, 60);

    const allX = segments.flatMap(s => [s.x1, s.x2]);
    const allY = segments.flatMap(s => [s.y1, s.y2]);
    expect(Math.min(...allX)).toBe(30);
    expect(Math.max(...allX)).toBe(130);
    expect(Math.min(...allY)).toBe(40);
    expect(Math.max(...allY)).toBe(100);
  });
});

describe('generateRoomFurniture', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;

  it('returns furniture items within room bounds', () => {
    const furniture = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42);

    expect(furniture.length).toBeGreaterThanOrEqual(4);
    expect(furniture.length).toBeLessThanOrEqual(8);

    for (const item of furniture) {
      expect(item.x).toBeGreaterThanOrEqual(ROOM_X + WALL_THICKNESS);
      expect(item.y).toBeGreaterThanOrEqual(ROOM_Y + WALL_THICKNESS);
      expect(item.x + item.width).toBeLessThanOrEqual(ROOM_X + ROOM_WIDTH - WALL_THICKNESS);
      expect(item.y + item.height).toBeLessThanOrEqual(ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS);
    }
  });

  it('produces no overlapping furniture', () => {
    const furniture = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42);

    for (let i = 0; i < furniture.length; i++) {
      for (let j = i + 1; j < furniture.length; j++) {
        const a = furniture[i];
        const b = furniture[j];
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('produces deterministic output for the same seed', () => {
    const first = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99);
    const second = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99);

    expect(first).toEqual(second);
  });

  it('produces different output for different seeds', () => {
    const first = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 1);
    const second = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 2);

    expect(first).not.toEqual(second);
  });

});

describe('furniture light blocking behavior', () => {
  it('a table between origin and far wall does NOT reduce visible polygon reach', () => {
    const roomSegments = createRoomWalls(0, 0, 200, 200);
    const tableSegments = createFurnitureSegments(80, 80, 80, 50);
    // Only include segments for light-blocking furniture
    const blocksLight = FURNITURE_TYPES.table.blocksLight;
    const allSegments = blocksLight ? [...roomSegments, ...tableSegments] : roomSegments;

    const origin = { x: 50, y: 100 };
    const angle = 0;
    const coneAngle = Math.PI / 6;

    const polyWithTable = getFlashlightPolygon(origin, angle, coneAngle, allSegments);
    const polyWithoutTable = getFlashlightPolygon(origin, angle, coneAngle, roomSegments);

    const maxXWith = Math.max(...polyWithTable.map(p => p.x));
    const maxXWithout = Math.max(...polyWithoutTable.map(p => p.x));

    // Table should NOT block light (same reach)
    expect(maxXWith).toBe(maxXWithout);
  });

  it('a shelf between origin and far wall DOES reduce visible polygon reach', () => {
    // Use a large room with a shelf that fully blocks a narrow cone
    const roomSegments = createRoomWalls(0, 0, 600, 200);
    // Wide shelf spanning most of the room, positioned to block a narrow cone aimed right
    const shelfSegments = createFurnitureSegments(100, 70, 20, 60);
    const blocksLight = FURNITURE_TYPES.shelf.blocksLight;
    const allSegments = blocksLight ? [...roomSegments, ...shelfSegments] : roomSegments;

    const origin = { x: 50, y: 100 };
    const angle = 0;
    const coneAngle = Math.PI / 16;

    const polyWithShelf = getFlashlightPolygon(origin, angle, coneAngle, allSegments);
    const polyWithoutShelf = getFlashlightPolygon(origin, angle, coneAngle, roomSegments);

    const maxXWith = Math.max(...polyWithShelf.map(p => p.x));
    const maxXWithout = Math.max(...polyWithoutShelf.map(p => p.x));

    expect(maxXWith).toBeLessThan(maxXWithout);
  });
});

describe('furniture blocks flashlight rays', () => {
  it('a furniture item between origin and far wall reduces visible polygon reach', () => {
    const roomSegments = createRoomWalls(0, 0, 200, 200);
    const furnitureSegments = createFurnitureSegments(80, 80, 40, 40);
    const allSegments = [...roomSegments, ...furnitureSegments];

    const origin = { x: 50, y: 100 };
    const angle = 0;
    const coneAngle = Math.PI / 6;

    const polyWithFurniture = getFlashlightPolygon(origin, angle, coneAngle, allSegments);
    const polyWithoutFurniture = getFlashlightPolygon(origin, angle, coneAngle, roomSegments);

    const maxXWith = Math.max(...polyWithFurniture.map(p => p.x));
    const maxXWithout = Math.max(...polyWithoutFurniture.map(p => p.x));

    expect(maxXWith).toBeLessThan(maxXWithout);
  });
});
