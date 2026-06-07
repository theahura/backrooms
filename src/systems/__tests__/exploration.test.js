import { describe, it, expect } from 'vitest';
import {
  createExplorationState,
  getCurrentRoom,
  updateExploration,
  getMinimapData,
} from '../exploration.js';

function makeRoom(id, gridX, gridY, overrides = {}) {
  return {
    id,
    gridX,
    gridY,
    x: gridX * 1200,
    y: gridY * 1000,
    width: 1200,
    height: 1000,
    doors: [],
    seed: id * 1000,
    ...overrides,
  };
}

function makeRooms() {
  return [
    makeRoom(0, 0, 0),
    makeRoom(1, 1, 0),
    makeRoom(2, 0, 1),
    makeRoom(3, -1, 0),
  ];
}

function makeLevelBounds(rooms) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rooms) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  return { minX, minY, maxX, maxY };
}

describe('createExplorationState', () => {
  it('starts with no visited rooms and no current room', () => {
    const state = createExplorationState();
    expect(state.visitedRoomIds.size).toBe(0);
    expect(state.currentRoomId).toBeNull();
  });
});

describe('getCurrentRoom', () => {
  it('returns the room when player is inside it', () => {
    const rooms = makeRooms();
    const result = getCurrentRoom(600, 500, rooms);
    expect(result).not.toBeNull();
    expect(result.id).toBe(0);
  });

  it('returns the correct room when player is in a different room', () => {
    const rooms = makeRooms();
    const result = getCurrentRoom(1800, 500, rooms);
    expect(result).not.toBeNull();
    expect(result.id).toBe(1);
  });

  it('returns null when player is outside all rooms', () => {
    const rooms = makeRooms();
    const result = getCurrentRoom(5000, 5000, rooms);
    expect(result).toBeNull();
  });

  it('handles player at room boundary (inclusive)', () => {
    const rooms = makeRooms();
    const result = getCurrentRoom(0, 0, rooms);
    expect(result).not.toBeNull();
    expect(result.id).toBe(0);
  });
});

describe('updateExploration', () => {
  it('adds current room to visited set', () => {
    const state = createExplorationState();
    const rooms = makeRooms();
    const result = updateExploration(state, 600, 500, rooms);
    expect(result.visitedRoomIds.has(0)).toBe(true);
  });

  it('sets currentRoomId to the room the player is in', () => {
    const state = createExplorationState();
    const rooms = makeRooms();
    const result = updateExploration(state, 600, 500, rooms);
    expect(result.currentRoomId).toBe(0);
  });

  it('preserves previously visited rooms when entering a new room', () => {
    const state = createExplorationState();
    const rooms = makeRooms();
    const after0 = updateExploration(state, 600, 500, rooms);
    const after1 = updateExploration(after0, 1800, 500, rooms);
    expect(after1.visitedRoomIds.has(0)).toBe(true);
    expect(after1.visitedRoomIds.has(1)).toBe(true);
    expect(after1.currentRoomId).toBe(1);
  });

  it('keeps currentRoomId unchanged when player is between rooms', () => {
    const state = createExplorationState();
    const rooms = makeRooms();
    const inRoom = updateExploration(state, 600, 500, rooms);
    const between = updateExploration(inRoom, 5000, 5000, rooms);
    expect(between.currentRoomId).toBe(0);
    expect(between.visitedRoomIds.has(0)).toBe(true);
  });

  it('does not mutate the original state', () => {
    const state = createExplorationState();
    const rooms = makeRooms();
    const result = updateExploration(state, 600, 500, rooms);
    expect(state.visitedRoomIds.size).toBe(0);
    expect(state.currentRoomId).toBeNull();
    expect(result).not.toBe(state);
  });

  it('returns the same state object when nothing changes', () => {
    const rooms = makeRooms();
    const s1 = updateExploration(createExplorationState(), 600, 500, rooms);
    const s2 = updateExploration(s1, 600, 500, rooms);
    expect(s2).toBe(s1);
  });
});

describe('getMinimapData', () => {
  it('returns only visited rooms as rectangles', () => {
    const rooms = makeRooms();
    const bounds = makeLevelBounds(rooms);
    let state = createExplorationState();
    state = updateExploration(state, 600, 500, rooms);
    const data = getMinimapData(state, rooms, bounds, { x: 600, y: 500 }, { x: 48, y: 48 }, 800);
    expect(data.roomRects.length).toBe(1);
  });

  it('marks the current room as current', () => {
    const rooms = makeRooms();
    const bounds = makeLevelBounds(rooms);
    let state = createExplorationState();
    state = updateExploration(state, 600, 500, rooms);
    state = updateExploration(state, 1800, 500, rooms);
    const data = getMinimapData(state, rooms, bounds, { x: 1800, y: 500 }, { x: 48, y: 48 }, 800);
    const currentRect = data.roomRects.find(r => r.isCurrent);
    expect(currentRect).toBeDefined();
    const nonCurrentRects = data.roomRects.filter(r => !r.isCurrent);
    expect(nonCurrentRects.length).toBe(1);
  });

  it('returns player dot position within the minimap background area', () => {
    const rooms = makeRooms();
    const bounds = makeLevelBounds(rooms);
    let state = createExplorationState();
    state = updateExploration(state, 600, 500, rooms);
    const data = getMinimapData(state, rooms, bounds, { x: 600, y: 500 }, { x: 48, y: 48 }, 800);
    const bg = data.bgRect;
    expect(data.playerDot.x).toBeGreaterThanOrEqual(bg.x);
    expect(data.playerDot.x).toBeLessThanOrEqual(bg.x + bg.w);
    expect(data.playerDot.y).toBeGreaterThanOrEqual(bg.y);
    expect(data.playerDot.y).toBeLessThanOrEqual(bg.y + bg.h);
  });

  it('returns exit dot position within the minimap background area', () => {
    const rooms = makeRooms();
    const bounds = makeLevelBounds(rooms);
    let state = createExplorationState();
    state = updateExploration(state, 600, 500, rooms);
    const data = getMinimapData(state, rooms, bounds, { x: 600, y: 500 }, { x: 48, y: 48 }, 800);
    const bg = data.bgRect;
    expect(data.exitDot.x).toBeGreaterThanOrEqual(bg.x);
    expect(data.exitDot.x).toBeLessThanOrEqual(bg.x + bg.w);
    expect(data.exitDot.y).toBeGreaterThanOrEqual(bg.y);
    expect(data.exitDot.y).toBeLessThanOrEqual(bg.y + bg.h);
  });

  it('handles no visited rooms gracefully', () => {
    const rooms = makeRooms();
    const bounds = makeLevelBounds(rooms);
    const state = createExplorationState();
    const data = getMinimapData(state, rooms, bounds, { x: 600, y: 500 }, { x: 48, y: 48 }, 800);
    expect(data.roomRects.length).toBe(0);
    expect(data.playerDot).toBeDefined();
    expect(data.exitDot).toBeDefined();
  });

  it('repositions minimap when screen width changes', () => {
    const rooms = makeRooms();
    const bounds = makeLevelBounds(rooms);
    let state = createExplorationState();
    state = updateExploration(state, 600, 500, rooms);
    const narrow = getMinimapData(state, rooms, bounds, { x: 600, y: 500 }, { x: 48, y: 48 }, 800);
    const wide = getMinimapData(state, rooms, bounds, { x: 600, y: 500 }, { x: 48, y: 48 }, 1200);
    expect(wide.bgRect.x).toBeGreaterThan(narrow.bgRect.x);
  });

  it('correctly maps player in negative-coordinate room', () => {
    const rooms = makeRooms();
    const bounds = makeLevelBounds(rooms);
    let state = createExplorationState();
    state = updateExploration(state, -600, 500, rooms);
    const data = getMinimapData(state, rooms, bounds, { x: -600, y: 500 }, { x: 48, y: 48 }, 800);
    const bg = data.bgRect;
    expect(data.playerDot.x).toBeGreaterThanOrEqual(bg.x);
    expect(data.playerDot.x).toBeLessThanOrEqual(bg.x + bg.w);
    expect(data.roomRects.length).toBe(1);
  });
});
