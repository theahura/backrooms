import { describe, it, expect } from 'vitest';
import {
  SOUND_CONFIGS,
  AMBIENT_SOUND_TYPES,
  getFootstepInterval,
  getAmbientSoundDelay,
  getSoundConfig,
} from '../audio.js';

describe('getFootstepInterval', () => {
  it('returns a positive interval at normal movement speed', () => {
    const interval = getFootstepInterval(200);
    expect(interval).toBeGreaterThan(0);
    expect(interval).toBeLessThan(2000);
  });

  it('returns Infinity when speed is zero', () => {
    expect(getFootstepInterval(0)).toBe(Infinity);
  });

  it('returns longer interval at slower speeds', () => {
    const slow = getFootstepInterval(100);
    const fast = getFootstepInterval(200);
    expect(slow).toBeGreaterThan(fast);
  });

  it('returns shorter interval at higher speeds', () => {
    const normal = getFootstepInterval(200);
    const fast = getFootstepInterval(300);
    expect(fast).toBeLessThan(normal);
  });

  it('returns a reasonable interval for hiding speed', () => {
    const interval = getFootstepInterval(100);
    expect(interval).toBeGreaterThan(200);
  });
});

describe('getAmbientSoundDelay', () => {
  it('returns a delay within the expected range', () => {
    for (let t = 0; t < 100; t++) {
      const delay = getAmbientSoundDelay(t * 1000);
      expect(delay).toBeGreaterThanOrEqual(5000);
      expect(delay).toBeLessThanOrEqual(30000);
    }
  });

  it('produces varying delays for different time inputs', () => {
    const delays = new Set();
    for (let t = 0; t < 20; t++) {
      delays.add(getAmbientSoundDelay(t * 7919));
    }
    expect(delays.size).toBeGreaterThan(1);
  });
});

describe('getSoundConfig', () => {
  it('returns a config object for a known sound key', () => {
    const config = getSoundConfig('pistol_fire');
    expect(config).toBeDefined();
    expect(config.duration).toBeGreaterThan(0);
  });

  it('returns null for an unknown sound key', () => {
    expect(getSoundConfig('nonexistent_sound')).toBeNull();
  });

  it('returns different configs for different weapon types', () => {
    const pistol = getSoundConfig('pistol_fire');
    const shotgun = getSoundConfig('shotgun_fire');
    expect(pistol).not.toEqual(shotgun);
  });

  it('returns configs for all ambient sound types', () => {
    for (const ambient of AMBIENT_SOUND_TYPES) {
      const config = getSoundConfig(ambient.name);
      expect(config, `ambient sound ${ambient.name} should have a config`).toBeDefined();
    }
  });

});
