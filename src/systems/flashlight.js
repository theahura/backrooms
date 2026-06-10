import { updateBattery } from './battery.js';

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

export function updateBatteryWithFlashlight(batteryState, flashlightState, delta) {
  if (!isFlashlightLit(flashlightState)) return batteryState;
  return updateBattery(batteryState, delta);
}
