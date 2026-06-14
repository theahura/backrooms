// Dev tool (build-time, not shipped): parametrically generates the top-down
// pixel grids for the small radial creatures (crawler, spitter) from primitives
// -- ellipse body, splayed legs, dark outline. Run this to (re)derive the grids,
// eyeball the PNG previews, then paste the emitted `data` arrays into
// src/systems/sprites.js.
//
// The player and basic zombie are NO LONGER generated here -- they are
// 8-direction PNG sprites built by scripts/gen-character-directional.mjs.
//
//   node scripts/gen-character-sprites.mjs
//
// Writes previews to screenshots/sprite-preview/gen/ and the JS data arrays to
// screenshots/sprite-preview/characters.txt (both gitignored).
import fs from 'node:fs';
import { Jimp } from 'jimp';
import { CHARACTER_PALETTES as PAL } from '../src/systems/sprites.js';

const OUT_DIR = new URL('../screenshots/sprite-preview/gen/', import.meta.url);
const TXT = new URL('../screenshots/sprite-preview/characters.txt', import.meta.url);

// Palettes are imported from sprites.js (the single source of truth) so the
// previews never drift from the shipped art.

// ── Grid helpers ─────────────────────────────────────────────────────────────
function makeGrid(w, h) {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
}
function inBounds(g, x, y) {
  return y >= 0 && y < g.length && x >= 0 && x < g[0].length;
}
function set(g, x, y, ch) {
  if (inBounds(g, x, y)) g[Math.round(y)][Math.round(x)] = ch;
}
// Filled ellipse with a top-down vertical light ramp: pass an array of palette
// chars from lightest (top/north) to darkest (bottom/south).
function ellipse(g, cx, cy, rx, ry, ramp) {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) {
        const t = (y - (cy - ry)) / (2 * ry); // 0 at top .. 1 at bottom
        const idx = Math.min(ramp.length - 1, Math.max(0, Math.floor(t * ramp.length)));
        g[y][x] = ramp[idx];
      }
    }
  }
}
function circle(g, cx, cy, r, ramp) {
  ellipse(g, cx, cy, r, r, ramp);
}
function rect(g, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x, y, ch);
}
// Thick segment from (x0,y0) to (x1,y1) with given half-thickness.
function thickLine(g, x0, y0, x1, y1, half, ch) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    for (let dy = -half; dy <= half; dy++)
      for (let dx = -half; dx <= half; dx++) set(g, x + dx, y + dy, ch);
  }
}
// Wrap the silhouette in a 1px black outline (the bold dark edge that keeps the
// sprite readable against any background).
function outline(g) {
  const h = g.length;
  const w = g[0].length;
  const orig = g.map((r) => r.slice());
  const filled = (x, y) => inBounds(g, x, y) && orig[y][x] !== '.';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (orig[y][x] !== '.') continue;
      if (
        filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1) ||
        filled(x - 1, y - 1) || filled(x + 1, y - 1) || filled(x - 1, y + 1) || filled(x + 1, y + 1)
      ) {
        g[y][x] = '0';
      }
    }
  }
}
const toRows = (g) => g.map((r) => r.join(''));

// ── Crawler: small, low, splayed limbs ───────────────────────────────────────
function crawler({ legPhase = 0 } = {}) {
  const g = makeGrid(24, 24);
  ellipse(g, 11, 12, 6, 5, ['6', '5', '4', '3']);
  circle(g, 16, 12, 3, ['6', '5', '4']); // small head toward east
  set(g, 18, 12, '6');
  // six splayed legs, alternating which set is forward
  const a = legPhase === 0 ? 0 : 1;
  const b = legPhase === 0 ? 1 : 0;
  thickLine(g, 8, 9, 3, 6 - a, 0, '4');
  thickLine(g, 11, 8, 10, 3 - b, 0, '4');
  thickLine(g, 8, 15, 3, 18 + a, 0, '4');
  thickLine(g, 11, 16, 10, 21 + b, 0, '4');
  thickLine(g, 14, 9, 16, 4 - b, 0, '4');
  thickLine(g, 14, 15, 16, 20 + a, 0, '4');
  outline(g);
  return g;
}

// ── Spitter: bloated round body with an acid sac that opens east on attack ───
function spitter({ pulse = 0, mouth = 0, sway = 0 } = {}) {
  const g = makeGrid(32, 32);
  const cx = 14 + sway; // body sways side-to-side while walking
  ellipse(g, cx, 16, 9 + pulse, 9 + pulse, ['6', '5', '4', '3', '2', '1']);
  // glistening highlights
  set(g, cx - 3, 11, '6'); set(g, cx - 2, 12, '6'); set(g, cx + 2, 13, '6');
  // small head / maw toward east
  circle(g, cx + 8, 16, 4, ['5', '4', '3']);
  if (mouth) {
    rect(g, 24, 15, 27, 17, '7'); // open maw, acid forming
    rect(g, 28, 15, 29, 16, '7');
  } else {
    set(g, cx + 10, 16, '1');
  }
  outline(g);
  return g;
}

// ── Build all frames ─────────────────────────────────────────────────────────
const FRAMES = {
  crawler_idle_0: ['crawler', crawler({ legPhase: 0 })],
  crawler_walk_0: ['crawler', crawler({ legPhase: 1 })],
  crawler_walk_1: ['crawler', crawler({ legPhase: 0 })],
  spitter_idle_0: ['spitter', spitter({ pulse: 0 })],
  spitter_idle_1: ['spitter', spitter({ pulse: 1 })],
  spitter_walk_0: ['spitter', spitter({ pulse: 0, sway: -1 })],
  spitter_walk_1: ['spitter', spitter({ pulse: 1, sway: 1 })],
  spitter_attack_0: ['spitter', spitter({ pulse: 1, mouth: 1 })],
};

function hexToInt(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return ((n << 8) | 0xff) >>> 0;
}
async function preview(name, palKey, grid, scale = 10) {
  const pal = PAL[palKey];
  const h = grid.length;
  const w = grid[0].length;
  const img = new Jimp({ width: w * scale, height: h * scale, color: 0x202020ff });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      if (ch === '.') continue;
      const rgba = hexToInt(pal[ch]);
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) img.setPixelColor(rgba, x * scale + dx, y * scale + dy);
    }
  fs.writeFileSync(new URL(`${name}.png`, OUT_DIR), await img.getBuffer('image/png'));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let txt = '';
  for (const [name, [palKey, grid]] of Object.entries(FRAMES)) {
    await preview(name, palKey, grid);
    const rows = toRows(grid);
    txt += `  ${name}: {\n    data: [\n${rows.map((r) => `      '${r}',`).join('\n')}\n    ],\n    palette: CHARACTER_PALETTES.${palKey},\n    pixelWidth: 1,\n  },\n\n`;
  }
  fs.writeFileSync(TXT, txt);
  console.log(`wrote ${Object.keys(FRAMES).length} previews to gen/ and characters.txt`);
}
main();
