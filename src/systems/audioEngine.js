import { SOUND_CONFIGS, AMBIENT_SOUND_TYPES } from './audio.js';

function fillNoise(data) {
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
}

async function renderGunshot(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * config.duration);
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  const noiseBuffer = offCtx.createBuffer(1, length, sampleRate);
  fillNoise(noiseBuffer.getChannelData(0));
  const noise = offCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = offCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = config.noiseFreq;
  filter.Q.value = config.noiseQ;

  const noiseGain = offCtx.createGain();
  noiseGain.gain.setValueAtTime(config.gain, 0);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, config.noiseDecay);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(offCtx.destination);

  const osc = offCtx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(config.bodyFreq, 0);
  osc.frequency.exponentialRampToValueAtTime(1, config.bodyDecay);
  const oscGain = offCtx.createGain();
  oscGain.gain.setValueAtTime(config.gain * 0.6, 0);
  oscGain.gain.exponentialRampToValueAtTime(0.001, config.bodyDecay);
  osc.connect(oscGain);
  oscGain.connect(offCtx.destination);

  noise.start(0);
  osc.start(0);
  return offCtx.startRendering();
}

async function renderNoiseBurst(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * config.duration);
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  const noiseBuffer = offCtx.createBuffer(1, length, sampleRate);
  fillNoise(noiseBuffer.getChannelData(0));
  const noise = offCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = offCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = config.freq;
  filter.Q.value = config.Q;

  const gain = offCtx.createGain();
  gain.gain.setValueAtTime(config.gain, 0);
  gain.gain.exponentialRampToValueAtTime(0.001, config.decay);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(offCtx.destination);
  noise.start(0);
  return offCtx.startRendering();
}

async function renderChime(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * config.duration);
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  for (let i = 0; i < config.notes.length; i++) {
    const osc = offCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = config.notes[i];
    const gain = offCtx.createGain();
    const start = i * config.noteGap;
    gain.gain.setValueAtTime(0, 0);
    gain.gain.setValueAtTime(config.gain, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + config.noteDuration);
    osc.connect(gain);
    gain.connect(offCtx.destination);
    osc.start(start);
    osc.stop(start + config.noteDuration);
  }
  return offCtx.startRendering();
}

async function renderTone(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * config.duration);
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  const osc = offCtx.createOscillator();
  osc.type = config.oscType || 'sine';
  osc.frequency.value = config.freq;
  const gain = offCtx.createGain();
  gain.gain.setValueAtTime(config.gain, 0);
  gain.gain.exponentialRampToValueAtTime(0.001, config.duration * 0.9);
  osc.connect(gain);
  gain.connect(offCtx.destination);
  osc.start(0);
  return offCtx.startRendering();
}

async function renderSweepDown(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * config.duration);
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  const osc = offCtx.createOscillator();
  osc.type = config.oscType || 'sawtooth';
  osc.frequency.setValueAtTime(config.startFreq, 0);
  osc.frequency.exponentialRampToValueAtTime(config.endFreq, config.duration * 0.8);

  const filter = offCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = config.startFreq * 2;

  const gain = offCtx.createGain();
  gain.gain.setValueAtTime(config.gain, 0);
  gain.gain.linearRampToValueAtTime(config.gain, config.duration * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, config.duration * 0.95);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(offCtx.destination);
  osc.start(0);
  return offCtx.startRendering();
}

async function renderGrowl(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * config.duration);
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  const carrier = offCtx.createOscillator();
  carrier.type = 'sawtooth';
  carrier.frequency.setValueAtTime(config.carrierFreq, 0);
  carrier.frequency.linearRampToValueAtTime(config.carrierEnd, config.duration);

  const filter = offCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = config.filterFreq;
  filter.Q.value = 2;

  const masterGain = offCtx.createGain();
  masterGain.gain.setValueAtTime(0, 0);
  masterGain.gain.linearRampToValueAtTime(config.gain, 0.05);
  masterGain.gain.setValueAtTime(config.gain, config.duration * 0.7);
  masterGain.gain.linearRampToValueAtTime(0.001, config.duration);

  const lfo = offCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = config.lfoFreq;
  const lfoGain = offCtx.createGain();
  lfoGain.gain.value = 0.1;
  lfo.connect(lfoGain);
  lfoGain.connect(masterGain.gain);

  carrier.connect(filter);
  filter.connect(masterGain);
  masterGain.connect(offCtx.destination);

  carrier.start(0);
  lfo.start(0);
  return offCtx.startRendering();
}

async function renderDoor(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * config.duration);
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  const carrier = offCtx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(config.carrierStart, 0);
  carrier.frequency.linearRampToValueAtTime(config.carrierEnd, config.duration);

  const modulator = offCtx.createOscillator();
  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(config.modFreqStart, 0);
  modulator.frequency.linearRampToValueAtTime(config.modFreqEnd, config.duration);
  const modGain = offCtx.createGain();
  modGain.gain.value = config.modDepth;
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  const filter = offCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  filter.Q.value = 2;

  const envelope = offCtx.createGain();
  envelope.gain.setValueAtTime(0, 0);
  envelope.gain.linearRampToValueAtTime(config.gain, 0.03);
  envelope.gain.setValueAtTime(config.gain, config.duration * 0.8);
  envelope.gain.linearRampToValueAtTime(0.001, config.duration);

  carrier.connect(filter);
  filter.connect(envelope);
  envelope.connect(offCtx.destination);

  carrier.start(0);
  modulator.start(0);
  return offCtx.startRendering();
}

async function renderDoorThud(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * config.duration);
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  const noiseBuffer = offCtx.createBuffer(1, length, sampleRate);
  fillNoise(noiseBuffer.getChannelData(0));
  const noise = offCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = offCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = config.thudFreq;

  const gain = offCtx.createGain();
  gain.gain.setValueAtTime(config.gain, 0);
  gain.gain.exponentialRampToValueAtTime(0.001, config.thudDecay);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(offCtx.destination);
  noise.start(0);
  return offCtx.startRendering();
}

async function renderFilteredNoise(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * config.duration);
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  const noiseBuffer = offCtx.createBuffer(1, length, sampleRate);
  fillNoise(noiseBuffer.getChannelData(0));
  const noise = offCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = offCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = config.freq;
  filter.Q.value = config.Q;

  const gain = offCtx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(config.gain, config.attackTime);
  gain.gain.setValueAtTime(config.gain, config.duration - config.releaseTime);
  gain.gain.linearRampToValueAtTime(0.001, config.duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(offCtx.destination);
  noise.start(0);
  return offCtx.startRendering();
}

async function renderSkitter(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * config.duration);
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  const noiseBuffer = offCtx.createBuffer(1, length, sampleRate);
  fillNoise(noiseBuffer.getChannelData(0));
  const noise = offCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = offCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = config.freq;
  filter.Q.value = config.Q;

  const gain = offCtx.createGain();
  gain.gain.setValueAtTime(0, 0);
  for (let i = 0; i < config.clicks; i++) {
    const start = i * (config.clickDuration + config.clickGap);
    if (start >= config.duration) break;
    gain.gain.setValueAtTime(config.gain, start);
    gain.gain.setValueAtTime(0, start + config.clickDuration);
  }

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(offCtx.destination);
  noise.start(0);
  return offCtx.startRendering();
}

async function renderGurgle(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * config.duration);
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  const noiseBuffer = offCtx.createBuffer(1, length, sampleRate);
  fillNoise(noiseBuffer.getChannelData(0));
  const noise = offCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = offCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = config.freq;
  filter.Q.value = config.Q;

  const lfo = offCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = config.lfoFreq;
  const lfoGain = offCtx.createGain();
  lfoGain.gain.value = config.lfoDepth;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  const masterGain = offCtx.createGain();
  masterGain.gain.setValueAtTime(0, 0);
  masterGain.gain.linearRampToValueAtTime(config.gain, config.attackTime);
  masterGain.gain.setValueAtTime(config.gain, config.duration - config.releaseTime);
  masterGain.gain.linearRampToValueAtTime(0.001, config.duration);

  noise.connect(filter);
  filter.connect(masterGain);
  masterGain.connect(offCtx.destination);

  noise.start(0);
  lfo.start(0);
  return offCtx.startRendering();
}

const RENDERERS = {
  gunshot: renderGunshot,
  noise_burst: renderNoiseBurst,
  chime: renderChime,
  tone: renderTone,
  sweep_down: renderSweepDown,
  growl: renderGrowl,
  door: renderDoor,
  door_thud: renderDoorThud,
  filtered_noise: renderFilteredNoise,
  skitter: renderSkitter,
  gurgle: renderGurgle,
};

export async function generateAllSounds(audioContext, cache) {
  const promises = [];
  for (const [key, config] of Object.entries(SOUND_CONFIGS)) {
    const renderer = RENDERERS[config.type];
    if (!renderer) continue;
    promises.push(
      renderer(audioContext, config).then(buffer => {
        cache.add(key, buffer);
      })
    );
  }
  await Promise.all(promises);
}

export function createAmbientDrone(audioContext, destination) {
  const osc1 = audioContext.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = 120;

  const osc2 = audioContext.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = 120.5;

  const osc3 = audioContext.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.value = 60;

  const masterGain = audioContext.createGain();
  masterGain.gain.value = 0.06;

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;

  const osc2Gain = audioContext.createGain();
  osc2Gain.gain.value = 0.6;

  const osc3Gain = audioContext.createGain();
  osc3Gain.gain.value = 0.3;

  const lfo = audioContext.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.3;
  const lfoGain = audioContext.createGain();
  lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain);
  lfoGain.connect(masterGain.gain);

  osc1.connect(masterGain);
  osc2.connect(osc2Gain);
  osc2Gain.connect(masterGain);
  osc3.connect(osc3Gain);
  osc3Gain.connect(masterGain);
  masterGain.connect(filter);
  filter.connect(destination);

  const nodes = [osc1, osc2, osc3, lfo];
  const baseGain = 0.06;

  return {
    start() {
      for (const node of nodes) node.start();
    },
    stop() {
      for (const node of nodes) {
        try { node.stop(); } catch (_) {}
      }
    },
    setVolume(value) {
      masterGain.gain.value = baseGain * value;
    },
  };
}

export function playAmbientSound(soundManager, time, volumeMultiplier = 1) {
  const index = Math.abs(((time * 2654435761) >>> 0) % AMBIENT_SOUND_TYPES.length);
  const type = AMBIENT_SOUND_TYPES[index];
  const vol = 0.5 * volumeMultiplier;
  if (vol <= 0) return;
  try {
    soundManager.play(type.name, { volume: vol });
  } catch (_) {}
}

// The rift's crackling static: looped filtered noise (hiss) plus a sparse
// impulse loop (pops). The caller drives the gain from player distance each
// frame; setVolume takes the absolute gain, unlike the drone's multiplier.
export function createRiftCrackle(audioContext, destination) {
  const sampleRate = audioContext.sampleRate;
  const seconds = 2;

  const noiseBuffer = audioContext.createBuffer(1, sampleRate * seconds, sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }

  const popBuffer = audioContext.createBuffer(1, sampleRate * seconds, sampleRate);
  const popData = popBuffer.getChannelData(0);
  for (let p = 0; p < 70; p++) {
    const at = Math.floor(Math.random() * (popData.length - 80));
    const strength = 0.4 + Math.random() * 0.6;
    for (let i = 0; i < 60; i++) {
      popData[at + i] += (Math.random() * 2 - 1) * strength * (1 - i / 60);
    }
  }

  const noiseSource = audioContext.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  const popSource = audioContext.createBufferSource();
  popSource.buffer = popBuffer;
  popSource.loop = true;

  const bandpass = audioContext.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 1600;
  bandpass.Q.value = 0.7;

  const highpass = audioContext.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 900;

  const masterGain = audioContext.createGain();
  masterGain.gain.value = 0;

  noiseSource.connect(bandpass);
  bandpass.connect(masterGain);
  popSource.connect(highpass);
  highpass.connect(masterGain);
  masterGain.connect(destination);

  const nodes = [noiseSource, popSource];

  return {
    start() {
      for (const node of nodes) node.start();
    },
    stop() {
      for (const node of nodes) {
        try { node.stop(); } catch (_) {}
      }
    },
    setVolume(value) {
      masterGain.gain.setTargetAtTime(value, audioContext.currentTime, 0.05);
    },
  };
}
