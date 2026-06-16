import { describe, it, expect } from 'vitest';
import { createInventoryState, pickupItem, useBattery, canPickupItem, grantBatteries } from '../inventory.js';

describe('createInventoryState', () => {
  it('starts with 0 batteries, 0 treasure value, and default capacity', () => {
    const state = createInventoryState();
    expect(state.batteries).toBe(0);
    expect(state.treasureValue).toBe(0);
    expect(state.maxItems).toBe(8);
  });
});

describe('pickupItem', () => {
  it('increments battery count when picking up a battery', () => {
    const state = createInventoryState();
    const updated = pickupItem(state, { type: 'battery', value: 0 });
    expect(updated.batteries).toBe(1);
    expect(updated.treasureValue).toBe(0);
  });

  it('adds value to treasureValue when picking up treasure', () => {
    const state = createInventoryState();
    const updated = pickupItem(state, { type: 'gold_coin', value: 200 });
    expect(updated.batteries).toBe(0);
    expect(updated.treasureValue).toBe(200);
  });

  it('accumulates multiple pickups correctly', () => {
    let state = createInventoryState();
    state = pickupItem(state, { type: 'battery', value: 0 });
    state = pickupItem(state, { type: 'battery', value: 0 });
    state = pickupItem(state, { type: 'battery', value: 0 });
    state = pickupItem(state, { type: 'copper_coin', value: 10 });
    state = pickupItem(state, { type: 'gold_coin', value: 200 });
    state = pickupItem(state, { type: 'gem', value: 1000 });

    expect(state.batteries).toBe(3);
    expect(state.treasureValue).toBe(1210);
  });
});

describe('useBattery', () => {
  it('returns used=true and decrements battery count when batteries available', () => {
    let state = createInventoryState();
    state = pickupItem(state, { type: 'battery', value: 0 });
    state = pickupItem(state, { type: 'battery', value: 0 });

    const result = useBattery(state);
    expect(result.used).toBe(true);
    expect(result.state.batteries).toBe(1);
  });

  it('returns used=false and unchanged state when no batteries', () => {
    const state = createInventoryState();
    const result = useBattery(state);
    expect(result.used).toBe(false);
    expect(result.state.batteries).toBe(0);
  });

  it('does not affect treasure value when using a battery', () => {
    let state = createInventoryState();
    state = pickupItem(state, { type: 'battery', value: 0 });
    state = pickupItem(state, { type: 'gold_coin', value: 200 });

    const result = useBattery(state);
    expect(result.state.treasureValue).toBe(200);
  });

  it('does not decrement itemCount below 0 when no batteries', () => {
    const state = createInventoryState();
    const result = useBattery(state);
    expect(result.state.itemCount).toBe(0);
  });
});

describe('inventory capacity', () => {
  it('createInventoryState accepts custom maxItems', () => {
    const state = createInventoryState(12);
    expect(state.maxItems).toBe(12);
  });

  it('canPickupItem returns true when under capacity', () => {
    const state = createInventoryState(8);
    expect(canPickupItem(state)).toBe(true);
  });

  it('canPickupItem returns false when at capacity', () => {
    let state = createInventoryState(3);
    state = pickupItem(state, { type: 'battery', value: 0 });
    state = pickupItem(state, { type: 'copper_coin', value: 10 });
    state = pickupItem(state, { type: 'gold_coin', value: 200 });
    expect(canPickupItem(state)).toBe(false);
  });

  it('using a battery frees a slot allowing more pickups', () => {
    let state = createInventoryState(2);
    state = pickupItem(state, { type: 'battery', value: 0 });
    state = pickupItem(state, { type: 'copper_coin', value: 10 });
    expect(canPickupItem(state)).toBe(false);

    const result = useBattery(state);
    expect(canPickupItem(result.state)).toBe(true);
  });
});

describe('grantBatteries', () => {
  it('adds the requested batteries and fills that many slots', () => {
    const state = createInventoryState(8);
    const next = grantBatteries(state, 3);
    expect(next.batteries).toBe(3);
    expect(next.itemCount).toBe(3);
  });

  it('never grants more batteries than the backpack can hold', () => {
    const state = createInventoryState(2);
    const next = grantBatteries(state, 5);
    expect(next.batteries).toBe(2);
    expect(next.itemCount).toBe(2);
  });

  it('is a no-op when granting zero', () => {
    const state = createInventoryState(8);
    const next = grantBatteries(state, 0);
    expect(next.batteries).toBe(0);
    expect(next.itemCount).toBe(0);
  });

  it('adds to a partially-filled pack rather than overwriting it', () => {
    let state = createInventoryState(8);
    state = pickupItem(state, { type: 'copper_coin', value: 10 });
    const next = grantBatteries(state, 3);
    expect(next.batteries).toBe(3);
    expect(next.itemCount).toBe(4);
  });

  it('grants nothing when the pack is already full', () => {
    let state = createInventoryState(2);
    state = pickupItem(state, { type: 'battery', value: 0 });
    state = pickupItem(state, { type: 'copper_coin', value: 10 });
    const next = grantBatteries(state, 3);
    expect(next.batteries).toBe(1);
    expect(next.itemCount).toBe(2);
  });
});
