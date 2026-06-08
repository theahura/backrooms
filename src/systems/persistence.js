export const SAVE_KEY = 'backrooms_save';
export const SAVE_VERSION = 3;

export function saveGame(shopState, runCount, collectedLore = [], unlockedLocations = ['store'], activeLocation = 'store') {
  try {
    const data = { version: SAVE_VERSION, shopState, runCount, collectedLore, unlockedLocations, activeLocation };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.version > SAVE_VERSION) return null;
    if (!data.shopState || typeof data.shopState.gold !== 'number' || typeof data.shopState.upgrades !== 'object') return null;
    return {
      shopState: data.shopState,
      runCount: data.runCount ?? 0,
      collectedLore: data.collectedLore ?? [],
      unlockedLocations: data.unlockedLocations ?? ['store'],
      activeLocation: data.activeLocation ?? 'store',
    };
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
  }
}
