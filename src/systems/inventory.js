const DEFAULT_CAPACITY = 8;

export function createInventoryState(maxItems = DEFAULT_CAPACITY) {
  return {
    batteries: 0,
    treasureValue: 0,
    itemCount: 0,
    maxItems,
  };
}

export function canPickupItem(state) {
  return state.itemCount < state.maxItems;
}

export function pickupItem(state, item) {
  if (state.itemCount >= state.maxItems) return state;
  if (item.type === 'battery') {
    return { ...state, batteries: state.batteries + 1, itemCount: state.itemCount + 1 };
  }
  return { ...state, treasureValue: state.treasureValue + item.value, itemCount: state.itemCount + 1 };
}

export function useBattery(state) {
  if (state.batteries <= 0) {
    return { used: false, state };
  }
  return {
    used: true,
    state: { ...state, batteries: state.batteries - 1, itemCount: Math.max(0, state.itemCount - 1) },
  };
}
