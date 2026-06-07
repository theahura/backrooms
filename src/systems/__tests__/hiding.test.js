import { describe, it, expect } from 'vitest';
import {
  createHidingState,
  enterHiding,
  exitHiding,
  findNearestHideable,
  HIDE_INTERACT_RANGE,
} from '../hiding.js';

function makeFurnitureMap(entries) {
  const map = new Map();
  for (const [roomId, items] of entries) {
    map.set(roomId, items);
  }
  return map;
}

function makeHideableFurniture(x, y, overrides = {}) {
  return {
    type: 'table',
    x,
    y,
    width: 80,
    height: 50,
    color: 0x5c3a21,
    canHide: true,
    ...overrides,
  };
}

describe('createHidingState', () => {
  it('starts not hiding', () => {
    const state = createHidingState();
    expect(state.isHiding).toBe(false);
  });

  it('starts with no furniture reference', () => {
    const state = createHidingState();
    expect(state.furnitureRef).toBeNull();
  });
});

describe('enterHiding', () => {
  it('sets isHiding to true', () => {
    const state = createHidingState();
    const ref = { x: 100, y: 100 };
    const result = enterHiding(state, ref);
    expect(result.isHiding).toBe(true);
  });

  it('stores the furniture reference', () => {
    const state = createHidingState();
    const ref = { x: 100, y: 100 };
    const result = enterHiding(state, ref);
    expect(result.furnitureRef).toBe(ref);
  });

  it('does not mutate the original state', () => {
    const state = createHidingState();
    const ref = { x: 100, y: 100 };
    const result = enterHiding(state, ref);
    expect(state.isHiding).toBe(false);
    expect(result).not.toBe(state);
  });
});

describe('exitHiding', () => {
  it('sets isHiding to false', () => {
    const state = enterHiding(createHidingState(), { x: 100, y: 100 });
    const result = exitHiding(state);
    expect(result.isHiding).toBe(false);
  });

  it('clears the furniture reference', () => {
    const state = enterHiding(createHidingState(), { x: 100, y: 100 });
    const result = exitHiding(state);
    expect(result.furnitureRef).toBeNull();
  });

  it('does not mutate the original state', () => {
    const state = enterHiding(createHidingState(), { x: 100, y: 100 });
    const result = exitHiding(state);
    expect(state.isHiding).toBe(true);
    expect(result).not.toBe(state);
  });
});

describe('findNearestHideable', () => {
  it('returns nearest canHide furniture when player is within range', () => {
    const table = makeHideableFurniture(100, 100);
    const map = makeFurnitureMap([[0, [table]]]);
    const center = { x: table.x + table.width / 2, y: table.y + table.height / 2 };
    const result = findNearestHideable(map, center.x + 10, center.y + 10, HIDE_INTERACT_RANGE);
    expect(result).not.toBeNull();
    expect(result.furniture).toBe(table);
  });

  it('returns null when no furniture is in range', () => {
    const table = makeHideableFurniture(100, 100);
    const map = makeFurnitureMap([[0, [table]]]);
    const result = findNearestHideable(map, 500, 500, HIDE_INTERACT_RANGE);
    expect(result).toBeNull();
  });

  it('returns null when furniture exists but none have canHide true', () => {
    const shelf = makeHideableFurniture(100, 100, { type: 'shelf', canHide: false });
    const map = makeFurnitureMap([[0, [shelf]]]);
    const center = { x: shelf.x + shelf.width / 2, y: shelf.y + shelf.height / 2 };
    const result = findNearestHideable(map, center.x, center.y, HIDE_INTERACT_RANGE);
    expect(result).toBeNull();
  });

  it('returns the closest when multiple hideable furniture are in range', () => {
    const far = makeHideableFurniture(100, 100);
    const near = makeHideableFurniture(200, 100, { type: 'desk', width: 60, height: 40 });
    const map = makeFurnitureMap([[0, [far, near]]]);
    const nearCenter = { x: near.x + near.width / 2, y: near.y + near.height / 2 };
    const result = findNearestHideable(map, nearCenter.x + 5, nearCenter.y, HIDE_INTERACT_RANGE);
    expect(result.furniture).toBe(near);
  });

  it('returns null for empty furniture map', () => {
    const map = makeFurnitureMap([]);
    const result = findNearestHideable(map, 100, 100, HIDE_INTERACT_RANGE);
    expect(result).toBeNull();
  });

  it('searches across multiple rooms', () => {
    const table1 = makeHideableFurniture(100, 100);
    const table2 = makeHideableFurniture(500, 500);
    const map = makeFurnitureMap([[0, [table1]], [1, [table2]]]);
    const center2 = { x: table2.x + table2.width / 2, y: table2.y + table2.height / 2 };
    const result = findNearestHideable(map, center2.x, center2.y, HIDE_INTERACT_RANGE);
    expect(result.furniture).toBe(table2);
    expect(result.roomId).toBe(1);
  });

  it('returns a center within the furniture bounds', () => {
    const table = makeHideableFurniture(200, 300);
    const map = makeFurnitureMap([[0, [table]]]);
    const center = { x: table.x + table.width / 2, y: table.y + table.height / 2 };
    const result = findNearestHideable(map, center.x, center.y, HIDE_INTERACT_RANGE);
    expect(result.center.x).toBeGreaterThanOrEqual(table.x);
    expect(result.center.x).toBeLessThanOrEqual(table.x + table.width);
    expect(result.center.y).toBeGreaterThanOrEqual(table.y);
    expect(result.center.y).toBeLessThanOrEqual(table.y + table.height);
  });
});
