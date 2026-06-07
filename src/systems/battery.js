export const BATTERY_MAX = 100;
export const BATTERY_DRAIN_PER_MS = BATTERY_MAX / 90000;
export const FLICKER_THRESHOLD = 0.25;

export function createBatteryState() {
  return {
    charge: BATTERY_MAX,
    maxCharge: BATTERY_MAX,
    isDepleted: false,
  };
}

export function updateBattery(state, delta) {
  if (state.isDepleted) return state;
  const newCharge = Math.max(0, state.charge - BATTERY_DRAIN_PER_MS * delta);
  return {
    ...state,
    charge: newCharge,
    isDepleted: newCharge <= 0,
  };
}

export function getBatteryFraction(state) {
  return state.charge / state.maxCharge;
}

export function getFlashlightConeAngle(state, baseConeAngle) {
  if (state.isDepleted) return 0;
  const fraction = getBatteryFraction(state);
  const scale = 0.25 + 0.75 * fraction;
  return baseConeAngle * scale;
}

export const BATTERY_RECHARGE_AMOUNT = 30;

export function rechargeBattery(state, amount) {
  const newCharge = Math.min(state.charge + amount, state.maxCharge);
  return {
    ...state,
    charge: newCharge,
    isDepleted: newCharge <= 0,
  };
}

export function shouldFlicker(state, time) {
  const fraction = getBatteryFraction(state);
  if (fraction > FLICKER_THRESHOLD) return false;
  const frequency = 0.02 + 0.03 * (1 - fraction / FLICKER_THRESHOLD);
  return Math.sin(time * frequency) > 0.3;
}
