// Build-time dev tool (not shipped): generates the 8-direction character sprites
// (player + basic zombie) in the GBA-Pokemon 3/4 top-down style with a flashlight,
// each with a 2-pose walk cycle.
//
// Pipeline per character:
//   1. text-to-image a front ("down") "hero" frame, then image-to-image the other
//      four base facings (down_right, right, up_right, up) FROM that hero so the
//      character stays consistent.
//   2. for each facing, image-to-image two WALK step poses (left leg forward /
//      right leg forward) FROM that facing's frame.
// Frames are chroma-keyed (magenta hue key), the base frames are auto-cropped and
// scaled to a uniform height/centre, and each walk frame is registered to its base
// by the HEAD (top y, centroid x, width) so the upper body stays locked while the
// legs articulate. The three left-side facings are NOT generated -- the engine
// mirrors the right-side textures with flipX (so e.g. player_down_right is also
// horizontally flipped here, see FLIP_OUTPUT).
//
//   node scripts/gen-character-directional.mjs              # generate missing
//   node scripts/gen-character-directional.mjs --force      # regenerate all (API)
//   node scripts/gen-character-directional.mjs player       # only this character
//   node scripts/gen-character-directional.mjs --reprocess  # rebuild PNGs from cached raws (no API)
//   node scripts/gen-character-directional.mjs --preview    # rebuild preview only
//
// Requires GEMINI_KEY in repo-root .env. Writes committed PNGs to
// src/assets/sprites/ and a scaled contact sheet to
// screenshots/sprite-preview/chars-preview.png (gitignored).
import fs from 'node:fs';
import { Jimp, ResizeStrategy } from 'jimp';

const MODEL = 'gemini-2.5-flash-image';
const OUT_DIR = new URL('../src/assets/sprites/', import.meta.url);
const RAW_DIR = new URL('../screenshots/sprite-preview/raw/', import.meta.url);
const PREVIEW = new URL('../screenshots/sprite-preview/chars-preview.png', import.meta.url);
const THROTTLE_MS = 4000;
const MAX_RETRIES = 5;

// Final sprite canvas. Native 64px keeps enough detail to display ~48-56px in
// game without the mushy look of a hard downscale to sprite size.
const CANVAS = 64;
const CONTENT_H = 58; // base-frame character height within the canvas
const HEAD_BAND = 0.30; // top fraction of the silhouette treated as the head for registration
const CHROMA = 'magenta, exact hex #FF00FF (RGB 255,0,255)'; // both characters are greenish, so key on magenta

const BASES = ['down', 'down_right', 'right', 'up_right', 'up'];
const WALK_SUFFIXES = ['_walk0', '_walk1'];

// Frames the model draws facing the wrong way. The player hero holds the
// flashlight in its (screen-left) hand, and image-to-image keeps it there for
// the down-right turn -- so `player_down_right` comes out facing down-LEFT.
// Flip it horizontally so the authored down-right frame actually points
// down-right (and its mirror, used for down-left aim, then points down-left).
const FLIP_OUTPUT = new Set(['player_down_right']);

const STYLE =
  'GBA Pokemon overworld pixel-art style: a 3/4 top-down view seen slightly from ' +
  'above and in front, chunky readable pixels, a bold dark outline around the ' +
  'whole character, a limited flat color palette with simple cel shading, the ' +
  'full body with head, torso, arms and legs visible. Single character centred, ' +
  'filling most of the frame, no drop shadow, no ground, no text, no labels. ' +
  `CRITICAL: the entire background must be solid flat chroma key ${CHROMA}, ` +
  'with NO gradient, NO noise, NO texture and NO shadow.';

const CHARACTERS = {
  player:
    'a lone backrooms explorer/survivor wearing a dark olive-green hooded jacket ' +
    'and dark trousers, holding a chunky grey flashlight at their side (the ' +
    'flashlight is OFF -- NO light beam, NO glow, NO light cone)',
  enemy:
    'a shambling rotten humanoid zombie with greyish sickly skin, a gaunt sunken ' +
    'face, tattered dark blood-stained rags and empty bony clawed hands (holding ' +
    'NOTHING, no items, no weapon, no flashlight), arms hanging forward',
};

const FACING = {
  down: 'standing and facing toward the camera (front view), face and chest visible',
  down_right: 'facing diagonally down-and-to-the-right (three-quarter front), turned toward the lower-right',
  right: 'facing directly to the RIGHT in side profile, mid-stride walking to the right',
  up_right: 'facing diagonally up-and-to-the-right (three-quarter back), turned away to the upper-right',
  up: 'facing directly AWAY from the camera (back view): we see the back of the head/hood, the face is hidden',
};

// The two walk legs poses (image-to-image from each base facing). Phrased as an
// EXAGGERATED stride with one foot clearly lifted -- a subtle shift reads as a
// wiggle rather than a step, especially for the foreshortened front/back views.
const WALK_LEGS = [
  'the LEFT leg is clearly lifted and striding forward, knee bent and foot raised well off the ground, ' +
    'while the RIGHT leg is planted straight back and extended -- an obvious, exaggerated mid-walk step ' +
    'with the legs FAR apart (not a subtle shift)',
  'the RIGHT leg is clearly lifted and striding forward, knee bent and foot raised well off the ground, ' +
    'while the LEFT leg is planted straight back and extended -- an obvious, exaggerated mid-walk step ' +
    'with the legs FAR apart (not a subtle shift)',
];

function loadKey() {
  const envText = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*GEMINI_KEY\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  throw new Error('GEMINI_KEY not found in .env');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callModel(key, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
  };
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      await sleep(THROTTLE_MS * 2 ** attempt);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const respParts = json?.candidates?.[0]?.content?.parts || [];
    const b64 = respParts.find((p) => p.inlineData?.data)?.inlineData?.data
      || respParts.find((p) => p.inline_data?.data)?.inline_data?.data;
    if (!b64) throw new Error('no image part in response');
    return Buffer.from(b64, 'base64');
  }
  throw new Error('exhausted retries');
}

const textPart = (text) => ({ text });
const imagePart = (buf) => ({ inlineData: { mimeType: 'image/png', data: buf.toString('base64') } });

const heroPrompt = (subject) =>
  `A single video-game character sprite, front view. The character is ${subject}, ${FACING.down}. ${STYLE}`;

const turnPrompt = (subject, facing) =>
  `Here is a reference sprite of a character. Redraw the EXACT SAME character (${subject}) -- same colors, ` +
  `same proportions, same outfit, same flashlight, same art style, same size -- but now ${facing}. ${STYLE}`;

const walkPrompt = (subject, facing, legs) =>
  `Here is a reference sprite of this character standing (${facing}). Redraw the EXACT SAME character ` +
  `(${subject}) -- same colours, proportions, outfit, art style, size and viewing angle -- but mid-stride ` +
  `WALKING: ${legs}, with a subtle step bounce. Keep the head, torso and arms in the SAME position and size ` +
  `as the reference; ONLY the legs change. ${STYLE}`;

// --- image post-processing -------------------------------------------------
// Global magenta hue key: drop any pixel where green is strongly suppressed
// relative to red AND blue (i.e. magenta/pink), everywhere -- not just the
// border. Neither character contains magenta, so this also clears background
// trapped in concavities (between an arm and the torso) and the anti-aliased
// pink fringe a plain flood-fill leaves behind. Olive greens, grey flesh and
// red-brown rags all have low blue, so they survive.
function keyChroma(img) {
  const { data, width, height } = img.bitmap;
  for (let i = 0; i < width * height; i++) {
    const di = i * 4;
    const r = data[di], g = data[di + 1], b = data[di + 2];
    const m = Math.min(r, b);
    if (m > 50 && g < 0.85 * m) data[di + 3] = 0;
  }
}

function contentBBox(img) {
  const { data, width, height } = img.bitmap;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// Head anchor for registration: the top HEAD_BAND of the silhouette, returned as
// { top y, centroid x, width }. The head barely moves during a walk, so locking
// it keeps the upper body steady while the legs swing.
function measureHead(img) {
  const box = contentBBox(img);
  if (!box) throw new Error('frame is empty after background removal');
  const top = box.y;
  const headBottom = top + Math.round(HEAD_BAND * box.h);
  const { data, width } = img.bitmap;
  let minX = width, maxX = -1;
  for (let y = top; y <= headBottom; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    }
  }
  return { top, cx: (minX + maxX) / 2, w: maxX - minX + 1 };
}

// raw base PNG -> normalised CANVASxCANVAS sprite (uniform size and centre).
async function normaliseBase(buffer) {
  const img = await Jimp.fromBuffer(buffer);
  img.resize({ w: 256, h: 256, mode: ResizeStrategy.BILINEAR });
  keyChroma(img);
  const box = contentBBox(img);
  if (!box) throw new Error('frame is empty after background removal');
  img.crop({ x: box.x, y: box.y, w: box.w, h: box.h });
  const scale = CONTENT_H / box.h;
  img.resize({ w: Math.max(1, Math.round(box.w * scale)), h: CONTENT_H, mode: ResizeStrategy.BILINEAR });
  keyChroma(img);
  const canvas = new Jimp({ width: CANVAS, height: CANVAS, color: 0x00000000 });
  canvas.composite(img, Math.round((CANVAS - img.bitmap.width) / 2), CANVAS - CONTENT_H - 2);
  return canvas;
}

// raw walk PNG -> CANVASxCANVAS frame whose head matches `target` (so it
// registers to the base frame; legs fall wherever the model drew them).
async function normaliseWalk(buffer, target) {
  const img = await Jimp.fromBuffer(buffer);
  img.resize({ w: 256, h: 256, mode: ResizeStrategy.BILINEAR });
  keyChroma(img);
  const h = measureHead(img);
  const s = target.w / h.w;
  img.resize({ w: Math.round(256 * s), h: Math.round(256 * s), mode: ResizeStrategy.BILINEAR });
  keyChroma(img);
  const dx = Math.round(target.cx - h.cx * s);
  const dy = Math.round(target.top - h.top * s);
  const canvas = new Jimp({ width: CANVAS, height: CANVAS, color: 0x00000000 });
  canvas.composite(img, dx, dy);
  return canvas;
}

const writePng = async (name, img) =>
  fs.writeFileSync(new URL(`${name}.png`, OUT_DIR), await img.getBuffer('image/png'));

// Process one facing's cached raws into committed PNGs: the base, and its two
// walk frames registered to the base head. Honors FLIP_OUTPUT by mirroring the
// head target so the (unflipped) walk raws anchor correctly before the flip.
async function processFacing(prefix, base, baseRaw, walkRaws) {
  const flip = FLIP_OUTPUT.has(`${prefix}_${base}`);
  const baseCanvas = await normaliseBase(baseRaw);
  if (flip) baseCanvas.flip({ horizontal: true, vertical: false });
  await writePng(`${prefix}_${base}`, baseCanvas);

  const head = measureHead(baseCanvas);
  const target = flip ? { ...head, cx: CANVAS - 1 - head.cx } : head;
  for (let i = 0; i < WALK_SUFFIXES.length; i++) {
    if (!walkRaws[i]) continue;
    const wc = await normaliseWalk(walkRaws[i], target);
    if (flip) wc.flip({ horizontal: true, vertical: false });
    await writePng(`${prefix}_${base}${WALK_SUFFIXES[i]}`, wc);
  }
}

async function buildPreview() {
  const prefixes = Object.keys(CHARACTERS);
  const scale = 5, pad = 6;
  const cell = CANVAS * scale + pad;
  const sheet = new Jimp({ width: cell * BASES.length + pad, height: cell * prefixes.length + pad, color: 0x303030ff });
  for (let r = 0; r < prefixes.length; r++) {
    for (let c = 0; c < BASES.length; c++) {
      const p = new URL(`${prefixes[r]}_${BASES[c]}.png`, OUT_DIR);
      if (!fs.existsSync(p)) continue;
      const f = await Jimp.read(p);
      f.resize({ w: CANVAS * scale, h: CANVAS * scale, mode: ResizeStrategy.NEAREST_NEIGHBOR });
      sheet.composite(f, pad + c * cell, pad + r * cell);
    }
  }
  fs.mkdirSync(new URL('./', PREVIEW), { recursive: true });
  fs.writeFileSync(PREVIEW, await sheet.getBuffer('image/png'));
  console.log(`preview -> ${PREVIEW.pathname}`);
}

const rawPath = (name) => new URL(`${name}.png`, RAW_DIR);
const readRaw = (name) => (fs.existsSync(rawPath(name)) ? fs.readFileSync(rawPath(name)) : null);

// Return the cached raw for `name`, or generate it via genParts() (an array of
// prompt parts), cache it, and throttle.
async function ensureRaw(key, name, force, genParts) {
  if (!force) { const cached = readRaw(name); if (cached) return cached; }
  const buf = await callModel(key, genParts());
  fs.writeFileSync(rawPath(name), buf);
  await sleep(THROTTLE_MS);
  return buf;
}

// Re-run post-processing over cached raw model outputs (no API calls), so the
// chroma key / registration can be tuned cheaply after generation.
async function reprocess(only) {
  for (const prefix of Object.keys(CHARACTERS)) {
    if (only.length && !only.includes(prefix)) continue;
    for (const base of BASES) {
      const baseRaw = readRaw(`${prefix}_${base}`);
      if (!baseRaw) { console.log(`${prefix} ${base}: no cached raw, skip`); continue; }
      const walkRaws = WALK_SUFFIXES.map((suf) => readRaw(`${prefix}_${base}${suf}`));
      await processFacing(prefix, base, baseRaw, walkRaws);
      console.log(`${prefix} ${base}: reprocessed`);
    }
  }
  await buildPreview();
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--preview')) { await buildPreview(); return; }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });
  if (args.includes('--reprocess')) { await reprocess(only); return; }

  const force = args.includes('--force');
  const key = loadKey();
  for (const [prefix, subject] of Object.entries(CHARACTERS)) {
    if (only.length && !only.includes(prefix)) continue;

    // 1) base facings (hero front, then image-to-image turns).
    const baseRaws = {};
    baseRaws.down = await ensureRaw(key, `${prefix}_down`, force, () => [textPart(heroPrompt(subject))]);
    for (const base of BASES) {
      if (base === 'down') continue;
      baseRaws[base] = await ensureRaw(key, `${prefix}_${base}`, force,
        () => [textPart(turnPrompt(subject, FACING[base])), imagePart(baseRaws.down)]);
    }

    // 2) two walk step poses per facing, image-to-image from that facing's frame.
    for (const base of BASES) {
      const walkRaws = [];
      for (let i = 0; i < WALK_LEGS.length; i++) {
        walkRaws[i] = await ensureRaw(key, `${prefix}_${base}${WALK_SUFFIXES[i]}`, force,
          () => [textPart(walkPrompt(subject, FACING[base], WALK_LEGS[i])), imagePart(baseRaws[base])]);
      }
      await processFacing(prefix, base, baseRaws[base], walkRaws);
      console.log(`${prefix} ${base}: base + walk`);
    }
  }
  await buildPreview();
  console.log('\nDone.');
}
main();
