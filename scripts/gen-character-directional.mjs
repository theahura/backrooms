// Build-time dev tool (not shipped): generates the 8-direction character sprites
// (player + basic zombie) in the GBA-Pokemon 3/4 top-down style with a flashlight.
//
// Pipeline: text-to-image a front ("down") "hero" frame, then image-to-image the
// other four base facings (down_right, right, up_right, up) FROM that hero so the
// character stays consistent. Each frame is chroma-keyed, auto-cropped, scaled to
// a uniform height and centred on a fixed canvas (so facings don't jitter in size
// or position), then a "_step" copy shifted up 2px is emitted for the walk bob.
// The three left-side facings are NOT generated -- the engine mirrors the
// right-side textures with flipX.
//
//   node scripts/gen-character-directional.mjs              # generate missing
//   node scripts/gen-character-directional.mjs --force      # regenerate all
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
const CONTENT_H = 58; // character height within the canvas (a little headroom)
const BOB = 2;        // walk bounce: body lifts this many px on each step pose
const LEG_SHEAR = 3;  // walk step: lower body slides up to this many px to one side
const CHROMA = 'magenta, exact hex #FF00FF (RGB 255,0,255)'; // both characters are greenish, so key on magenta

const BASES = ['down', 'down_right', 'right', 'up_right', 'up'];

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

const heroPrompt = (subject) =>
  `A single video-game character sprite, front view. The character is ${subject}, ` +
  `${FACING.down}. ${STYLE}`;

const turnPrompt = (subject, facing) =>
  `Here is a reference sprite of a character. Redraw the EXACT SAME character ` +
  `(${subject}) -- same colors, same proportions, same outfit, same flashlight, ` +
  `same art style, same size -- but now ${facing}. ${STYLE}`;

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

// raw model PNG -> normalised CANVASxCANVAS transparent sprite (uniform size and
// centre across all facings).
async function normalise(buffer) {
  const img = await Jimp.fromBuffer(buffer);
  img.resize({ w: 256, h: 256, mode: ResizeStrategy.BILINEAR });
  keyChroma(img);
  const box = contentBBox(img);
  if (!box) throw new Error('frame is empty after background removal');
  img.crop({ x: box.x, y: box.y, w: box.w, h: box.h });
  const scale = CONTENT_H / box.h;
  img.resize({ w: Math.max(1, Math.round(box.w * scale)), h: CONTENT_H, mode: ResizeStrategy.BILINEAR });
  keyChroma(img); // clean fringe introduced by the second resize
  const canvas = new Jimp({ width: CANVAS, height: CANVAS, color: 0x00000000 });
  canvas.composite(img, Math.round((CANVAS - img.bitmap.width) / 2), CANVAS - CONTENT_H - 2);
  return canvas;
}

// Lift the whole sprite up by `dy` px (the walk bounce).
function bob(canvas, dy) {
  const out = new Jimp({ width: CANVAS, height: CANVAS, color: 0x00000000 });
  out.composite(canvas, 0, -dy);
  return out;
}

// Horizontal shear of the lower body: rows below ~the waist slide sideways,
// ramping from 0 at the waist to `shift` px at the feet (top half untouched), so
// the legs swing to one side for a stepping pose. Positive/negative `shift` give
// the two opposite steps.
function shearLegs(canvas, shift) {
  const { width, height, data } = canvas.bitmap;
  const out = new Jimp({ width, height, color: 0x00000000 });
  const od = out.bitmap.data;
  const waist = Math.round(height * 0.55);
  for (let y = waist; y < height; y++) {
    const dx = Math.round(shift * ((y - waist) / (height - waist)));
    for (let x = 0; x < width; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= width) continue;
      const di = (y * width + x) * 4;
      const si = (y * width + sx) * 4;
      od[di] = data[si]; od[di + 1] = data[si + 1]; od[di + 2] = data[si + 2]; od[di + 3] = data[si + 3];
    }
  }
  // rows above the waist are unchanged
  for (let y = 0; y < waist; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      od[i] = data[i]; od[i + 1] = data[i + 1]; od[i + 2] = data[i + 2]; od[i + 3] = data[i + 3];
    }
  }
  return out;
}

const stepPose = (canvas, shift) => shearLegs(bob(canvas, BOB), shift);

async function writeFrame(prefix, base, canvas) {
  if (FLIP_OUTPUT.has(`${prefix}_${base}`)) canvas.flip({ horizontal: true, vertical: false });
  const write = async (suffix, img) =>
    fs.writeFileSync(new URL(`${prefix}_${base}${suffix}.png`, OUT_DIR), await img.getBuffer('image/png'));
  await write('', canvas);
  await write('_walk0', stepPose(canvas, LEG_SHEAR));
  await write('_walk1', stepPose(canvas, -LEG_SHEAR));
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

// Re-run post-processing over cached raw model outputs (no API calls), so the
// chroma key / normalisation can be tuned cheaply after generation.
async function reprocess(only) {
  for (const prefix of Object.keys(CHARACTERS)) {
    if (only.length && !only.includes(prefix)) continue;
    for (const base of BASES) {
      const raw = new URL(`${prefix}_${base}.png`, RAW_DIR);
      if (!fs.existsSync(raw)) { console.log(`${prefix} ${base}: no cached raw, skip`); continue; }
      await writeFrame(prefix, base, await normalise(fs.readFileSync(raw)));
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
    const heroPath = new URL(`${prefix}_down.png`, OUT_DIR);
    if (!force && fs.existsSync(heroPath)) { console.log(`${prefix}: exists, skip (use --force)`); continue; }

    process.stdout.write(`${prefix} hero (down) ... `);
    const heroRaw = await callModel(key, [{ text: heroPrompt(subject) }]);
    fs.writeFileSync(new URL(`${prefix}_down.png`, RAW_DIR), heroRaw);
    await writeFrame(prefix, 'down', await normalise(heroRaw));
    console.log('ok');
    await sleep(THROTTLE_MS);

    for (const base of BASES) {
      if (base === 'down') continue;
      process.stdout.write(`${prefix} ${base} ... `);
      const raw = await callModel(key, [
        { text: turnPrompt(subject, FACING[base]) },
        { inlineData: { mimeType: 'image/png', data: heroRaw.toString('base64') } },
      ]);
      fs.writeFileSync(new URL(`${prefix}_${base}.png`, RAW_DIR), raw);
      await writeFrame(prefix, base, await normalise(raw));
      console.log('ok');
      await sleep(THROTTLE_MS);
    }
  }
  await buildPreview();
  console.log('\nDone.');
}
main();
