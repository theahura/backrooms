// Dev tool: render procedural SPRITE_DEFS pixel grids to upscaled PNGs so the
// hand-authored art can be eyeballed without launching the game. Mirrors the
// way Phaser's textures.generate() expands a data grid through a palette.
//
// Usage:
//   node scripts/preview-sprites.mjs                       # all sprites
//   node scripts/preview-sprites.mjs crawler_idle_0 spitter_idle_0
//   node scripts/preview-sprites.mjs --scale 12 crawler_idle_0
//
// Output goes to screenshots/sprite-preview/ (gitignored).
import fs from 'node:fs';
import { Jimp } from 'jimp';
import { SPRITE_DEFS } from '../src/systems/sprites.js';

const OUT_DIR = new URL('../screenshots/sprite-preview/', import.meta.url);

function hexToInt(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return ((n << 8) | 0xff) >>> 0; // RGBA, opaque
}

function renderSprite(def, scale) {
  const pw = def.pixelWidth || 1;
  const ph = def.pixelHeight || pw;
  const cols = def.data[0].length;
  const rows = def.data.length;
  const w = cols * pw * scale;
  const h = rows * ph * scale;
  const img = new Jimp({ width: w, height: h, color: 0x00000000 });
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < def.data[r].length; c++) {
      const ch = def.data[r][c];
      if (ch === '.') continue;
      const hex = def.palette[ch];
      if (!hex) continue;
      const rgba = hexToInt(hex);
      const x0 = c * pw * scale;
      const y0 = r * ph * scale;
      for (let y = 0; y < ph * scale; y++) {
        for (let x = 0; x < pw * scale; x++) {
          img.setPixelColor(rgba, x0 + x, y0 + y);
        }
      }
    }
  }
  return img;
}

async function main() {
  const args = process.argv.slice(2);
  let scale = 10;
  const scaleIdx = args.indexOf('--scale');
  if (scaleIdx !== -1) {
    scale = Number(args[scaleIdx + 1]);
    args.splice(scaleIdx, 2);
  }
  const keys = args.length ? args : Object.keys(SPRITE_DEFS);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const key of keys) {
    const def = SPRITE_DEFS[key];
    if (!def) {
      console.warn(`no sprite def for '${key}'`);
      continue;
    }
    const img = renderSprite(def, scale);
    const out = new URL(`${key}.png`, OUT_DIR);
    fs.writeFileSync(out, await img.getBuffer('image/png'));
    console.log(`wrote ${key}.png (${img.bitmap.width}x${img.bitmap.height})`);
  }
}

main();
