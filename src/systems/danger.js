export const DANGER_WAVE_INTERVAL = 30000;
export const MAX_DANGER_WAVES = 8;

export function createDangerState() {
  return { unsafeTime: 0, waveCount: 0 };
}

export function updateDangerTime(state, delta, isInSafeRoom) {
  if (isInSafeRoom) return state;
  return { ...state, unsafeTime: state.unsafeTime + delta };
}

export function shouldSpawnWave(state) {
  if (state.waveCount >= MAX_DANGER_WAVES) return false;
  return state.unsafeTime >= (state.waveCount + 1) * DANGER_WAVE_INTERVAL;
}

export function advanceWave(state) {
  return { ...state, waveCount: state.waveCount + 1 };
}

export function getWaveComposition(waveCount) {
  const count = Math.min(1 + Math.floor(waveCount / 3), 4);
  const types = [];
  for (let i = 0; i < count; i++) {
    if (waveCount <= 1) {
      types.push('basic');
    } else if (waveCount <= 3) {
      types.push(i % 2 === 0 ? 'basic' : 'crawler');
    } else if (waveCount <= 5) {
      types.push(i % 2 === 0 ? 'crawler' : 'spitter');
    } else {
      types.push(i % 3 === 0 ? 'crawler' : i % 3 === 1 ? 'spitter' : 'basic');
    }
  }
  return types;
}

export function getSpawnRoom(rooms, playerRoomId, litRoomIds, currentFloor) {
  const candidates = rooms.filter(r =>
    r.id !== 0 &&
    r.id !== playerRoomId &&
    !litRoomIds.includes(r.id) &&
    r.floor === currentFloor
  );
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
