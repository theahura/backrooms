import { describe, it, expect } from 'vitest';
import {
  createDangerState,
  updateDangerTime,
  shouldSpawnWave,
  advanceWave,
  getWaveComposition,
  getSpawnRoom,
  DANGER_WAVE_INTERVAL,
  MAX_DANGER_WAVES,
} from '../danger.js';

describe('createDangerState', () => {
  it('initial state does not trigger any wave spawn', () => {
    const state = createDangerState();
    expect(shouldSpawnWave(state)).toBe(false);
  });
});

describe('updateDangerTime', () => {
  it('increments unsafe time when not in a safe room', () => {
    const state = createDangerState();
    const updated = updateDangerTime(state, 1000, false);
    expect(updated.unsafeTime).toBe(1000);
  });

  it('does not increment unsafe time when in a safe room', () => {
    const state = createDangerState();
    const updated = updateDangerTime(state, 1000, true);
    expect(updated.unsafeTime).toBe(0);
  });

  it('accumulates time across multiple updates', () => {
    let state = createDangerState();
    state = updateDangerTime(state, 5000, false);
    state = updateDangerTime(state, 3000, false);
    expect(state.unsafeTime).toBe(8000);
  });

  it('pauses accumulation during safe room visits without resetting', () => {
    let state = createDangerState();
    state = updateDangerTime(state, 10000, false);
    state = updateDangerTime(state, 5000, true);
    state = updateDangerTime(state, 2000, false);
    expect(state.unsafeTime).toBe(12000);
  });

  it('does not affect wave triggering behavior when updating time', () => {
    let state = createDangerState();
    state = advanceWave(state);
    state = updateDangerTime(state, DANGER_WAVE_INTERVAL, false);
    expect(shouldSpawnWave(state)).toBe(false);
    state = updateDangerTime(state, DANGER_WAVE_INTERVAL, false);
    expect(shouldSpawnWave(state)).toBe(true);
  });
});

describe('shouldSpawnWave', () => {
  it('returns false before the first interval', () => {
    const state = { unsafeTime: DANGER_WAVE_INTERVAL - 1, waveCount: 0 };
    expect(shouldSpawnWave(state)).toBe(false);
  });

  it('returns true at the first interval threshold', () => {
    const state = { unsafeTime: DANGER_WAVE_INTERVAL, waveCount: 0 };
    expect(shouldSpawnWave(state)).toBe(true);
  });

  it('returns true when time exceeds the threshold', () => {
    const state = { unsafeTime: DANGER_WAVE_INTERVAL + 5000, waveCount: 0 };
    expect(shouldSpawnWave(state)).toBe(true);
  });

  it('returns false when waveCount has already advanced past current threshold', () => {
    const state = { unsafeTime: DANGER_WAVE_INTERVAL, waveCount: 1 };
    expect(shouldSpawnWave(state)).toBe(false);
  });

  it('returns true for second wave at double the interval', () => {
    const state = { unsafeTime: DANGER_WAVE_INTERVAL * 2, waveCount: 1 };
    expect(shouldSpawnWave(state)).toBe(true);
  });

  it('returns false when waveCount equals MAX_DANGER_WAVES', () => {
    const state = { unsafeTime: DANGER_WAVE_INTERVAL * 100, waveCount: MAX_DANGER_WAVES };
    expect(shouldSpawnWave(state)).toBe(false);
  });
});

describe('advanceWave', () => {
  it('prevents the same wave from triggering again at the same time', () => {
    let state = { unsafeTime: DANGER_WAVE_INTERVAL, waveCount: 0 };
    expect(shouldSpawnWave(state)).toBe(true);
    state = advanceWave(state);
    expect(shouldSpawnWave(state)).toBe(false);
  });

  it('allows the next wave to trigger at the next interval', () => {
    let state = { unsafeTime: DANGER_WAVE_INTERVAL * 3, waveCount: 2 };
    expect(shouldSpawnWave(state)).toBe(true);
    state = advanceWave(state);
    expect(shouldSpawnWave(state)).toBe(false);
  });
});

describe('getWaveComposition', () => {
  it('returns only basic enemies for early waves', () => {
    const types = getWaveComposition(0);
    expect(types.length).toBeGreaterThan(0);
    expect(types.every(t => t === 'basic')).toBe(true);
  });

  it('returns only basic enemies for wave 1', () => {
    const types = getWaveComposition(1);
    expect(types.every(t => t === 'basic')).toBe(true);
  });

  it('includes crawler in mid waves', () => {
    const types = getWaveComposition(3);
    expect(types.some(t => t === 'crawler')).toBe(true);
  });

  it('includes spitter in later waves', () => {
    const types = getWaveComposition(5);
    expect(types.some(t => t === 'spitter')).toBe(true);
  });

  it('increases enemy count with wave number', () => {
    const early = getWaveComposition(0);
    const late = getWaveComposition(7);
    expect(late.length).toBeGreaterThan(early.length);
  });

  it('caps enemy count at 4', () => {
    const types = getWaveComposition(100);
    expect(types.length).toBeLessThanOrEqual(4);
  });

  it('only contains valid enemy types', () => {
    const validTypes = ['basic', 'crawler', 'spitter'];
    for (let w = 0; w < MAX_DANGER_WAVES; w++) {
      const types = getWaveComposition(w);
      for (const t of types) {
        expect(validTypes).toContain(t);
      }
    }
  });
});

describe('getSpawnRoom', () => {
  const makeRoom = (id, floor = 0) => ({
    id,
    x: id * 1200,
    y: floor * 10000,
    width: 1200,
    height: 1000,
    floor,
    doors: [],
  });

  it('returns a room that is not room 0', () => {
    const rooms = [makeRoom(0), makeRoom(1), makeRoom(2)];
    const result = getSpawnRoom(rooms, 1, [0], 0);
    expect(result).not.toBeNull();
    expect(result.id).not.toBe(0);
  });

  it('excludes the player current room', () => {
    const rooms = [makeRoom(0), makeRoom(1), makeRoom(2)];
    const result = getSpawnRoom(rooms, 1, [0], 0);
    expect(result.id).not.toBe(1);
  });

  it('excludes lit rooms', () => {
    const rooms = [makeRoom(0), makeRoom(1), makeRoom(2), makeRoom(3)];
    const result = getSpawnRoom(rooms, 1, [0, 2], 0);
    expect(result).not.toBeNull();
    expect(result.id).not.toBe(0);
    expect(result.id).not.toBe(2);
  });

  it('only returns rooms on the same floor as the player', () => {
    const rooms = [makeRoom(0, 0), makeRoom(1, 0), makeRoom(2, 0), makeRoom(3, 1), makeRoom(4, 1)];
    const result = getSpawnRoom(rooms, 1, [], 0);
    expect(result).not.toBeNull();
    expect(result.floor).toBe(0);
    expect(result.id).not.toBe(0);
    expect(result.id).not.toBe(1);
  });

  it('returns null when no valid rooms exist', () => {
    const rooms = [makeRoom(0), makeRoom(1)];
    const result = getSpawnRoom(rooms, 1, [0], 0);
    expect(result).toBeNull();
  });

  it('returns null when all non-player rooms are lit', () => {
    const rooms = [makeRoom(0), makeRoom(1), makeRoom(2)];
    const result = getSpawnRoom(rooms, 1, [0, 2], 0);
    expect(result).toBeNull();
  });
});

describe('full session simulation', () => {
  it('triggers correct number of waves over time', () => {
    let state = createDangerState();
    let wavesTriggered = 0;

    for (let t = 0; t < DANGER_WAVE_INTERVAL * (MAX_DANGER_WAVES + 2); t += 1000) {
      state = updateDangerTime(state, 1000, false);
      while (shouldSpawnWave(state)) {
        wavesTriggered++;
        state = advanceWave(state);
      }
    }

    expect(wavesTriggered).toBe(MAX_DANGER_WAVES);
    expect(state.waveCount).toBe(MAX_DANGER_WAVES);
  });

  it('pausing in safe rooms delays but does not skip waves', () => {
    let state = createDangerState();
    let wavesTriggered = 0;

    state = updateDangerTime(state, DANGER_WAVE_INTERVAL - 1, false);
    expect(shouldSpawnWave(state)).toBe(false);

    state = updateDangerTime(state, 50000, true);
    expect(shouldSpawnWave(state)).toBe(false);

    state = updateDangerTime(state, 1, false);
    expect(shouldSpawnWave(state)).toBe(true);
    state = advanceWave(state);
    wavesTriggered++;

    expect(wavesTriggered).toBe(1);
    expect(state.unsafeTime).toBe(DANGER_WAVE_INTERVAL);
  });
});
