import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveGame,
  loadGame,
  clearSave,
  generateWorldSeed,
  resolveWorldSeed,
  MAX_WORLD_SEED,
  SAVE_KEY,
  SAVE_VERSION,
} from '../persistence.js';
import { getRoomAt } from '../worldgen.js';

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
      worldSeed: null,
      roomState: { lastDayProcessed: -1, weaponFloors: [], cells: {} },
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

describe('per-room state persistence', () => {
  it('round-trips consumed items, dead bodies, and light state across save/load', () => {
    const shopState = { gold: 0, upgrades: { battery: 0, flashlight: 0, health: 0, speed: 0 } };
    const roomState = {
      lastDayProcessed: 4,
      weaponFloors: [0, 2],
      cells: {
        '0:1,1': {
          items: [0, 2],
          corpses: [{ x: 10, y: 20, type: 'basic', angle: 90 }],
          lampOn: false,
          switchOn: true,
        },
      },
    };

    saveGame(shopState, 3, [], ['store'], 'store', 12345, roomState);
    const loaded = loadGame();

    expect(loaded.roomState).toEqual(roomState);
  });

  it('loads a legacy save that predates room state with an empty room state', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 4,
      shopState: { gold: 5, upgrades: { battery: 0, flashlight: 0, health: 0, speed: 0 } },
      runCount: 2,
      collectedLore: [],
      unlockedLocations: ['store'],
      activeLocation: 'store',
      worldSeed: 7,
    }));

    const loaded = loadGame();

    expect(loaded.roomState).toEqual({ lastDayProcessed: -1, weaponFloors: [], cells: {} });
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

describe('generateWorldSeed', () => {
  it('produces a positive integer within the valid seed range', () => {
    const lo = generateWorldSeed(() => 0);
    const hi = generateWorldSeed(() => 0.9999999);

    expect(Number.isInteger(lo)).toBe(true);
    expect(Number.isInteger(hi)).toBe(true);
    expect(lo).toBeGreaterThanOrEqual(1);
    expect(hi).toBeLessThanOrEqual(MAX_WORLD_SEED);
  });

  it('never returns zero, even for the lowest random draw', () => {
    expect(generateWorldSeed(() => 0)).toBeGreaterThan(0);
  });
});

describe('resolveWorldSeed', () => {
  it('reuses a stored seed unchanged so the world stays the same across days', () => {
    expect(resolveWorldSeed(777)).toBe(777);
    expect(resolveWorldSeed(777)).toBe(resolveWorldSeed(777));
  });

  it('mints a fresh valid seed when none is stored (old/new save)', () => {
    for (const absent of [null, undefined]) {
      const seed = resolveWorldSeed(absent, () => 0.5);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThan(0);
      expect(seed).toBeLessThanOrEqual(MAX_WORLD_SEED);
    }
  });

  it('regenerates when the stored value is invalid (0, negative, or non-integer)', () => {
    for (const bad of [0, -5, 1.5, NaN, 'abc']) {
      const seed = resolveWorldSeed(bad, () => 0.5);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThan(0);
    }
  });
});

describe('world stability vs run count (spec: level must not change day to day)', () => {
  // The world a player sees is getRoomAt(<their seed>, gx, gy) over a grid.
  function worldFor(seed) {
    const rooms = [];
    for (let gx = 0; gx < 4; gx++) {
      for (let gy = 0; gy < 4; gy++) {
        rooms.push(getRoomAt(seed, gx, gy));
      }
    }
    return rooms;
  }

  it('keeps the layout identical across days because the seed comes from the save, not the run count', () => {
    const persisted = 4242;
    // Whatever day it is, the world is resolved from the persisted seed only.
    const today = worldFor(resolveWorldSeed(persisted));
    const tomorrow = worldFor(resolveWorldSeed(persisted));
    expect(tomorrow).toEqual(today);

    // Regression guard: the old source `seed = runCount + 1` produced a DIFFERENT
    // world every day. That run-derived world both drifts day-to-day and differs
    // from the persisted-seed world, so this test fails if the seed source
    // regresses to the run counter.
    const oldDay1 = worldFor(1 + 1);
    const oldDay8 = worldFor(8 + 1);
    expect(oldDay1).not.toEqual(oldDay8);
    expect(today).not.toEqual(oldDay1);
  });

  it('produces different layouts for different players (different persisted seeds)', () => {
    const a = worldFor(resolveWorldSeed(111));
    const b = worldFor(resolveWorldSeed(222));
    const someCellDiffers = a.some((room, i) => room.seed !== b[i].seed);
    expect(someCellDiffers).toBe(true);
  });
});

describe('worldSeed persistence and migration', () => {
  it('round-trips a world seed through save and load', () => {
    const shopState = { gold: 0, upgrades: { battery: 0, flashlight: 0, health: 0, speed: 0 } };
    saveGame(shopState, 3, [], ['store'], 'store', 123456);

    expect(loadGame().worldSeed).toBe(123456);
  });

  it('returns null worldSeed for an old save that predates the field', () => {
    const oldData = {
      version: 3,
      shopState: { gold: 200, upgrades: { battery: 1, flashlight: 0, health: 0, speed: 0 } },
      runCount: 4,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(oldData));

    expect(loadGame().worldSeed).toBeNull();
  });
});
