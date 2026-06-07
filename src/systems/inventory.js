export function createInventoryState() {
  return {
    batteries: 0,
    treasureValue: 0,
  };
}

export function pickupItem(state, item) {
  if (item.type === 'battery') {
    return { ...state, batteries: state.batteries + 1 };
  }
  return { ...state, treasureValue: state.treasureValue + item.value };
}

export function useBattery(state) {
  if (state.batteries <= 0) {
    return { used: false, state };
  }
  return {
    used: true,
    state: { ...state, batteries: state.batteries - 1 },
  };
}
