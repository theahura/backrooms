// Offline pixel-art generator. Calls nano banana (gemini-2.5-flash-image) for
// every entry in ART_MANIFEST, chroma-keys the green screen to transparency,
// downscales, and writes committed PNGs under src/assets/sprites/.
//
// Usage:
//   node scripts/generate-art.mjs                 # generate everything missing
//   node scripts/generate-art.mjs --force         # regenerate everything
//   node scripts/generate-art.mjs player door_closed   # only these manifest ids
//
// Requires GEMINI_KEY in the repo-root .env. The key is NEVER shipped to the
// browser -- this is a build-time dev tool only.
import fs from 'node:fs';
import { Jimp, ResizeStrategy } from 'jimp';
import { ART_MANIFEST, isBackgroundSample } from '../src/systems/art.js';

const MODEL = 'gemini-2.5-flash-image';
const OUT_DIR = new URL('../src/assets/sprites/', import.meta.url);
const THROTTLE_MS = 4000;
const MAX_RETRIES = 5;
const ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

function loadKey() {
  const envText = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*GEMINI_KEY\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  throw new Error('GEMINI_KEY not found in .env');
}

function nearestAspect(w, h) {
  const target = Math.log(w / h);
  let best = ASPECTS[0];
  let bestDelta = Infinity;
  for (const a of ASPECTS) {
    const [aw, ah] = a.split(':').map(Number);
    const delta = Math.abs(Math.log(aw / ah) - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = a;
    }
  }
  return best;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateImage(key, prompt, aspectRatio) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio } },
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

// Remove the contiguous background region connected to the image border. The
// reference colour is sampled from the four corners, so whatever colour the
// model used (green, grey-green, purple) is keyed out, while the centered
// sprite -- separated from the border by its dark outline -- is preserved.
function removeBackground(img) {
  const { data, width, height } = img.bitmap;
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  let rr = 0;
  let gg = 0;
  let bb = 0;
  for (const p of corners) {
    rr += data[p * 4];
    gg += data[p * 4 + 1];
    bb += data[p * 4 + 2];
  }
  rr = Math.round(rr / 4);
  gg = Math.round(gg / 4);
  bb = Math.round(bb / 4);

  const visited = new Uint8Array(width * height);
  const stack = [];
  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pi = y * width + x;
    if (visited[pi]) return;
    visited[pi] = 1;
    const di = pi * 4;
    if (isBackgroundSample(data[di], data[di + 1], data[di + 2], data[di + 3], rr, gg, bb)) {
      data[di + 3] = 0;
      stack.push(x, y);
    }
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }
}

// Trim transparent margins so the object fills the frame. For an upright
// billboard this makes setDisplaySize control the real object size and lands the
// object's feet on the sprite's bottom edge (where the contact shadow is drawn).
function autoCropContent(img) {
  const { data, width, height } = img.bitmap;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return;
  img.crop({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
}

async function postProcess(buffer, entry) {
  const img = await Jimp.fromBuffer(buffer);
  img.resize({ w: entry.width, h: entry.height, mode: ResizeStrategy.BILINEAR });
  if (entry.chroma !== false) removeBackground(img);
  if (entry.crop) autoCropContent(img);
  return img.getBuffer('image/png');
}

async function recropExisting(entries) {
  for (const entry of entries) {
    if (!entry.crop) continue;
    for (const k of entry.keys) {
      const p = new URL(`${k}.png`, OUT_DIR);
      if (!fs.existsSync(p)) continue;
      const img = await Jimp.read(p);
      autoCropContent(img);
      fs.writeFileSync(p, await img.getBuffer('image/png'));
    }
    console.log('recropped', entry.id);
  }
}

async function rekeyExisting(entries) {
  for (const entry of entries) {
    if (entry.chroma === false) continue;
    for (const k of entry.keys) {
      const p = new URL(`${k}.png`, OUT_DIR);
      if (!fs.existsSync(p)) continue;
      const img = await Jimp.read(p);
      removeBackground(img);
      fs.writeFileSync(p, await img.getBuffer('image/png'));
    }
    console.log('rekeyed', entry.id);
  }
}

function entryExists(entry) {
  return entry.keys.every((k) => fs.existsSync(new URL(`${k}.png`, OUT_DIR)));
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const rekey = args.includes('--rekey');
  const recrop = args.includes('--recrop');
  const ids = args.filter((a) => !a.startsWith('--'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const entries = ART_MANIFEST.filter((e) => (ids.length ? ids.includes(e.id) : true));

  // --rekey re-runs background removal over already-downloaded PNGs (no API).
  if (rekey) {
    await rekeyExisting(entries);
    console.log('\nRekey done.');
    return;
  }

  // --recrop trims transparent margins on already-downloaded crop:true PNGs (no API).
  if (recrop) {
    await recropExisting(entries);
    console.log('\nRecrop done.');
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
    const aspect = nearestAspect(entry.width, entry.height);
    process.stdout.write(`[${done + skipped + failed + 1}/${entries.length}] ${entry.id} (${aspect}) ... `);
    try {
      const raw = await generateImage(key, entry.prompt, aspect);
      const png = await postProcess(raw, entry);
      for (const k of entry.keys) {
        fs.writeFileSync(new URL(`${k}.png`, OUT_DIR), png);
      }
      console.log(`ok -> ${entry.keys.join(', ')}`);
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
