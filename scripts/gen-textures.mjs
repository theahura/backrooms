// Offline tileable-texture generator. Calls nano banana (gemini-2.5-flash-image)
// for every entry in TEXTURE_MANIFEST, makes the result tile seamlessly, and
// writes committed opaque PNGs under src/assets/sprites/ (tex_<zone>_floor/wall).
//
// Gemini has no "tiling" mode, so we tile in post: roll the image by half (which
// pushes the four borders -- already continuous interior content -- to the edges)
// and then soften the two resulting interior seams with a blurred band. The
// borders then match when the texture is repeated. Textures are viewed dim under
// the flashlight in-game, so any residual softness is invisible.
//
// Usage:
//   node scripts/gen-textures.mjs                 # generate everything missing
//   node scripts/gen-textures.mjs --force         # regenerate everything
//   node scripts/gen-textures.mjs tex_mall_floor  # only these manifest ids
//   node scripts/gen-textures.mjs --reprocess     # re-tile from cached raws (no API)
//
// Requires GEMINI_KEY in the repo-root .env (build-time dev tool only). Raw model
// outputs are cached under screenshots/texture-raw/ (gitignored) so the tiling
// post-process can be re-tuned with --reprocess without spending API calls.
import fs from 'node:fs';
import { Jimp, ResizeStrategy } from 'jimp';
import { TEXTURE_MANIFEST } from '../src/systems/art.js';

const MODEL = 'gemini-2.5-flash-image';
const OUT_DIR = new URL('../src/assets/sprites/', import.meta.url);
const RAW_DIR = new URL('../screenshots/texture-raw/', import.meta.url);
const THROTTLE_MS = 4000;
const MAX_RETRIES = 5;

function loadKey() {
  const envText = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*GEMINI_KEY\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  throw new Error('GEMINI_KEY not found in .env');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateImage(key, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429 || res.status >= 500) {
      const wait = THROTTLE_MS * Math.pow(2, attempt);
      console.warn(`  ${res.status} -> backoff ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const json = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const b64 = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
    if (!b64) throw new Error('no image part in response');
    return Buffer.from(b64, 'base64');
  }
  throw new Error('exhausted retries');
}

// Shift every pixel by half the image in both axes (with wrap-around). The new
// borders come from the continuous interior of the original, so they tile; the
// discontinuity moves to a cross through the centre.
function rollHalf(img, size) {
  const out = img.clone();
  const half = Math.floor(size / 2);
  const src = img.bitmap.data;
  const dst = out.bitmap.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = (x + half) % size;
      const sy = (y + half) % size;
      const di = (y * size + x) * 4;
      const si = (sy * size + sx) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }
  return out;
}

// Soften the centre cross seam left by rollHalf by blurring a narrow band over
// it. The band is kept thin so the heal reads as a faint line rather than a wide
// smear -- and in-game it sits under the flashlight darkness anyway.
function healSeams(img, size) {
  const half = Math.floor(size / 2);
  const band = Math.max(6, Math.round(size * 0.025));
  const blurR = Math.max(3, Math.round(band / 2));

  const vBand = img.clone().crop({ x: half - band, y: 0, w: band * 2, h: size }).blur(blurR);
  img.composite(vBand, half - band, 0);

  const hBand = img.clone().crop({ x: 0, y: half - band, w: size, h: band * 2 }).blur(blurR);
  img.composite(hBand, 0, half - band);
}

async function makeTileable(buffer, size) {
  const img = await Jimp.fromBuffer(buffer);
  img.resize({ w: size, h: size, mode: ResizeStrategy.BILINEAR });
  const rolled = rollHalf(img, size);
  healSeams(rolled, size);
  return rolled.getBuffer('image/png');
}

function entryExists(entry) {
  return fs.existsSync(new URL(`${entry.key}.png`, OUT_DIR));
}

function rawPath(entry) {
  return new URL(`${entry.key}.png`, RAW_DIR);
}

async function writeTexture(entry, rawBuffer) {
  const png = await makeTileable(rawBuffer, entry.size);
  fs.writeFileSync(new URL(`${entry.key}.png`, OUT_DIR), png);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const reprocess = args.includes('--reprocess');
  const ids = args.filter((a) => !a.startsWith('--'));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const entries = TEXTURE_MANIFEST.filter((e) => (ids.length ? ids.includes(e.id) : true));

  // --reprocess rebuilds the tiled PNGs from cached raws -- no API calls.
  if (reprocess) {
    let n = 0;
    for (const entry of entries) {
      const p = rawPath(entry);
      if (!fs.existsSync(p)) continue;
      await writeTexture(entry, fs.readFileSync(p));
      console.log('reprocessed', entry.key);
      n++;
    }
    console.log(`\nReprocess done. ${n} textures.`);
    return;
  }

  const key = loadKey();
  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of entries) {
    if (!force && entryExists(entry)) {
      skipped++;
      continue;
    }
    process.stdout.write(`[${done + skipped + failed + 1}/${entries.length}] ${entry.id} ... `);
    try {
      const raw = await generateImage(key, entry.prompt);
      fs.writeFileSync(rawPath(entry), raw);
      await writeTexture(entry, raw);
      console.log(`ok -> ${entry.key}`);
      done++;
      await sleep(THROTTLE_MS);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. generated=${done} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main();
