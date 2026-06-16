import { SOUND_CONFIGS, AMBIENT_SOUND_TYPES, getDroneParams } from './audio.js';

function fillNoise(data) {
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
}

// Soft-clip distortion curve (MDN). Higher `amount` adds more harmonics and
// subharmonic grit — the "roughness" that makes a creature read as menacing
// rather than like a clean synth tone.
function makeDistortionCurve(amount) {
  const k = amount;
  const n = 8192;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// Procedural reverb impulse: exponentially-decaying stereo noise. Convolved
// against a one-shot it bakes in the tail of a large, empty liminal space.
function makeReverbIR(ctx, decay) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * decay));
  const ir = ctx.createBuffer(2, len, rate);
  const decayBase = Math.pow(1 / 1000, 1 / len);
  for (let c = 0; c < 2; c++) {
    const ch = ir.getChannelData(c);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(decayBase, i);
    }
  }
  return ir;
}

// Total render length including any reverb tail, so the convolved decay isn't
// clipped off the end of the offline buffer.
function renderSeconds(config) {
  return config.duration + (config.reverb ? config.reverb.decay : 0);
}

// Connect a node to the offline destination dry, plus (optionally) a parallel
// convolution-reverb send so the sound sits in a space.
function connectWithReverb(offCtx, node, reverb) {
  node.connect(offCtx.destination);
  if (!reverb) return;
  const convolver = offCtx.createConvolver();
  convolver.buffer = makeReverbIR(offCtx, reverb.decay);
  const wet = offCtx.createGain();
  wet.gain.value = reverb.wet;
  node.connect(wet);
  wet.connect(convolver);
  convolver.connect(offCtx.destination);
}

async function renderGunshot(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * renderSeconds(config));
  const offCtx = new OfflineAudioContext(1, length, sampleRate);

  const out = offCtx.createGain();

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
  noiseGain.connect(out);

  const osc = offCtx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(config.bodyFreq, 0);
  osc.frequency.exponentialRampToValueAtTime(1, config.bodyDecay);
  const oscGain = offCtx.createGain();
  oscGain.gain.setValueAtTime(config.gain * 0.6, 0);
  oscGain.gain.exponentialRampToValueAtTime(0.001, config.bodyDecay);
  osc.connect(oscGain);
  oscGain.connect(out);

  connectWithReverb(offCtx, out, config.reverb);

  noise.start(0);
  osc.start(0);
  return offCtx.startRendering();
}

async function renderNoiseBurst(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * renderSeconds(config));
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
  connectWithReverb(offCtx, gain, config.reverb);
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
  const length = Math.ceil(sampleRate * renderSeconds(config));
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
  connectWithReverb(offCtx, gain, config.reverb);
  osc.start(0);
  return offCtx.startRendering();
}

// Generic organic-creature voice. Layers (all optional, config-driven):
//   inharmonic oscillator stack OR bandpassed noise  (the raw voice)
//   amplitude-modulation roughness in the 20-150Hz band  (menace, not melody)
//   waveshaper distortion  (subharmonics / chaos)
//   parallel formant bandpass bank  (throaty, vocal-tract quality)
//   a sub-bass layer  (body / weight)
// Numeric params are tuned by ear in playtest, not asserted in tests.
async function renderCreature(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * renderSeconds(config));
  const offCtx = new OfflineAudioContext(1, length, sampleRate);
  const dur = config.duration;
  const attack = config.attack != null ? config.attack : 0.06;
  const nodesToStart = [];

  // --- raw voice source ---
  let sourceOut;
  if (config.source === 'noise') {
    const noiseBuf = offCtx.createBuffer(1, length, sampleRate);
    fillNoise(noiseBuf.getChannelData(0));
    const noise = offCtx.createBufferSource();
    noise.buffer = noiseBuf;
    const bp = offCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = config.noiseFreq || 500;
    bp.Q.value = config.noiseQ || 8;
    if (config.noiseLfoFreq) {
      const lfo = offCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = config.noiseLfoFreq;
      const lfoGain = offCtx.createGain();
      lfoGain.gain.value = config.noiseLfoDepth || 200;
      lfo.connect(lfoGain);
      lfoGain.connect(bp.frequency);
      nodesToStart.push(lfo);
    }
    noise.connect(bp);
    sourceOut = bp;
    nodesToStart.push(noise);
  } else {
    const partials = config.partials || [1];
    const mix = offCtx.createGain();
    mix.gain.value = 1 / partials.length;
    for (const mult of partials) {
      const osc = offCtx.createOscillator();
      osc.type = config.oscType || 'sawtooth';
      osc.frequency.setValueAtTime(config.baseFreq * mult, 0);
      if (config.endFreq) {
        osc.frequency.linearRampToValueAtTime(config.endFreq * mult, dur);
      }
      osc.connect(mix);
      nodesToStart.push(osc);
    }
    sourceOut = mix;
  }

  let node = sourceOut;

  // --- amplitude-modulation roughness ---
  if (config.amFreq) {
    const depth = config.amDepth != null ? config.amDepth : 0.8;
    const am = offCtx.createGain();
    am.gain.value = 1 - depth / 2; // DC offset keeps this AM rather than full ring-mod
    const lfo = offCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = config.amFreq;
    const lfoGain = offCtx.createGain();
    lfoGain.gain.value = depth / 2;
    lfo.connect(lfoGain);
    lfoGain.connect(am.gain);
    node.connect(am);
    node = am;
    nodesToStart.push(lfo);
  }

  // --- distortion ---
  if (config.distortion) {
    const shaper = offCtx.createWaveShaper();
    shaper.curve = makeDistortionCurve(config.distortion);
    shaper.oversample = '4x';
    node.connect(shaper);
    node = shaper;
  }

  // --- formant bank ---
  if (config.formants && config.formants.length) {
    const formantSum = offCtx.createGain();
    for (const f of config.formants) {
      const bp = offCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f.freq;
      bp.Q.value = f.q || 10;
      node.connect(bp);
      bp.connect(formantSum);
    }
    node = formantSum;
  }

  // --- amplitude envelope ---
  const env = offCtx.createGain();
  env.gain.setValueAtTime(0, 0);
  env.gain.linearRampToValueAtTime(config.gain, attack);
  env.gain.setValueAtTime(config.gain, dur * 0.7);
  env.gain.exponentialRampToValueAtTime(0.0001, dur);
  node.connect(env);

  const out = offCtx.createGain();
  env.connect(out);

  // --- sub-bass body ---
  if (config.subFreq) {
    const sub = offCtx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = config.subFreq;
    const subEnv = offCtx.createGain();
    subEnv.gain.setValueAtTime(0, 0);
    subEnv.gain.linearRampToValueAtTime(config.subGain || 0.3, attack);
    subEnv.gain.exponentialRampToValueAtTime(0.0001, dur);
    sub.connect(subEnv);
    subEnv.connect(out);
    nodesToStart.push(sub);
  }

  connectWithReverb(offCtx, out, config.reverb);

  for (const n of nodesToStart) n.start(0);
  return offCtx.startRendering();
}

// A door opening: a hinge creak — noise through a high-Q bandpass whose centre
// frequency lurches in irregular steps (stick-slip friction) with a stuttering
// amplitude — finished with a reverb tail so it sits in the space.
async function renderDoorOpen(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * renderSeconds(config));
  const offCtx = new OfflineAudioContext(1, length, sampleRate);
  const dur = config.duration;
  const out = offCtx.createGain();

  const noiseBuffer = offCtx.createBuffer(1, length, sampleRate);
  fillNoise(noiseBuffer.getChannelData(0));
  const noise = offCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const bp = offCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = config.creakQ || 18;
  const fStart = config.creakFreqStart || 300;
  const fEnd = config.creakFreqEnd || 900;
  bp.frequency.setValueAtTime(fStart, 0);

  const creakGain = offCtx.createGain();
  creakGain.gain.setValueAtTime(0, 0);
  creakGain.gain.linearRampToValueAtTime(config.gain, 0.04);

  const steps = 10;
  const sweepEnd = dur * 0.85;
  for (let i = 1; i <= steps; i++) {
    const t = sweepEnd * (i / steps);
    const base = fStart + (fEnd - fStart) * (i / steps);
    bp.frequency.setValueAtTime(base * (0.85 + Math.random() * 0.3), t);
    creakGain.gain.setValueAtTime(config.gain * (0.4 + Math.random() * 0.6), t);
  }
  creakGain.gain.exponentialRampToValueAtTime(0.0001, dur);

  noise.connect(bp);
  bp.connect(creakGain);
  creakGain.connect(out);

  connectWithReverb(offCtx, out, config.reverb);
  noise.start(0);
  return offCtx.startRendering();
}

// A door slamming: a sharp highpassed latch click, then a pitch-dropping body
// thud built from wood/metal partials, with a reverb tail for weight and space.
async function renderDoorSlam(ctx, config) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * renderSeconds(config));
  const offCtx = new OfflineAudioContext(1, length, sampleRate);
  const dur = config.duration;
  const out = offCtx.createGain();

  // latch click
  const clickLen = Math.ceil(sampleRate * 0.02);
  const clickBuf = offCtx.createBuffer(1, clickLen, sampleRate);
  fillNoise(clickBuf.getChannelData(0));
  const click = offCtx.createBufferSource();
  click.buffer = clickBuf;
  const hp = offCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = config.clickFreq || 3000;
  const clickGain = offCtx.createGain();
  clickGain.gain.setValueAtTime(config.gain, 0);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, 0.02);
  click.connect(hp);
  hp.connect(clickGain);
  clickGain.connect(out);

  // body thud
  const thudStart = config.thudFreqStart || 110;
  const thudEnd = config.thudFreqEnd || 55;
  const partials = config.partials || [1, 1.8, 3.2];
  const thudGain = offCtx.createGain();
  thudGain.gain.setValueAtTime(config.gain, 0);
  thudGain.gain.exponentialRampToValueAtTime(0.0001, dur * 0.9);
  for (const mult of partials) {
    const osc = offCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(thudStart * mult, 0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, thudEnd * mult), 0.08);
    const g = offCtx.createGain();
    g.gain.value = 1 / partials.length;
    osc.connect(g);
    g.connect(thudGain);
    osc.start(0);
  }
  thudGain.connect(out);

  connectWithReverb(offCtx, out, config.reverb);
  click.start(0);
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
  const nodesToStart = [];

  const noiseBuffer = offCtx.createBuffer(1, length, sampleRate);
  fillNoise(noiseBuffer.getChannelData(0));
  const noise = offCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  nodesToStart.push(noise);

  const filter = offCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = config.freq;
  filter.Q.value = config.Q;
  noise.connect(filter);

  // Optional fast amplitude modulation gives the clicks an insectoid buzz.
  let chain = filter;
  if (config.amFreq) {
    const am = offCtx.createGain();
    am.gain.value = 0.5;
    const lfo = offCtx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = config.amFreq;
    const lfoGain = offCtx.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(am.gain);
    filter.connect(am);
    chain = am;
    nodesToStart.push(lfo);
  }

  const gain = offCtx.createGain();
  gain.gain.setValueAtTime(0, 0);
  for (let i = 0; i < config.clicks; i++) {
    const start = i * (config.clickDuration + config.clickGap);
    if (start >= config.duration) break;
    gain.gain.setValueAtTime(config.gain, start);
    gain.gain.setValueAtTime(0, start + config.clickDuration);
  }

  chain.connect(gain);
  gain.connect(offCtx.destination);
  for (const n of nodesToStart) n.start(0);
  return offCtx.startRendering();
}

const RENDERERS = {
  gunshot: renderGunshot,
  noise_burst: renderNoiseBurst,
  chime: renderChime,
  tone: renderTone,
  sweep_down: renderSweepDown,
  creature: renderCreature,
  door_open: renderDoorOpen,
  door_slam: renderDoorSlam,
  filtered_noise: renderFilteredNoise,
  skitter: renderSkitter,
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

// The ambient bed. The calm core (two detuned saws + a sub sine through a
// lowpass, with a gentle volume swell) is the original "effective" drone, kept
// intact. Layered on top: slow asynchronous LFOs that keep it evolving even at
// rest, plus dread / sub-bass / heartbeat layers that fade in and quicken as
// setIntensity(0..1) rises with the live danger of the game.
export function createAmbientDrone(audioContext, destination) {
  const baseGain = 0.06;
  const initial = getDroneParams(0);

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
  masterGain.gain.value = baseGain;

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = initial.cutoff;

  const osc2Gain = audioContext.createGain();
  osc2Gain.gain.value = 0.6;

  const osc3Gain = audioContext.createGain();
  osc3Gain.gain.value = 0.3;

  // Original gentle volume swell.
  const lfo = audioContext.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.3;
  const lfoGain = audioContext.createGain();
  lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain);
  lfoGain.connect(masterGain.gain);

  // Slow asynchronous "breathing" of the filter cutoff (adds to the intensity
  // base set by setIntensity) and a drifting detune so it never sits still.
  const filterLFO = audioContext.createOscillator();
  filterLFO.type = 'sine';
  filterLFO.frequency.value = 0.05;
  const filterLFOGain = audioContext.createGain();
  filterLFOGain.gain.value = 120;
  filterLFO.connect(filterLFOGain);
  filterLFOGain.connect(filter.frequency);

  const detuneLFO = audioContext.createOscillator();
  detuneLFO.type = 'sine';
  detuneLFO.frequency.value = 0.11;
  const detuneLFOGain = audioContext.createGain();
  detuneLFOGain.gain.value = 8;
  detuneLFO.connect(detuneLFOGain);
  detuneLFOGain.connect(osc2.detune);

  osc1.connect(masterGain);
  osc2.connect(osc2Gain);
  osc2Gain.connect(masterGain);
  osc3.connect(osc3Gain);
  osc3Gain.connect(masterGain);

  // Dread layer: two dissonant (≈tritone) saws, silent until danger rises.
  const dreadA = audioContext.createOscillator();
  dreadA.type = 'sawtooth';
  dreadA.frequency.value = 116;
  const dreadB = audioContext.createOscillator();
  dreadB.type = 'sawtooth';
  dreadB.frequency.value = 164;
  const dreadMix = audioContext.createGain();
  dreadMix.gain.value = initial.dreadGain;
  const dreadAGain = audioContext.createGain();
  dreadAGain.gain.value = 0.5;
  const dreadBGain = audioContext.createGain();
  dreadBGain.gain.value = 0.5;
  dreadA.connect(dreadAGain);
  dreadB.connect(dreadBGain);
  dreadAGain.connect(dreadMix);
  dreadBGain.connect(dreadMix);
  dreadMix.connect(masterGain);

  // Sub-bass rumble that swells with danger.
  const subOsc = audioContext.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.value = 42;
  const subMix = audioContext.createGain();
  subMix.gain.value = initial.subGain;
  subOsc.connect(subMix);
  subMix.connect(masterGain);

  // Heartbeat: a low thump gated by an LFO once per cycle. A gain node passes
  // |gain|*signal, so a raw sine LFO would thump twice per cycle; the shaper
  // rectifies the sine into a one-sided pulse (0 except near its peak) so there
  // is one thump per cycle at heartbeatRate, with silence between beats.
  const heartOsc = audioContext.createOscillator();
  heartOsc.type = 'sine';
  heartOsc.frequency.value = 48;
  const heartPulse = audioContext.createGain();
  heartPulse.gain.value = 0;
  const heartLFO = audioContext.createOscillator();
  heartLFO.type = 'sine';
  heartLFO.frequency.value = initial.heartbeatRate;
  const heartShaper = audioContext.createWaveShaper();
  {
    const n = 1024;
    const curve = new Float32Array(n);
    const threshold = 0.3;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = x > threshold ? (x - threshold) / (1 - threshold) : 0;
    }
    heartShaper.curve = curve;
  }
  const heartLFOGain = audioContext.createGain();
  heartLFOGain.gain.value = initial.heartbeatGain;
  heartLFO.connect(heartShaper);
  heartShaper.connect(heartLFOGain);
  heartLFOGain.connect(heartPulse.gain);
  heartOsc.connect(heartPulse);
  heartPulse.connect(masterGain);

  masterGain.connect(filter);
  filter.connect(destination);

  const nodes = [osc1, osc2, osc3, lfo, filterLFO, detuneLFO, dreadA, dreadB, subOsc, heartOsc, heartLFO];

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
    setIntensity(value) {
      const p = getDroneParams(value);
      const t = audioContext.currentTime;
      filter.frequency.setTargetAtTime(p.cutoff, t, 0.6);
      dreadMix.gain.setTargetAtTime(p.dreadGain, t, 0.6);
      subMix.gain.setTargetAtTime(p.subGain, t, 0.6);
      heartLFOGain.gain.setTargetAtTime(p.heartbeatGain, t, 0.6);
      heartLFO.frequency.setTargetAtTime(p.heartbeatRate, t, 1.5);
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
