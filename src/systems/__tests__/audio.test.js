import { describe, it, expect } from 'vitest';
import {
  SOUND_CONFIGS,
  AMBIENT_SOUND_TYPES,
  getFootstepInterval,
  getAmbientSoundDelay,
  getSoundConfig,
  getEnemySoundEvent,
  getEnemyDeathSound,
  getDistanceVolume,
  getEnemyFireSound,
  getRiftCrackleVolume,
  RIFT_HEAR_RANGE,
  ENEMY_SOUND_RANGE,
  ENEMY_SOUND_COOLDOWN_MIN,
  ENEMY_SOUND_COOLDOWN_MAX,
  computeIntensity,
  getDroneParams,
  getShotVariation,
  SHOT_DETUNE_MAX,
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

describe('getEnemySoundEvent', () => {
  it('returns alert sound on idle-to-chase transition for each enemy type', () => {
    const types = [
      { type: 'basic', expected: 'zombie_alert' },
      { type: 'crawler', expected: 'crawler_alert' },
      { type: 'spitter', expected: 'spitter_alert' },
    ];
    for (const { type, expected } of types) {
      const result = getEnemySoundEvent('idle', 'chase', type, 5000, 16);
      expect(result.soundKey).toBe(expected);
    }
  });

  it('returns alert sound on search-to-chase transition', () => {
    const result = getEnemySoundEvent('search', 'chase', 'basic', 5000, 16);
    expect(result.soundKey).toBe('zombie_alert');
  });

  it('returns null sound when state has not changed and cooldown is positive', () => {
    const result = getEnemySoundEvent('chase', 'chase', 'basic', 5000, 16);
    expect(result.soundKey).toBeNull();
  });

  it('returns ambient sound when cooldown expires', () => {
    const types = [
      { type: 'basic', expected: 'zombie_growl' },
      { type: 'crawler', expected: 'crawler_skitter' },
      { type: 'spitter', expected: 'spitter_gurgle' },
    ];
    for (const { type, expected } of types) {
      const result = getEnemySoundEvent('chase', 'chase', type, 0, 16);
      expect(result.soundKey).toBe(expected);
    }
  });

  it('resets cooldown to valid range when ambient sound triggers', () => {
    const result = getEnemySoundEvent('idle', 'idle', 'basic', 0, 16);
    expect(result.newCooldown).toBeGreaterThanOrEqual(ENEMY_SOUND_COOLDOWN_MIN);
    expect(result.newCooldown).toBeLessThanOrEqual(ENEMY_SOUND_COOLDOWN_MAX);
  });

  it('eventually triggers ambient sound after enough delta accumulates', () => {
    let cooldown = 5000;
    let triggered = false;
    for (let i = 0; i < 100; i++) {
      const result = getEnemySoundEvent('idle', 'idle', 'basic', cooldown, 100);
      cooldown = result.newCooldown;
      if (result.soundKey !== null) {
        triggered = true;
        break;
      }
    }
    expect(triggered).toBe(true);
  });

  it('returns ambient sound for negative cooldown values', () => {
    const result = getEnemySoundEvent('idle', 'idle', 'crawler', -100, 16);
    expect(result.soundKey).toBe('crawler_skitter');
  });

  it('does not play alert on attack-to-chase transition', () => {
    const result = getEnemySoundEvent('attack', 'chase', 'basic', 5000, 16);
    expect(result.soundKey).toBeNull();
  });

  it('produces different cooldowns for crawler and spitter', () => {
    const crawlerResult = getEnemySoundEvent('idle', 'idle', 'crawler', 0, 16);
    const spitterResult = getEnemySoundEvent('idle', 'idle', 'spitter', 0, 16);
    expect(crawlerResult.newCooldown).not.toBe(spitterResult.newCooldown);
  });

  it('preserves cooldown on alert transition', () => {
    const result = getEnemySoundEvent('idle', 'chase', 'basic', 3500, 16);
    expect(result.newCooldown).toBe(3500);
  });
});

describe('getEnemyDeathSound', () => {
  it('returns per-type death sound keys', () => {
    expect(getEnemyDeathSound('basic')).toBe('zombie_death');
    expect(getEnemyDeathSound('crawler')).toBe('crawler_death');
    expect(getEnemyDeathSound('spitter')).toBe('spitter_death');
  });
});

describe('getEnemyFireSound', () => {
  it('returns spitter_fire for spitter type', () => {
    expect(getEnemyFireSound('spitter')).toBe('spitter_fire');
  });

  it('returns null for non-spitter types', () => {
    expect(getEnemyFireSound('basic')).toBeNull();
    expect(getEnemyFireSound('crawler')).toBeNull();
  });
});

describe('getDistanceVolume', () => {
  it('returns full gain at distance 0', () => {
    expect(getDistanceVolume(0, 400, 0.3)).toBeCloseTo(0.3);
  });

  it('returns 0 at max range', () => {
    expect(getDistanceVolume(400, 400, 0.3)).toBe(0);
  });

  it('returns 0 beyond max range', () => {
    expect(getDistanceVolume(600, 400, 0.3)).toBe(0);
  });

  it('returns proportional volume at half range', () => {
    expect(getDistanceVolume(200, 400, 0.4)).toBeCloseTo(0.2);
  });

  it('clamps to baseGain for negative distance', () => {
    expect(getDistanceVolume(-50, 400, 0.3)).toBeCloseTo(0.3);
  });
});

describe('enemy sound configs are accessible via public API', () => {
  it('death sounds for all enemy types resolve to valid configs', () => {
    for (const type of ['basic', 'crawler', 'spitter']) {
      const key = getEnemyDeathSound(type);
      const config = getSoundConfig(key);
      expect(config, `${key} should resolve via getSoundConfig`).not.toBeNull();
    }
  });

  it('fire sound for spitter resolves to a valid config', () => {
    const key = getEnemyFireSound('spitter');
    const config = getSoundConfig(key);
    expect(config, `${key} should resolve via getSoundConfig`).not.toBeNull();
  });

  it('alert sounds for all enemy types resolve to valid configs', () => {
    for (const type of ['basic', 'crawler', 'spitter']) {
      const result = getEnemySoundEvent('idle', 'chase', type, 5000, 16);
      const config = getSoundConfig(result.soundKey);
      expect(config, `${result.soundKey} should resolve via getSoundConfig`).not.toBeNull();
    }
  });
});

describe('getRiftCrackleVolume', () => {
  it('is loudest at the rift and silent beyond hearing range', () => {
    expect(getRiftCrackleVolume(0)).toBeGreaterThan(0);
    expect(getRiftCrackleVolume(RIFT_HEAR_RANGE)).toBe(0);
    expect(getRiftCrackleVolume(RIFT_HEAR_RANGE * 3)).toBe(0);
  });

  it('rises monotonically as the player approaches', () => {
    const distances = [RIFT_HEAR_RANGE * 0.9, RIFT_HEAR_RANGE * 0.6, RIFT_HEAR_RANGE * 0.3, 0];
    const volumes = distances.map(d => getRiftCrackleVolume(d));
    for (let i = 1; i < volumes.length; i++) {
      expect(volumes[i]).toBeGreaterThan(volumes[i - 1]);
    }
  });
});

describe('computeIntensity', () => {
  const calm = {
    nearestEnemyDist: Infinity,
    chasingCount: 0,
    riftDist: null,
    inSafeRoom: true,
    healthFraction: 1,
    waveCount: 0,
  };

  it('is near zero when the player is calm and safe', () => {
    expect(computeIntensity(calm)).toBeLessThan(0.05);
  });

  it('always returns a value within [0, 1]', () => {
    const extreme = {
      nearestEnemyDist: 0,
      chasingCount: 5,
      riftDist: 0,
      inSafeRoom: false,
      healthFraction: 0,
      waveCount: 100,
    };
    const v = computeIntensity(extreme);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('rises as the nearest enemy gets closer', () => {
    const far = computeIntensity({ ...calm, inSafeRoom: false, nearestEnemyDist: 380 });
    const mid = computeIntensity({ ...calm, inSafeRoom: false, nearestEnemyDist: 200 });
    const near = computeIntensity({ ...calm, inSafeRoom: false, nearestEnemyDist: 30 });
    expect(mid).toBeGreaterThan(far);
    expect(near).toBeGreaterThan(mid);
  });

  it('is higher for a chasing enemy than a lurking one at the same distance', () => {
    const lurking = computeIntensity({ ...calm, inSafeRoom: false, nearestEnemyDist: 200, chasingCount: 0 });
    const chasing = computeIntensity({ ...calm, inSafeRoom: false, nearestEnemyDist: 200, chasingCount: 1 });
    expect(chasing).toBeGreaterThan(lurking);
  });

  it('rises as player health drops', () => {
    const healthy = computeIntensity({ ...calm, inSafeRoom: false, healthFraction: 1 });
    const hurt = computeIntensity({ ...calm, inSafeRoom: false, healthFraction: 0.2 });
    expect(hurt).toBeGreaterThan(healthy);
  });

  it('rises as the player nears the rift', () => {
    const farFromRift = computeIntensity({ ...calm, inSafeRoom: false, riftDist: 400 });
    const atRift = computeIntensity({ ...calm, inSafeRoom: false, riftDist: 20 });
    expect(atRift).toBeGreaterThan(farFromRift);
  });

  it('escalates with accumulated danger waves', () => {
    const early = computeIntensity({ ...calm, inSafeRoom: false, waveCount: 0 });
    const late = computeIntensity({ ...calm, inSafeRoom: false, waveCount: 4 });
    expect(late).toBeGreaterThan(early);
  });

  it('pins intensity near maximum for a point-blank chasing enemy regardless of slow pressure', () => {
    const calmBackground = computeIntensity({
      ...calm, inSafeRoom: false, nearestEnemyDist: 5, chasingCount: 1, healthFraction: 1, waveCount: 0,
    });
    const heavyBackground = computeIntensity({
      ...calm, inSafeRoom: false, nearestEnemyDist: 5, chasingCount: 1, healthFraction: 0.1, waveCount: 8,
    });
    expect(calmBackground).toBeGreaterThan(0.95);
    expect(heavyBackground).toBeGreaterThan(0.95);
  });

  it('is dampened when the player is in a safe lit room', () => {
    const exposed = computeIntensity({ ...calm, inSafeRoom: false, nearestEnemyDist: 150, chasingCount: 1 });
    const sheltered = computeIntensity({ ...calm, inSafeRoom: true, nearestEnemyDist: 150, chasingCount: 1 });
    expect(sheltered).toBeLessThan(exposed);
  });

  it('treats missing signals as a calm default', () => {
    expect(computeIntensity({})).toBeLessThan(0.05);
  });
});

describe('getDroneParams', () => {
  it('opens the filter cutoff as intensity rises', () => {
    expect(getDroneParams(1).cutoff).toBeGreaterThan(getDroneParams(0).cutoff);
  });

  it('keeps the dread layer silent when calm and audible when intense', () => {
    expect(getDroneParams(0).dreadGain).toBe(0);
    expect(getDroneParams(1).dreadGain).toBeGreaterThan(0);
  });

  it('quickens the heartbeat as intensity rises', () => {
    expect(getDroneParams(1).heartbeatRate).toBeGreaterThan(getDroneParams(0).heartbeatRate);
  });

  it('keeps all outputs within sane bounds across the full intensity range', () => {
    for (let i = 0; i <= 10; i++) {
      const p = getDroneParams(i / 10);
      expect(p.cutoff).toBeGreaterThan(0);
      expect(p.cutoff).toBeLessThanOrEqual(20000);
      expect(p.dreadGain).toBeGreaterThanOrEqual(0);
      expect(p.dreadGain).toBeLessThanOrEqual(1);
      expect(p.heartbeatRate).toBeGreaterThan(0);
    }
  });

  it('clamps out-of-range intensity instead of extrapolating', () => {
    expect(getDroneParams(5).cutoff).toBe(getDroneParams(1).cutoff);
    expect(getDroneParams(-5).cutoff).toBe(getDroneParams(0).cutoff);
  });
});

describe('getShotVariation', () => {
  it('keeps detune within the allowed range', () => {
    for (let s = 0; s < 100; s++) {
      expect(Math.abs(getShotVariation(s).detune)).toBeLessThanOrEqual(SHOT_DETUNE_MAX);
    }
  });

  it('keeps the volume scale within a subtle range', () => {
    for (let s = 0; s < 100; s++) {
      const v = getShotVariation(s);
      expect(v.volumeScale).toBeGreaterThanOrEqual(0.8);
      expect(v.volumeScale).toBeLessThanOrEqual(1.0);
    }
  });

  it('produces varied detune across successive shots', () => {
    const detunes = new Set();
    for (let s = 0; s < 50; s++) detunes.add(getShotVariation(s).detune);
    expect(detunes.size).toBeGreaterThan(5);
  });

  it('is deterministic for the same seed', () => {
    expect(getShotVariation(7)).toEqual(getShotVariation(7));
  });
});
