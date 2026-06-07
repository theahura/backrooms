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
