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
  },
  bullet_hit: {
    duration: 0.1,
    gain: 0.3,
    type: 'noise_burst',
    freq: 2000,
    Q: 1.5,
    decay: 0.08,
  },
  zombie_growl: {
    duration: 1.0,
    gain: 0.3,
    type: 'growl',
    carrierFreq: 55,
    carrierEnd: 40,
    lfoFreq: 5,
    filterFreq: 200,
  },
  zombie_alert: {
    duration: 0.4,
    gain: 0.4,
    type: 'growl',
    carrierFreq: 80,
    carrierEnd: 50,
    lfoFreq: 10,
    filterFreq: 300,
  },
  zombie_death: {
    duration: 0.5,
    gain: 0.35,
    type: 'growl',
    carrierFreq: 60,
    carrierEnd: 30,
    lfoFreq: 8,
    filterFreq: 250,
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
    gain: 0.25,
    type: 'gurgle',
    freq: 500,
    Q: 10,
    lfoFreq: 6,
    lfoDepth: 300,
    attackTime: 0.1,
    releaseTime: 0.2,
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
    duration: 0.3,
    gain: 0.35,
    type: 'gurgle',
    freq: 400,
    Q: 8,
    lfoFreq: 8,
    lfoDepth: 200,
    attackTime: 0.02,
    releaseTime: 0.1,
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
    duration: 0.4,
    gain: 0.3,
    type: 'door',
    carrierStart: 300,
    carrierEnd: 450,
    modFreqStart: 8,
    modFreqEnd: 12,
    modDepth: 400,
  },
  door_close: {
    duration: 0.3,
    gain: 0.35,
    type: 'door_thud',
    thudFreq: 200,
    thudDecay: 0.12,
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
  },
  distant_bang: {
    duration: 0.8,
    gain: 0.12,
    type: 'noise_burst',
    freq: 150,
    Q: 0.5,
    decay: 0.6,
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
