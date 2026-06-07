import { describe, it, expect } from 'vitest';
import { generateRoomItems, ITEM_TYPES } from '../items.js';

const ROOM_X = 0;
const ROOM_Y = 0;
const ROOM_WIDTH = 1200;
const ROOM_HEIGHT = 1000;
const WALL_THICKNESS = 16;

describe('generateRoomItems', () => {
  it('returns no items for room 0 (starting room)', () => {
    const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42, [], 0);
    expect(items).toEqual([]);
  });

  it('returns 2-5 items for non-starting rooms', () => {
    for (let seed = 0; seed < 10; seed++) {
      const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1);
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items.length).toBeLessThanOrEqual(5);
    }
  });

  it('places items within room bounds', () => {
    const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42, [], 1);

    for (const item of items) {
      expect(item.x).toBeGreaterThan(ROOM_X + WALL_THICKNESS);
      expect(item.y).toBeGreaterThan(ROOM_Y + WALL_THICKNESS);
      expect(item.x).toBeLessThan(ROOM_X + ROOM_WIDTH - WALL_THICKNESS);
      expect(item.y).toBeLessThan(ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS);
    }
  });

  it('does not place items overlapping furniture', () => {
    const furniture = [
      { x: 500, y: 400, width: 200, height: 200 },
      { x: 100, y: 100, width: 300, height: 300 },
    ];

    for (let seed = 0; seed < 20; seed++) {
      const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, furniture, 1);

      for (const item of items) {
        for (const f of furniture) {
          const insideFurniture =
            item.x >= f.x && item.x <= f.x + f.width &&
            item.y >= f.y && item.y <= f.y + f.height;
          expect(insideFurniture).toBe(false);
        }
      }
    }
  });

  it('produces deterministic output for the same seed', () => {
    const first = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99, [], 1);
    const second = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99, [], 1);
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(first).toEqual(second);
  });

  it('produces different output for different seeds', () => {
    const a = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 1, [], 1);
    const b = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 2, [], 1);
    const samePositions = a.length === b.length && a.every((item, i) => item.x === b[i].x && item.y === b[i].y);
    expect(samePositions).toBe(false);
  });

  it('spawns a mix of item types across many seeds', () => {
    const typeCounts = {};
    for (let seed = 0; seed < 50; seed++) {
      const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1);
      for (const item of items) {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
      }
    }
    expect(Object.keys(typeCounts).length).toBeGreaterThanOrEqual(3);
  });
});
