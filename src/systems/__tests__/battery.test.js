import { describe, it, expect } from 'vitest';
import {
  createBatteryState,
  updateBattery,
  getBatteryFraction,
  getFlashlightConeAngle,
  shouldFlicker,
  rechargeBattery,
  getBatteryHint,
  BATTERY_RECHARGE_AMOUNT,
  BATTERY_RECHARGE_PER_MS,
  BATTERY_DRAIN_PER_MS,
} from '../battery.js';

describe('BATTERY_RECHARGE_PER_MS', () => {
  it('recharges slower than the flashlight drains, so the light can never stay on forever', () => {
    expect(BATTERY_RECHARGE_PER_MS).toBeGreaterThan(0);
    expect(BATTERY_RECHARGE_PER_MS).toBeLessThan(BATTERY_DRAIN_PER_MS);
  });
});

describe('createBatteryState', () => {
  it('starts fully charged and not depleted', () => {
    const state = createBatteryState();
    expect(getBatteryFraction(state)).toBe(1);
    expect(state.isDepleted).toBe(false);
  });

  it('accepts custom max charge for longer battery life', () => {
    const state = createBatteryState(130);
    expect(getBatteryFraction(state)).toBe(1);
    expect(state.isDepleted).toBe(false);
    const drained = updateBattery(state, 90000);
    expect(getBatteryFraction(drained)).toBeGreaterThan(0);
    expect(drained.isDepleted).toBe(false);
  });
});

describe('updateBattery', () => {
  it('drains charge over time', () => {
    const state = createBatteryState();
    const updated = updateBattery(state, 1000);
    expect(getBatteryFraction(updated)).toBeLessThan(1);
    expect(getBatteryFraction(updated)).toBeGreaterThan(0);
  });

  it('drains more with larger delta', () => {
    const state = createBatteryState();
    const small = updateBattery(state, 1000);
    const large = updateBattery(state, 5000);
    expect(getBatteryFraction(large)).toBeLessThan(getBatteryFraction(small));
  });

  it('is not depleted at 80 seconds', () => {
    const state = createBatteryState();
    const notYet = updateBattery(state, 80000);
    expect(getBatteryFraction(notYet)).toBeGreaterThan(0);
    expect(notYet.isDepleted).toBe(false);
  });

  it('depletes fully after enough time', () => {
    const state = createBatteryState();
    const depleted = updateBattery(state, 200000);
    expect(getBatteryFraction(depleted)).toBe(0);
    expect(depleted.isDepleted).toBe(true);
  });

  it('does not drain below zero', () => {
    const state = createBatteryState();
    const depleted = updateBattery(state, 200000);
    const overDrained = updateBattery(depleted, 10000);
    expect(getBatteryFraction(overDrained)).toBe(0);
    expect(overDrained.isDepleted).toBe(true);
  });
});

describe('getFlashlightConeAngle', () => {
  const baseCone = Math.PI / 4;

  it('returns full cone angle at full battery', () => {
    const state = createBatteryState();
    expect(getFlashlightConeAngle(state, baseCone)).toBe(baseCone);
  });

  it('returns reduced cone angle at partial battery', () => {
    const state = createBatteryState();
    const halfDrained = updateBattery(state, 45000);
    const angle = getFlashlightConeAngle(halfDrained, baseCone);
    expect(angle).toBeLessThan(baseCone);
    expect(angle).toBeGreaterThan(0);
  });

  it('returns zero when battery is depleted', () => {
    const state = createBatteryState();
    const depleted = updateBattery(state, 200000);
    expect(getFlashlightConeAngle(depleted, baseCone)).toBe(0);
  });

  it('cone angle decreases as battery drains', () => {
    const state = createBatteryState();
    const early = updateBattery(state, 10000);
    const late = updateBattery(state, 60000);
    expect(getFlashlightConeAngle(late, baseCone)).toBeLessThan(
      getFlashlightConeAngle(early, baseCone)
    );
  });
});

describe('shouldFlicker', () => {
  it('does not flicker above 25% battery', () => {
    const state = createBatteryState();
    const healthy = updateBattery(state, 30000);
    expect(getBatteryFraction(healthy)).toBeGreaterThan(0.25);
    for (let t = 0; t < 1000; t += 16) {
      expect(shouldFlicker(healthy, t)).toBe(false);
    }
  });

  it('flickers at low battery for some time values', () => {
    const state = createBatteryState();
    const low = updateBattery(state, 120000);
    expect(getBatteryFraction(low)).toBeLessThan(0.25);
    const results = [];
    for (let t = 0; t < 2000; t += 16) {
      results.push(shouldFlicker(low, t));
    }
    expect(results).toContain(true);
    expect(results).toContain(false);
  });
});

describe('rechargeBattery', () => {
  it('increases charge by the given amount', () => {
    const state = createBatteryState();
    const drained = updateBattery(state, 45000);
    const before = getBatteryFraction(drained);
    const recharged = rechargeBattery(drained, BATTERY_RECHARGE_AMOUNT);
    expect(getBatteryFraction(recharged)).toBeGreaterThan(before);
  });

  it('does not exceed max charge', () => {
    const state = createBatteryState();
    const recharged = rechargeBattery(state, BATTERY_RECHARGE_AMOUNT);
    expect(getBatteryFraction(recharged)).toBe(1);
  });

  it('restores flashlight functionality on a fully depleted battery', () => {
    const baseCone = Math.PI / 4;
    const state = createBatteryState();
    const depleted = updateBattery(state, 200000);
    expect(getFlashlightConeAngle(depleted, baseCone)).toBe(0);
    const recharged = rechargeBattery(depleted, BATTERY_RECHARGE_AMOUNT);
    expect(getFlashlightConeAngle(recharged, baseCone)).toBeGreaterThan(0);
    expect(getBatteryFraction(recharged)).toBeGreaterThan(0);
  });
});

describe('getBatteryHint', () => {
  const lowBattery = () => updateBattery(createBatteryState(), 105000);

  it('returns no hint while the battery is healthy', () => {
    expect(getBatteryHint(createBatteryState(), { batteries: 3 })).toBeNull();
  });

  it('explains how to recharge when low and carrying batteries', () => {
    const hint = getBatteryHint(lowBattery(), { batteries: 2 });
    expect(hint).toMatch(/batter/i);
  });

  it('still explains the mechanic when low with no spares', () => {
    const hint = getBatteryHint(lowBattery(), { batteries: 0 });
    expect(hint).toMatch(/batter/i);
    expect(hint).not.toBe(getBatteryHint(lowBattery(), { batteries: 2 }));
  });
});
