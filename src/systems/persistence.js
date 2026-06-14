export const SAVE_KEY = 'backrooms_save';
export const SAVE_VERSION = 4;

// Positive 31-bit ceiling for a world seed. Staying below 2^31 keeps the base
// seed a positive value after the `| 0` truncation in mulberry32/hashU32 and
// leaves headroom for the per-floor `seed + floor*1000` derivation across the
// shallow floor depths the game reaches. (Even a wrap would stay deterministic,
// since every generator is a fixed function of the integer seed.)
export const MAX_WORLD_SEED = 0x7fffffff;

// Mint a fresh world seed in [1, MAX_WORLD_SEED]. Never returns 0: a seed of 0 is
// a degenerate state for generic mulberry32 generators, and a non-zero range also
// avoids any falsy-seed confusion downstream.
export function generateWorldSeed(rng = Math.random) {
  return 1 + Math.floor(rng() * (MAX_WORLD_SEED - 1));
}

// The world seed is generated ONCE per save and persisted forever, so the level
// stays stable day-to-day for a player while differing between players. Reuse a
// stored seed if it is a valid positive integer; otherwise (absent/corrupt/old
// save) mint a fresh one. Uses Number.isInteger -- never truthiness -- so a stored
// seed is never clobbered.
export function resolveWorldSeed(savedSeed, rng = Math.random) {
  return Number.isInteger(savedSeed) && savedSeed > 0 ? savedSeed : generateWorldSeed(rng);
}

export function saveGame(shopState, runCount, collectedLore = [], unlockedLocations = ['store'], activeLocation = 'store', worldSeed = null) {
  try {
    const data = { version: SAVE_VERSION, shopState, runCount, collectedLore, unlockedLocations, activeLocation, worldSeed };
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
      worldSeed: data.worldSeed ?? null,
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
