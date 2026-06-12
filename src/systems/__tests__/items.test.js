import { describe, it, expect } from 'vitest';
import { generateRoomItems } from '../items.js';
import { generateMazeWalls } from '../maze.js';

const ROOM_X = 0;
const ROOM_Y = 0;
const ROOM_WIDTH = 1200;
const ROOM_HEIGHT = 1000;
const WALL_THICKNESS = 16;

function generateAcrossSeeds(distance, seeds, roomId = 5, seedStart = 0) {
  const all = [];
  for (let seed = seedStart; seed < seedStart + seeds; seed++) {
    all.push(
      ...generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], roomId, distance)
    );
  }
  return all;
}

function countsAcrossSeeds(distance, seeds, roomId = 5) {
  const counts = [];
  for (let seed = 0; seed < seeds; seed++) {
    counts.push(
      generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], roomId, distance).length
    );
  }
  return counts;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('generateRoomItems', () => {
  it('returns no items for room 0 (starting room)', () => {
    const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42, [], 0, 5);
    expect(items).toEqual([]);
  });

  it('returns at most 3 items near the entrance and at most 2 farther out', () => {
    for (const distance of [1, 2, 3]) {
      const counts = countsAcrossSeeds(distance, 300);
      expect(counts.some(c => c === 3)).toBe(true);
      for (const count of counts) {
        expect(count).toBeLessThanOrEqual(3);
      }
    }
    for (const distance of [4, 7, 8, 12]) {
      for (const count of countsAcrossSeeds(distance, 300)) {
        expect(count).toBeLessThanOrEqual(2);
      }
    }
  });

  it('spawns items generously in rooms near the entrance', () => {
    const counts = countsAcrossSeeds(2, 300);
    expect(mean(counts)).toBeGreaterThanOrEqual(1.2);
    expect(counts.some(c => c === 3)).toBe(true);
    expect(counts.some(c => c === 0)).toBe(true);
  });

  it('generates items sparsely in deep rooms so most hold little or nothing', () => {
    const counts = countsAcrossSeeds(8, 300);
    const empty = counts.filter(c => c === 0).length;
    expect(empty).toBeGreaterThan(counts.length * 0.45);
  });

  it('tapers the item count down as distance from the entrance grows', () => {
    const near = mean(countsAcrossSeeds(2, 300));
    const mid = mean(countsAcrossSeeds(5, 300));
    const midEdge = mean(countsAcrossSeeds(7, 300));
    const deep = mean(countsAcrossSeeds(8, 300));
    expect(near).toBeGreaterThan(mid);
    expect(midEdge).toBeGreaterThan(deep);
  });

  it('places items within room bounds', () => {
    for (let seed = 0; seed < 20; seed++) {
      const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 4);
      for (const item of items) {
        expect(item.x).toBeGreaterThan(ROOM_X + WALL_THICKNESS);
        expect(item.y).toBeGreaterThan(ROOM_Y + WALL_THICKNESS);
        expect(item.x).toBeLessThan(ROOM_X + ROOM_WIDTH - WALL_THICKNESS);
        expect(item.y).toBeLessThan(ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS);
      }
    }
  });

  it('does not place items overlapping furniture', () => {
    const furniture = [
      { x: 500, y: 400, width: 200, height: 200 },
      { x: 100, y: 100, width: 300, height: 300 },
    ];

    for (let seed = 0; seed < 40; seed++) {
      const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, furniture, 1, 4);

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
    const first = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99, [], 1, 4);
    const second = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99, [], 1, 4);
    expect(first).toEqual(second);
  });

  it('treasure is worth more on average the farther a room is from the entrance', () => {
    const avgValue = (items) => {
      const treasures = items.filter(i => i.value > 0);
      return treasures.reduce((sum, i) => sum + i.value, 0) / treasures.length;
    };
    const near = generateAcrossSeeds(1, 300);
    const far = generateAcrossSeeds(7, 300);
    expect(avgValue(far)).toBeGreaterThan(avgValue(near));
  });

  it('keeps gems out of rooms near the entrance but lets them appear deep', () => {
    const nearGems = generateAcrossSeeds(1, 400).filter(i => i.type === 'gem').length;
    const deepGems = generateAcrossSeeds(7, 400).filter(i => i.type === 'gem').length;
    expect(nearGems).toBe(0);
    expect(deepGems).toBeGreaterThan(0);
  });

  it('makes copper coins common near the entrance but absent deep', () => {
    const nearCopper = generateAcrossSeeds(1, 300).filter(i => i.type === 'copper_coin').length;
    const deepCopper = generateAcrossSeeds(7, 300).filter(i => i.type === 'copper_coin').length;
    expect(nearCopper).toBeGreaterThan(0);
    expect(deepCopper).toBe(0);
  });

  it('still supplies batteries and ammo at both near and far distances', () => {
    const near = generateAcrossSeeds(1, 200);
    const far = generateAcrossSeeds(7, 200);
    const has = (items, type) => items.some(i => i.type === type);
    expect(has(near, 'battery')).toBe(true);
    expect(has(far, 'battery')).toBe(true);
    expect(has(near, 'ammo')).toBe(true);
    expect(has(far, 'ammo')).toBe(true);
  });

  it('produces different output for different seeds', () => {
    const a = generateAcrossSeeds(4, 30, 1, 0);
    const b = generateAcrossSeeds(4, 30, 1, 1000);
    expect(a).not.toEqual(b);
  });

  it('spawns a mix of item types across many seeds', () => {
    const typeCounts = {};
    for (let seed = 0; seed < 200; seed++) {
      const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 5);
      for (const item of items) {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
      }
    }
    expect(Object.keys(typeCounts).length).toBeGreaterThanOrEqual(3);
  });

});

describe('generateRoomItems wall avoidance', () => {
  const doors = [{ wall: 'east', offset: 400, width: 80, targetRoomId: 1 }];

  const insideRect = (p, r) =>
    p.x >= r.x && p.x <= r.x + r.width &&
    p.y >= r.y && p.y <= r.y + r.height;

  it('does not place items overlapping a supplied obstacle rect', () => {
    const obstacle = { x: 300, y: 250, width: 500, height: 500 };
    for (let seed = 0; seed < 120; seed++) {
      const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 4, [obstacle]);
      for (const item of items) {
        expect(insideRect(item, obstacle), `seed ${seed}`).toBe(false);
      }
    }
  });

  it('does not place items overlapping the real maze walls of the same room', () => {
    let wallsSeen = 0;
    for (let seed = 0; seed < 150; seed++) {
      const walls = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
      wallsSeen += walls.length;
      const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 4, walls);
      for (const item of items) {
        for (const wall of walls) {
          expect(insideRect(item, wall), `seed ${seed}`).toBe(false);
        }
      }
    }
    expect(wallsSeen).toBeGreaterThan(0);
  });

  it('produces the same items whether obstacles is omitted or passed empty', () => {
    for (const seed of [3, 11, 42, 99, 123]) {
      const omitted = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 4);
      const empty = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 4, []);
      expect(empty, `seed ${seed}`).toEqual(omitted);
    }
  });
});
