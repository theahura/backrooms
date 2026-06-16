export const ENEMY_SOUND_RANGE = 400;
export const ENEMY_SOUND_COOLDOWN_MIN = 4000;
export const ENEMY_SOUND_COOLDOWN_MAX = 8000;

const ENEMY_TYPE_PREFIX = { basic: 'zombie', crawler: 'crawler', spitter: 'spitter' };
const AMBIENT_SOUND_SUFFIX = { basic: 'growl', crawler: 'skitter', spitter: 'gurgle' };

export const SOUND_CONFIGS = {
  pistol_fire: {
    duration: 0.2,
    gain: 0.4,
    type: 'gunshot',
    noiseFreq: 1200,
    noiseQ: 0.8,
    noiseDecay: 0.08,
    bodyFreq: 160,
    bodyDecay: 0.12,
    reverb: { decay: 0.5, wet: 0.18 },
    vary: true,
  },
  shotgun_fire: {
    duration: 0.3,
    gain: 0.6,
    type: 'gunshot',
    noiseFreq: 800,
    noiseQ: 0.5,
    noiseDecay: 0.15,
    bodyFreq: 100,
    bodyDecay: 0.2,
    reverb: { decay: 0.7, wet: 0.22 },
    vary: true,
  },
  rifle_fire: {
    duration: 0.25,
    gain: 0.5,
    type: 'gunshot',
    noiseFreq: 1500,
    noiseQ: 1.0,
    noiseDecay: 0.06,
    bodyFreq: 200,
    bodyDecay: 0.1,
    reverb: { decay: 0.6, wet: 0.2 },
    vary: true,
  },
  bullet_hit: {
    duration: 0.1,
    gain: 0.3,
    type: 'noise_burst',
    freq: 2000,
    Q: 1.5,
    decay: 0.08,
    vary: true,
  },
  zombie_growl: {
    duration: 1.0,
    gain: 0.32,
    type: 'creature',
    baseFreq: 75,
    endFreq: 58,
    oscType: 'sawtooth',
    partials: [1, 1.48, 2.13],
    amFreq: 42,
    amDepth: 0.85,
    distortion: 180,
    formants: [{ freq: 650, q: 10 }, { freq: 1080, q: 9 }],
    subFreq: 46,
    subGain: 0.35,
    vary: true,
  },
  zombie_alert: {
    duration: 0.45,
    gain: 0.42,
    type: 'creature',
    baseFreq: 110,
    endFreq: 80,
    oscType: 'sawtooth',
    partials: [1, 1.5, 2.4],
    amFreq: 55,
    amDepth: 0.9,
    distortion: 260,
    formants: [{ freq: 720, q: 8 }, { freq: 1200, q: 8 }],
    subFreq: 60,
    subGain: 0.3,
    attack: 0.02,
    vary: true,
  },
  zombie_death: {
    duration: 0.6,
    gain: 0.36,
    type: 'creature',
    baseFreq: 70,
    endFreq: 30,
    oscType: 'sawtooth',
    partials: [1, 1.42, 2.0],
    amFreq: 38,
    amDepth: 0.9,
    distortion: 220,
    formants: [{ freq: 500, q: 9 }, { freq: 900, q: 8 }],
    subFreq: 40,
    subGain: 0.4,
    reverb: { decay: 0.6, wet: 0.25 },
    vary: true,
  },
  crawler_skitter: {
    duration: 0.4,
    gain: 0.3,
    type: 'skitter',
    clicks: 12,
    clickDuration: 0.005,
    clickGap: 0.03,
    freq: 4000,
    Q: 3,
    amFreq: 110,
    vary: true,
  },
  crawler_alert: {
    duration: 0.15,
    gain: 0.35,
    type: 'noise_burst',
    freq: 3000,
    Q: 5,
    decay: 0.1,
  },
  crawler_death: {
    duration: 0.2,
    gain: 0.35,
    type: 'noise_burst',
    freq: 2000,
    Q: 2,
    decay: 0.15,
  },
  spitter_gurgle: {
    duration: 0.8,
    gain: 0.26,
    type: 'creature',
    source: 'noise',
    noiseFreq: 500,
    noiseQ: 9,
    noiseLfoFreq: 7,
    noiseLfoDepth: 320,
    amFreq: 28,
    amDepth: 0.7,
    distortion: 80,
    formants: [{ freq: 450, q: 8 }, { freq: 800, q: 8 }],
    attack: 0.1,
    vary: true,
  },
  spitter_alert: {
    duration: 0.3,
    gain: 0.35,
    type: 'sweep_down',
    startFreq: 800,
    endFreq: 200,
    oscType: 'sawtooth',
  },
  spitter_fire: {
    duration: 0.15,
    gain: 0.3,
    type: 'noise_burst',
    freq: 600,
    Q: 3,
    decay: 0.12,
  },
  spitter_death: {
    duration: 0.35,
    gain: 0.34,
    type: 'creature',
    source: 'noise',
    noiseFreq: 420,
    noiseQ: 7,
    noiseLfoFreq: 9,
    noiseLfoDepth: 220,
    amFreq: 30,
    amDepth: 0.8,
    distortion: 120,
    formants: [{ freq: 420, q: 7 }],
    attack: 0.02,
    vary: true,
  },
  player_damage: {
    duration: 0.2,
    gain: 0.5,
    type: 'noise_burst',
    freq: 400,
    Q: 0.5,
    decay: 0.15,
  },
  player_death: {
    duration: 0.8,
    gain: 0.5,
    type: 'sweep_down',
    startFreq: 300,
    endFreq: 40,
    oscType: 'sawtooth',
    reverb: { decay: 1.0, wet: 0.35 },
  },
  loot_drop: {
    duration: 0.15,
    gain: 0.25,
    type: 'noise_burst',
    freq: 2500,
    Q: 1.0,
    decay: 0.06,
  },
  item_pickup: {
    duration: 0.15,
    gain: 0.25,
    type: 'chime',
    notes: [660, 880],
    noteDuration: 0.06,
    noteGap: 0.07,
  },
  lore_pickup: {
    duration: 0.2,
    gain: 0.15,
    type: 'noise_burst',
    freq: 3000,
    Q: 3,
    decay: 0.15,
  },
  ammo_pickup: {
    duration: 0.12,
    gain: 0.2,
    type: 'chime',
    notes: [440, 550],
    noteDuration: 0.05,
    noteGap: 0.06,
  },
  medkit_pickup: {
    duration: 0.2,
    gain: 0.25,
    type: 'chime',
    notes: [523, 784, 1047],
    noteDuration: 0.05,
    noteGap: 0.05,
  },
  battery_recharge: {
    duration: 0.25,
    gain: 0.2,
    type: 'chime',
    notes: [440, 660, 880],
    noteDuration: 0.06,
    noteGap: 0.06,
  },
  door_open: {
    duration: 0.55,
    gain: 0.3,
    type: 'door_open',
    creakFreqStart: 320,
    creakFreqEnd: 880,
    creakQ: 18,
    reverb: { decay: 0.5, wet: 0.2 },
  },
  door_close: {
    duration: 0.5,
    gain: 0.42,
    type: 'door_slam',
    clickFreq: 3200,
    thudFreqStart: 120,
    thudFreqEnd: 55,
    partials: [1, 1.8, 3.2],
    reverb: { decay: 0.7, wet: 0.3 },
  },
  switch_click: {
    duration: 0.05,
    gain: 0.3,
    type: 'noise_burst',
    freq: 4000,
    Q: 2,
    decay: 0.03,
  },
  hide_enter: {
    duration: 0.2,
    gain: 0.15,
    type: 'noise_burst',
    freq: 1200,
    Q: 1,
    decay: 0.15,
  },
  hide_exit: {
    duration: 0.15,
    gain: 0.15,
    type: 'noise_burst',
    freq: 1500,
    Q: 1,
    decay: 0.1,
  },
  stair_transition: {
    duration: 0.6,
    gain: 0.25,
    type: 'sweep_down',
    startFreq: 500,
    endFreq: 100,
    oscType: 'sine',
  },
  day_complete: {
    duration: 0.4,
    gain: 0.3,
    type: 'chime',
    notes: [440, 554, 659, 880],
    noteDuration: 0.08,
    noteGap: 0.08,
  },
  battery_warning: {
    duration: 0.15,
    gain: 0.2,
    type: 'tone',
    freq: 220,
    oscType: 'sine',
  },
  weapon_switch: {
    duration: 0.05,
    gain: 0.2,
    type: 'noise_burst',
    freq: 3000,
    Q: 2,
    decay: 0.04,
  },
  shop_purchase: {
    duration: 0.2,
    gain: 0.25,
    type: 'chime',
    notes: [523, 659, 784],
    noteDuration: 0.05,
    noteGap: 0.06,
  },
  shop_denied: {
    duration: 0.2,
    gain: 0.2,
    type: 'tone',
    freq: 150,
    oscType: 'square',
  },
  shop_click: {
    duration: 0.04,
    gain: 0.15,
    type: 'noise_burst',
    freq: 5000,
    Q: 3,
    decay: 0.03,
  },
  footstep: {
    duration: 0.06,
    gain: 0.15,
    type: 'noise_burst',
    freq: 1800,
    Q: 1.5,
    decay: 0.04,
    vary: true,
  },
  distant_bang: {
    duration: 0.8,
    gain: 0.12,
    type: 'noise_burst',
    freq: 150,
    Q: 0.5,
    decay: 0.6,
    reverb: { decay: 1.2, wet: 0.4 },
  },
  drip: {
    duration: 0.06,
    gain: 0.06,
    type: 'tone',
    freq: 3000,
    oscType: 'sine',
  },
  whisper: {
    duration: 1.5,
    gain: 0.04,
    type: 'filtered_noise',
    freq: 3000,
    Q: 5,
    attackTime: 0.3,
    releaseTime: 0.5,
  },
};

export const AMBIENT_SOUND_TYPES = [
  { name: 'distant_bang', duration: 0.8 },
  { name: 'drip', duration: 0.06 },
  { name: 'whisper', duration: 1.5 },
];

const BASE_FOOTSTEP_DISTANCE = 60;

export function getFootstepInterval(speed) {
  if (speed <= 0) return Infinity;
  return (BASE_FOOTSTEP_DISTANCE / speed) * 1000;
}

export function getAmbientSoundDelay(time) {
  const hash = ((time * 2654435761) >>> 0) / 4294967296;
  return 5000 + hash * 25000;
}

export function getSoundConfig(key) {
  return SOUND_CONFIGS[key] || null;
}

export function getEnemySoundEvent(oldState, newState, type, soundCooldown, delta) {
  const prefix = ENEMY_TYPE_PREFIX[type] || 'zombie';

  if ((oldState === 'idle' || oldState === 'search') && newState === 'chase') {
    return { soundKey: `${prefix}_alert`, newCooldown: soundCooldown };
  }

  const remaining = soundCooldown - delta;
  if (remaining <= 0) {
    const suffix = AMBIENT_SOUND_SUFFIX[type] || 'growl';
    const range = ENEMY_SOUND_COOLDOWN_MAX - ENEMY_SOUND_COOLDOWN_MIN;
    let hash = 0;
    for (let i = 0; i < type.length; i++) hash += type.charCodeAt(i);
    const newCooldown = ENEMY_SOUND_COOLDOWN_MIN + (range * ((hash * 7 + 13) % 17) / 17);
    return { soundKey: `${prefix}_${suffix}`, newCooldown };
  }

  return { soundKey: null, newCooldown: remaining };
}

export function getEnemyDeathSound(type) {
  const prefix = ENEMY_TYPE_PREFIX[type] || 'zombie';
  return `${prefix}_death`;
}

export function getEnemyFireSound(type) {
  if (type === 'spitter') return 'spitter_fire';
  return null;
}

export function getDistanceVolume(distance, maxRange, baseGain) {
  if (distance <= 0) return baseGain;
  if (distance >= maxRange) return 0;
  return baseGain * (1 - distance / maxRange);
}

export const RIFT_HEAR_RANGE = 420;
export const RIFT_CRACKLE_GAIN = 0.55;

export function getRiftCrackleVolume(distance) {
  return getDistanceVolume(distance, RIFT_HEAR_RANGE, RIFT_CRACKLE_GAIN);
}

function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// Beyond this range a nearby enemy contributes nothing to the dread intensity.
export const INTENSITY_ENEMY_RANGE = 400;
// Number of danger waves that maps to full escalation pressure.
const INTENSITY_WAVE_FULL = 8;
// A lit, safe room halves whatever threat the player would otherwise feel.
const SAFE_ROOM_DAMP = 0.5;
// A lurking (unaware) enemy is less frightening than one actively chasing.
const LURKING_THREAT_FACTOR = 0.55;

// Collapses live game state into a single 0..1 "how scared should you be"
// scalar that drives the evolving ambient bed. Immediate spatial hazards
// (a close/chasing enemy, the rift) dominate; low health and accumulated
// danger waves apply slower background pressure; safety dampens everything.
export function computeIntensity(signals = {}) {
  const {
    nearestEnemyDist = Infinity,
    chasingCount = 0,
    riftDist = null,
    inSafeRoom = false,
    healthFraction = 1,
    waveCount = 0,
  } = signals;

  const enemyProximity = nearestEnemyDist >= INTENSITY_ENEMY_RANGE
    ? 0
    : clamp01(1 - nearestEnemyDist / INTENSITY_ENEMY_RANGE);
  const enemyTerm = enemyProximity * (chasingCount > 0 ? 1 : LURKING_THREAT_FACTOR);

  const riftTerm = riftDist == null ? 0 : clamp01(1 - riftDist / RIFT_HEAR_RANGE);

  const spatial = Math.max(enemyTerm, riftTerm);

  const hurt = clamp01(1 - healthFraction);
  const waveProgress = clamp01(waveCount / INTENSITY_WAVE_FULL);
  const escalation = clamp01(0.25 * hurt + 0.2 * waveProgress);

  let raw = spatial + escalation * (1 - spatial);
  if (inSafeRoom) raw *= SAFE_ROOM_DAMP;
  return clamp01(raw);
}

const DRONE_CUTOFF_MIN = 380;
const DRONE_CUTOFF_MAX = 2600;
const DRONE_DREAD_MAX = 0.5;
const DRONE_SUB_MAX = 0.5;
const DRONE_HEARTBEAT_GAIN_MAX = 0.5;
// Heartbeat only fades in once the player is meaningfully threatened.
const DRONE_HEARTBEAT_THRESHOLD = 0.35;
const HEARTBEAT_HZ_MIN = 0.8; // ~48 bpm resting
const HEARTBEAT_HZ_MAX = 2.0; // ~120 bpm panic

// Maps the 0..1 intensity onto concrete control values the live ambient
// drone ramps toward each frame. Kept pure so the mapping is unit-testable;
// the Web Audio wiring in audioEngine.js just applies these numbers.
export function getDroneParams(intensity) {
  const t = clamp01(intensity);
  return {
    cutoff: DRONE_CUTOFF_MIN + (DRONE_CUTOFF_MAX - DRONE_CUTOFF_MIN) * t,
    dreadGain: DRONE_DREAD_MAX * t,
    subGain: DRONE_SUB_MAX * t,
    heartbeatGain: DRONE_HEARTBEAT_GAIN_MAX * clamp01((t - DRONE_HEARTBEAT_THRESHOLD) / (1 - DRONE_HEARTBEAT_THRESHOLD)),
    heartbeatRate: HEARTBEAT_HZ_MIN + (HEARTBEAT_HZ_MAX - HEARTBEAT_HZ_MIN) * t,
  };
}

// Largest per-shot pitch wobble, in cents.
export const SHOT_DETUNE_MAX = 55;
const SHOT_VOLUME_MIN = 0.85;

// Deterministic per-playback jitter so repeated one-shots (gunfire, footsteps,
// growls) don't sound mechanically identical. Seed is any incrementing counter.
export function getShotVariation(seed) {
  const s = seed | 0;
  const h1 = ((Math.imul(s, 2654435761) >>> 0) % 100000) / 100000;
  const h2 = ((Math.imul(s + 1, 40503) >>> 0) % 100000) / 100000;
  return {
    detune: (h1 * 2 - 1) * SHOT_DETUNE_MAX,
    volumeScale: SHOT_VOLUME_MIN + h2 * (1 - SHOT_VOLUME_MIN),
  };
}
