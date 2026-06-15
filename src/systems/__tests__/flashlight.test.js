import { describe, it, expect } from 'vitest';
import {
  createFlashlightState,
  toggleFlashlight,
  setFlashlightHiding,
  isFlashlightLit,
  updateBatteryWithFlashlight,
} from '../flashlight.js';
import { createBatteryState, updateBattery, getBatteryFraction, BATTERY_RECHARGE_PER_MS } from '../battery.js';

describe('flashlight toggle', () => {
  it('starts lit', () => {
    expect(isFlashlightLit(createFlashlightState())).toBe(true);
  });

  it('toggles off and back on', () => {
    const off = toggleFlashlight(createFlashlightState());
    expect(isFlashlightLit(off)).toBe(false);
    expect(isFlashlightLit(toggleFlashlight(off))).toBe(true);
  });
});

describe('flashlight while hiding', () => {
  it('automatically goes dark while hiding even if switched on', () => {
    const hiding = setFlashlightHiding(createFlashlightState(), true);
    expect(isFlashlightLit(hiding)).toBe(false);
  });

  it('restores the pre-hide switch state after unhiding', () => {
    const state = createFlashlightState();
    const unhidden = setFlashlightHiding(setFlashlightHiding(state, true), false);
    expect(isFlashlightLit(unhidden)).toBe(true);

    const offBefore = toggleFlashlight(state);
    const offAfter = setFlashlightHiding(setFlashlightHiding(offBefore, true), false);
    expect(isFlashlightLit(offAfter)).toBe(false);
  });

  it('stays dark if toggled while hiding, applying the switch after unhiding', () => {
    const hiding = setFlashlightHiding(toggleFlashlight(createFlashlightState()), true);
    const toggledWhileHiding = toggleFlashlight(hiding);
    expect(isFlashlightLit(toggledWhileHiding)).toBe(false);
    expect(isFlashlightLit(setFlashlightHiding(toggledWhileHiding, false))).toBe(true);
  });
});

describe('battery drain gating', () => {
  it('drains the battery while the light is on', () => {
    const battery = createBatteryState();
    const drained = updateBatteryWithFlashlight(battery, createFlashlightState(), 5000);
    expect(getBatteryFraction(drained)).toBeLessThan(getBatteryFraction(battery));
  });

  it('does not drain the battery while the light is off', () => {
    const battery = createBatteryState();
    const off = toggleFlashlight(createFlashlightState());
    const after = updateBatteryWithFlashlight(battery, off, 60000);
    expect(getBatteryFraction(after)).toBe(getBatteryFraction(battery));
  });

  it('does not drain the battery while hiding', () => {
    const battery = createBatteryState();
    const hiding = setFlashlightHiding(createFlashlightState(), true);
    const after = updateBatteryWithFlashlight(battery, hiding, 60000);
    expect(getBatteryFraction(after)).toBe(getBatteryFraction(battery));
  });
});

describe('battery recharge while the light is off (rechargeable battery upgrade)', () => {
  const RATE = BATTERY_RECHARGE_PER_MS;

  it('recharges the battery while the light is off when a recharge rate is supplied', () => {
    const drained = updateBattery(createBatteryState(), 60000);
    const off = toggleFlashlight(createFlashlightState());
    const after = updateBatteryWithFlashlight(drained, off, 30000, RATE);
    expect(getBatteryFraction(after)).toBeGreaterThan(getBatteryFraction(drained));
  });

  it('does NOT recharge while off when no recharge rate is supplied (default behavior)', () => {
    const drained = updateBattery(createBatteryState(), 60000);
    const off = toggleFlashlight(createFlashlightState());
    const after = updateBatteryWithFlashlight(drained, off, 30000);
    expect(getBatteryFraction(after)).toBe(getBatteryFraction(drained));
  });

  it('recharges while hiding (the light is forced off) when a recharge rate is supplied', () => {
    const drained = updateBattery(createBatteryState(), 60000);
    const hiding = setFlashlightHiding(createFlashlightState(), true);
    const after = updateBatteryWithFlashlight(drained, hiding, 30000, RATE);
    expect(getBatteryFraction(after)).toBeGreaterThan(getBatteryFraction(drained));
  });

  it('still drains while the light is ON even when a recharge rate is supplied', () => {
    const battery = createBatteryState();
    const after = updateBatteryWithFlashlight(battery, createFlashlightState(), 5000, RATE);
    expect(getBatteryFraction(after)).toBeLessThan(getBatteryFraction(battery));
  });

  it('does not recharge past a full charge', () => {
    const nearlyFull = updateBattery(createBatteryState(), 1000);
    const off = toggleFlashlight(createFlashlightState());
    const after = updateBatteryWithFlashlight(nearlyFull, off, 10000000, RATE);
    expect(getBatteryFraction(after)).toBe(1);
  });

  it('recovers a fully depleted battery while off', () => {
    const dead = updateBattery(createBatteryState(), 200000);
    expect(dead.isDepleted).toBe(true);
    const off = toggleFlashlight(createFlashlightState());
    const after = updateBatteryWithFlashlight(dead, off, 30000, RATE);
    expect(after.isDepleted).toBe(false);
    expect(getBatteryFraction(after)).toBeGreaterThan(0);
  });
});
