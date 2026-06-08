import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveGame,
  loadGame,
  clearSave,
  SAVE_KEY,
  SAVE_VERSION,
} from '../persistence.js';

function createMockStorage() {
  const store = {};
  return {
    getItem(key) { return key in store ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
  };
}

let originalLocalStorage;

beforeEach(() => {
  originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = createMockStorage();
});

afterEach(() => {
  globalThis.localStorage = originalLocalStorage;
});

describe('saveGame and loadGame round-trip', () => {
  it('persists shop state and run count across save/load', () => {
    const shopState = {
      gold: 450,
      upgrades: { battery: 2, flashlight: 1, health: 0, speed: 3 },
    };

    saveGame(shopState, 7);
    const loaded = loadGame();

    expect(loaded).toEqual({
      shopState: { gold: 450, upgrades: { battery: 2, flashlight: 1, health: 0, speed: 3 } },
      runCount: 7,
      collectedLore: [],
      unlockedLocations: ['store'],
      activeLocation: 'store',
    });
  });

  it('preserves zero values correctly', () => {
    const shopState = {
      gold: 0,
      upgrades: { battery: 0, flashlight: 0, health: 0, speed: 0 },
    };
    saveGame(shopState, 0);
    const loaded = loadGame();

    expect(loaded.shopState.gold).toBe(0);
    expect(loaded.runCount).toBe(0);
  });
});

describe('loadGame', () => {
  it('returns null when no save exists', () => {
    expect(loadGame()).toBeNull();
  });

  it('returns null when saved data is corrupted JSON', () => {
    localStorage.setItem(SAVE_KEY, 'not valid json {{{');
    expect(loadGame()).toBeNull();
  });

  it('returns null when save version is higher than current', () => {
    const futureData = {
      version: SAVE_VERSION + 1,
      shopState: { gold: 100, upgrades: { battery: 1, flashlight: 0, health: 0, speed: 0 } },
      runCount: 5,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(futureData));
    expect(loadGame()).toBeNull();
  });

  it('defaults runCount to 0 when missing from saved data', () => {
    const oldData = {
      version: 1,
      shopState: { gold: 200, upgrades: { battery: 1, flashlight: 0, health: 0, speed: 0 } },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(oldData));
    const loaded = loadGame();

    expect(loaded.shopState.gold).toBe(200);
    expect(loaded.runCount).toBe(0);
  });

  it('returns null when saved data has invalid shopState shape', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, shopState: 'not an object', runCount: 0 }));
    expect(loadGame()).toBeNull();

    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, shopState: { upgrades: {} }, runCount: 0 }));
    expect(loadGame()).toBeNull();

    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, runCount: 0 }));
    expect(loadGame()).toBeNull();
  });

  it('returns null when localStorage.getItem throws', () => {
    globalThis.localStorage = {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
      removeItem() { throw new Error('SecurityError'); },
    };

    expect(loadGame()).toBeNull();
  });
});

describe('saveGame', () => {
  it('does not throw when localStorage is unavailable', () => {
    globalThis.localStorage = {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
      removeItem() { throw new Error('SecurityError'); },
    };

    expect(() => saveGame({ gold: 0, upgrades: {} }, 0)).not.toThrow();
  });
});

describe('collectedLore persistence', () => {
  it('round-trips collectedLore through save/load', () => {
    const shopState = {
      gold: 100,
      upgrades: { battery: 0, flashlight: 0, health: 0, speed: 0 },
    };
    saveGame(shopState, 3, [1, 5, 12]);
    const loaded = loadGame();
    expect(loaded.collectedLore).toEqual([1, 5, 12]);
  });

  it('defaults collectedLore to empty array for v1 saves', () => {
    const oldData = {
      version: 1,
      shopState: { gold: 200, upgrades: { battery: 1, flashlight: 0, health: 0, speed: 0 } },
      runCount: 2,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(oldData));
    const loaded = loadGame();
    expect(loaded.collectedLore).toEqual([]);
  });

  it('preserves collectedLore across multiple save cycles', () => {
    const shopState = {
      gold: 50,
      upgrades: { battery: 0, flashlight: 0, health: 0, speed: 0 },
    };
    saveGame(shopState, 1, [3, 7]);
    const loaded1 = loadGame();
    expect(loaded1.collectedLore).toEqual([3, 7]);

    saveGame(loaded1.shopState, loaded1.runCount, [...loaded1.collectedLore, 15]);
    const loaded2 = loadGame();
    expect(loaded2.collectedLore).toEqual([3, 7, 15]);
  });
});

describe('location persistence', () => {
  it('round-trips unlockedLocations and activeLocation through save/load', () => {
    const shopState = {
      gold: 100,
      upgrades: { battery: 0, flashlight: 0, health: 0, speed: 0 },
    };
    saveGame(shopState, 3, [], ['store', 'office'], 'office');
    const loaded = loadGame();
    expect(loaded.unlockedLocations).toEqual(['store', 'office']);
    expect(loaded.activeLocation).toBe('office');
  });

  it('defaults location fields for v2 saves without them', () => {
    const oldData = {
      version: 2,
      shopState: { gold: 200, upgrades: { battery: 1, flashlight: 0, health: 0, speed: 0 } },
      runCount: 5,
      collectedLore: [1, 2],
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(oldData));
    const loaded = loadGame();
    expect(loaded.unlockedLocations).toEqual(['store']);
    expect(loaded.activeLocation).toBe('store');
  });

  it('defaults location fields for v1 saves', () => {
    const oldData = {
      version: 1,
      shopState: { gold: 100, upgrades: { battery: 0, flashlight: 0, health: 0, speed: 0 } },
      runCount: 2,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(oldData));
    const loaded = loadGame();
    expect(loaded.unlockedLocations).toEqual(['store']);
    expect(loaded.activeLocation).toBe('store');
  });
});

describe('clearSave', () => {
  it('removes saved data so loadGame returns null', () => {
    const shopState = { gold: 100, upgrades: { battery: 0, flashlight: 0, health: 0, speed: 0 } };
    saveGame(shopState, 1);
    expect(loadGame()).not.toBeNull();

    clearSave();
    expect(loadGame()).toBeNull();
  });

  it('does not throw when localStorage is unavailable', () => {
    globalThis.localStorage = {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
      removeItem() { throw new Error('SecurityError'); },
    };

    expect(() => clearSave()).not.toThrow();
  });
});
