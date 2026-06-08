import { describe, it, expect } from 'vitest';
import { generateRoomLore, LORE_ENTRIES, getJournalEntries, getJournalPage } from '../lore.js';

const ROOM_X = 0;
const ROOM_Y = 0;
const ROOM_WIDTH = 1200;
const ROOM_HEIGHT = 1000;
const WALL_THICKNESS = 16;

describe('LORE_ENTRIES', () => {
  it('all entries have unique IDs', () => {
    const ids = LORE_ENTRIES.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

});

describe('generateRoomLore', () => {
  it('returns no lore for room 0', () => {
    const lore = generateRoomLore(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42, [], 0, new Set());
    expect(lore).toEqual([]);
  });

  it('returns at most one lore item per room', () => {
    for (let seed = 0; seed < 50; seed++) {
      const lore = generateRoomLore(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, new Set());
      expect(lore.length).toBeLessThanOrEqual(1);
    }
  });

  it('places lore within room bounds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const lore = generateRoomLore(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, new Set());
      for (const item of lore) {
        expect(item.x).toBeGreaterThan(ROOM_X + WALL_THICKNESS);
        expect(item.y).toBeGreaterThan(ROOM_Y + WALL_THICKNESS);
        expect(item.x).toBeLessThan(ROOM_X + ROOM_WIDTH - WALL_THICKNESS);
        expect(item.y).toBeLessThan(ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS);
      }
    }
  });

  it('produces deterministic output for the same seed', () => {
    const first = generateRoomLore(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99, [], 1, new Set());
    const second = generateRoomLore(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99, [], 1, new Set());
    expect(first).toEqual(second);
  });

  it('produces different results for different seeds', () => {
    const results = [];
    for (let seed = 0; seed < 20; seed++) {
      const lore = generateRoomLore(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, new Set());
      if (lore.length > 0) results.push(lore[0]);
    }
    expect(results.length).toBeGreaterThan(1);
    const allSameId = results.every(r => r.loreId === results[0].loreId);
    expect(allSameId).toBe(false);
  });

  it('does not place lore overlapping furniture', () => {
    const furniture = [
      { x: 200, y: 200, width: 800, height: 600 },
    ];
    for (let seed = 0; seed < 50; seed++) {
      const lore = generateRoomLore(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, furniture, 1, new Set());
      for (const item of lore) {
        const inside = item.x >= furniture[0].x && item.x <= furniture[0].x + furniture[0].width &&
                       item.y >= furniture[0].y && item.y <= furniture[0].y + furniture[0].height;
        expect(inside).toBe(false);
      }
    }
  });

  it('spawns lore in some but not all rooms', () => {
    let roomsWithLore = 0;
    const totalRooms = 100;
    for (let seed = 0; seed < totalRooms; seed++) {
      const lore = generateRoomLore(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, new Set());
      if (lore.length > 0) roomsWithLore++;
    }
    expect(roomsWithLore).toBeGreaterThan(0);
    expect(roomsWithLore).toBeLessThan(totalRooms);
  });

  it('skips spawning already-collected lore entries', () => {
    const allIds = new Set(LORE_ENTRIES.map(e => e.id));
    for (let seed = 0; seed < 50; seed++) {
      const lore = generateRoomLore(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, allIds);
      expect(lore).toEqual([]);
    }
  });

});

describe('getJournalEntries', () => {
  it('marks all entries as uncollected when none collected', () => {
    const result = getJournalEntries(new Set());
    expect(result.collectedCount).toBe(0);
    expect(result.totalCount).toBe(LORE_ENTRIES.length);
    expect(result.entries.every(e => e.collected === false)).toBe(true);
  });

  it('marks collected entries correctly when some are collected', () => {
    const collected = new Set([0, 5, 19]);
    const result = getJournalEntries(collected);
    expect(result.collectedCount).toBe(3);
    expect(result.entries.find(e => e.id === 0).collected).toBe(true);
    expect(result.entries.find(e => e.id === 5).collected).toBe(true);
    expect(result.entries.find(e => e.id === 19).collected).toBe(true);
    expect(result.entries.find(e => e.id === 1).collected).toBe(false);
  });

  it('marks all entries as collected when all are collected', () => {
    const allIds = new Set(LORE_ENTRIES.map(e => e.id));
    const result = getJournalEntries(allIds);
    expect(result.collectedCount).toBe(LORE_ENTRIES.length);
    expect(result.entries.every(e => e.collected === true)).toBe(true);
  });

  it('returns entries in ID order', () => {
    const result = getJournalEntries(new Set([19, 0, 10]));
    for (let i = 1; i < result.entries.length; i++) {
      expect(result.entries[i].id).toBeGreaterThan(result.entries[i - 1].id);
    }
  });

  it('returns an entry for every lore note in the game', () => {
    const result = getJournalEntries(new Set());
    expect(result.entries.length).toBe(LORE_ENTRIES.length);
  });
});

describe('getJournalPage', () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({ id: i, text: `text ${i}`, collected: i < 10 }));

  it('returns the correct entries for the first page', () => {
    const result = getJournalPage(entries, 0, 5);
    expect(result.pageEntries.length).toBe(5);
    expect(result.pageEntries[0].id).toBe(0);
    expect(result.pageEntries[4].id).toBe(4);
  });

  it('returns fewer entries on the last page when not evenly divisible', () => {
    const result = getJournalPage(entries, 3, 6);
    expect(result.pageEntries.length).toBe(2);
    expect(result.pageEntries[0].id).toBe(18);
  });

  it('computes the correct total page count', () => {
    expect(getJournalPage(entries, 0, 5).totalPages).toBe(4);
    expect(getJournalPage(entries, 0, 6).totalPages).toBe(4);
    expect(getJournalPage(entries, 0, 20).totalPages).toBe(1);
  });

  it('clamps page to valid range', () => {
    const result = getJournalPage(entries, 99, 5);
    expect(result.currentPage).toBe(3);
    expect(result.pageEntries[0].id).toBe(15);

    const result2 = getJournalPage(entries, -5, 5);
    expect(result2.currentPage).toBe(0);
  });
});
