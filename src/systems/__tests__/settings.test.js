import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  VOLUME_LEVELS,
  SETTINGS_KEY,
  createDefaultSettings,
  cycleVolume,
  getVolumeValue,
  getEffectiveVolume,
  saveSettings,
  loadSettings,
} from '../settings.js';

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

describe('settings', () => {
  describe('createDefaultSettings', () => {
    it('returns all volumes set to FULL', () => {
      const settings = createDefaultSettings();
      expect(settings.masterVolume).toBe('FULL');
      expect(settings.sfxVolume).toBe('FULL');
      expect(settings.ambientVolume).toBe('FULL');
    });
  });

  describe('cycleVolume', () => {
    it('advances through all levels and wraps back to OFF', () => {
      let level = 'OFF';
      const visited = [level];
      for (let i = 0; i < VOLUME_LEVELS.length; i++) {
        level = cycleVolume(level);
        visited.push(level);
      }
      expect(visited[0]).toBe('OFF');
      expect(visited[visited.length - 1]).toBe('OFF');
      expect(new Set(visited).size).toBe(VOLUME_LEVELS.length);
    });

    it('cycles from FULL back to OFF', () => {
      expect(cycleVolume('FULL')).toBe('OFF');
    });

    it('cycles from OFF to LOW', () => {
      expect(cycleVolume('OFF')).toBe('LOW');
    });
  });

  describe('getVolumeValue', () => {
    it('returns 0 for OFF', () => {
      expect(getVolumeValue('OFF')).toBe(0);
    });

    it('returns 1 for FULL', () => {
      expect(getVolumeValue('FULL')).toBe(1.0);
    });

    it('returns increasing values for each successive level', () => {
      let prev = -1;
      for (const level of VOLUME_LEVELS) {
        const val = getVolumeValue(level);
        expect(val).toBeGreaterThan(prev);
        prev = val;
      }
    });

    it('returns 1 for unknown level as safe fallback', () => {
      expect(getVolumeValue('INVALID')).toBe(1.0);
    });
  });

  describe('getEffectiveVolume', () => {
    it('multiplies master and category volumes', () => {
      const result = getEffectiveVolume('FULL', 'MED');
      const medValue = getVolumeValue('MED');
      expect(result).toBeCloseTo(medValue);
    });

    it('returns 0 when master is OFF regardless of category', () => {
      expect(getEffectiveVolume('OFF', 'FULL')).toBe(0);
      expect(getEffectiveVolume('OFF', 'HIGH')).toBe(0);
    });

    it('returns 0 when category is OFF regardless of master', () => {
      expect(getEffectiveVolume('FULL', 'OFF')).toBe(0);
    });
  });

  describe('saveSettings and loadSettings round-trip', () => {
    it('persists and restores settings across save/load', () => {
      const settings = { masterVolume: 'MED', sfxVolume: 'LOW', ambientVolume: 'HIGH' };
      saveSettings(settings);
      const loaded = loadSettings();
      expect(loaded).toEqual(settings);
    });
  });

  describe('loadSettings', () => {
    it('returns defaults when nothing has been saved', () => {
      const loaded = loadSettings();
      expect(loaded).toEqual(createDefaultSettings());
    });

    it('returns defaults when stored data is corrupt JSON', () => {
      localStorage.setItem(SETTINGS_KEY, 'not valid json {{{');
      expect(loadSettings()).toEqual(createDefaultSettings());
    });

    it('returns defaults when localStorage throws', () => {
      globalThis.localStorage = {
        getItem() { throw new Error('SecurityError'); },
        setItem() { throw new Error('SecurityError'); },
        removeItem() { throw new Error('SecurityError'); },
      };
      expect(loadSettings()).toEqual(createDefaultSettings());
    });
  });

  describe('saveSettings', () => {
    it('does not throw when localStorage is unavailable', () => {
      globalThis.localStorage = {
        getItem() { throw new Error('SecurityError'); },
        setItem() { throw new Error('SecurityError'); },
        removeItem() { throw new Error('SecurityError'); },
      };
      expect(() => saveSettings(createDefaultSettings())).not.toThrow();
    });

    it('uses a separate key from game save data so clearSave does not affect settings', () => {
      saveSettings({ masterVolume: 'LOW', sfxVolume: 'LOW', ambientVolume: 'LOW' });
      localStorage.removeItem('backrooms_save');
      const loaded = loadSettings();
      expect(loaded.masterVolume).toBe('LOW');
    });
  });
});
