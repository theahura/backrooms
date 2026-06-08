import { describe, it, expect } from 'vitest';
import { generateRoomItems } from '../items.js';

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

describe('generateRoomItems', () => {
  it('returns no items for room 0 (starting room)', () => {
    const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42, [], 0, 5);
    expect(items).toEqual([]);
  });

  it('returns at most 2 items for non-starting rooms', () => {
    for (let seed = 0; seed < 20; seed++) {
      const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 4);
      expect(items.length).toBeLessThanOrEqual(2);
    }
  });

  it('generates items sparsely so most rooms hold little or nothing', () => {
    const total = 200;
    let empty = 0;
    for (let seed = 0; seed < total; seed++) {
      const items = generateRoomItems(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 5, 4);
      if (items.length === 0) empty++;
    }
    expect(empty).toBeGreaterThan(total * 0.45);
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
