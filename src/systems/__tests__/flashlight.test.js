import { describe, it, expect } from 'vitest';
import {
  createFlashlightState,
  toggleFlashlight,
  setFlashlightHiding,
  isFlashlightLit,
  updateBatteryWithFlashlight,
} from '../flashlight.js';
import { createBatteryState, getBatteryFraction } from '../battery.js';

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
