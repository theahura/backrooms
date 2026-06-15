import { updateBattery, rechargeBattery } from './battery.js';

export function createFlashlightState() {
  return { on: true, hiding: false };
}

export function toggleFlashlight(state) {
  return { ...state, on: !state.on };
}

export function setFlashlightHiding(state, hiding) {
  return { ...state, hiding };
}

export function isFlashlightLit(state) {
  return state.on && !state.hiding;
}

export function updateBatteryWithFlashlight(batteryState, flashlightState, delta, rechargeRatePerMs = 0) {
  if (!isFlashlightLit(flashlightState)) {
    if (rechargeRatePerMs > 0) return rechargeBattery(batteryState, rechargeRatePerMs * delta);
    return batteryState;
  }
  return updateBattery(batteryState, delta);
}
