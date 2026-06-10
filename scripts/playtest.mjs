// Playwright playtest: drives the real game in Chromium and captures
// screenshots for visual verification of the spec changes.
//
// Usage: node scripts/playtest.mjs [--headed]
// Expects the vite dev server on http://localhost:5199

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '/tmp/backrooms-playtest';
const URL = 'http://localhost:5199';
const HEADED = process.argv.includes('--headed');

mkdirSync(OUT, { recursive: true });

const CX = 512;
const CY = 384;

function log(msg) {
  console.log(`[playtest] ${msg}`);
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log(`screenshot ${name}`);
}

async function gameEval(page, fn) {
  return page.evaluate(fn);
}

async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

// Hold a key until predicate(state) is true or timeout.
async function holdKeyUntil(page, key, predicate, timeoutMs) {
  await page.keyboard.down(key);
  const start = Date.now();
  let state;
  while (Date.now() - start < timeoutMs) {
    state = await gameEval(page, () => {
      const s = window.__game.scene.getScene('GameScene');
      return { x: s.player.x, y: s.player.y };
    });
    if (predicate(state)) break;
    await new Promise(r => setTimeout(r, 60));
  }
  await page.keyboard.up(key);
  return state;
}

const browser = await chromium.launch({ headless: !HEADED });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
page.on('console', msg => {
  if (msg.type() === 'error') log(`console error: ${msg.text()}`);
});
page.on('pageerror', err => log(`page error: ${err.message}`));

await page.goto(URL);
await page.waitForLoadState('networkidle');
await page.waitForSelector('canvas');
await page.waitForFunction(() => window.__game && window.__game.scene.isActive('TitleScene'));
await page.waitForTimeout(800);
await shot(page, '01-title');

// Start a new game (fresh context has no save, so first option is NEW GAME).
for (let i = 0; i < 10; i++) {
  await page.mouse.click(CX, 400);
  await page.waitForTimeout(1200);
  const started = await gameEval(page, () => {
    const s = window.__game.scene.getScene('GameScene');
    return !!(window.__game.scene.isActive('GameScene') && s && s.entranceRoom);
  });
  if (started) break;
}
await page.waitForTimeout(1500);
await shot(page, '02-store-firstrun');

const info = await gameEval(page, () => {
  const s = window.__game.scene.getScene('GameScene');
  const room = s.entranceRoom;
  const door = room.doors.find(d => d.wall === 'east');
  return {
    player: { x: s.player.x, y: s.player.y },
    room: { x: room.x, y: room.y, width: room.width, height: room.height },
    doorOffset: door ? door.offset : null,
    doorWidth: door ? door.width : null,
    doors: room.doors.map(d => d.wall),
    flashlightOn: s.flashlightState.on,
  };
});
log(`state: ${JSON.stringify(info)}`);
if (info.doors.length !== 1 || info.doors[0] !== 'east') {
  log(`FAIL: store should have exactly one east door, got ${JSON.stringify(info.doors)}`);
}

// Align vertically with the rift opening, then walk east through it.
const riftY = info.room.y + info.doorOffset + info.doorWidth / 2;
log(`aligning to rift y=${riftY}`);
if (info.player.y < riftY) {
  await holdKeyUntil(page, 's', p => p.y >= riftY - 20, 6000);
} else {
  await holdKeyUntil(page, 'w', p => p.y <= riftY + 20, 6000);
}
// Fine alignment with short taps (the coarse hold overshoots).
for (let i = 0; i < 25; i++) {
  const p = await gameEval(page, () => {
    const s = window.__game.scene.getScene('GameScene');
    return { y: s.player.y };
  });
  const diff = riftY - p.y;
  if (Math.abs(diff) <= 5) break;
  await holdKey(page, diff > 0 ? 's' : 'w', Math.min(120, Math.max(40, Math.abs(diff) * 3)));
  await page.waitForTimeout(80);
}
await page.waitForTimeout(300);
await shot(page, '03-approach-rift');

// Walk east, sidestepping furniture when progress stalls, then re-align with
// the rift for the final approach.
let lastX = -Infinity;
let sidestep = 's';
for (let i = 0; i < 60; i++) {
  const p = await gameEval(page, () => {
    const s = window.__game.scene.getScene('GameScene');
    return { x: s.player.x, y: s.player.y };
  });
  if (p.x > info.room.x + info.room.width + 30) break;

  if (p.x > info.room.x + info.room.width - 90 && Math.abs(p.y - riftY) > 8) {
    await holdKey(page, p.y < riftY ? 's' : 'w', Math.min(150, Math.abs(p.y - riftY) * 3));
    await page.waitForTimeout(60);
    continue;
  }

  if (p.x - lastX < 3) {
    sidestep = sidestep === 's' ? 'w' : 's';
    await holdKey(page, sidestep, 350);
  }
  lastX = p.x;
  await holdKey(page, 'd', 300);
  await page.waitForTimeout(60);
}
const crossed = await gameEval(page, () => {
  const s = window.__game.scene.getScene('GameScene');
  return { x: s.player.x, y: s.player.y };
});
log(`after crossing: ${JSON.stringify(crossed)}`);
await page.waitForTimeout(900);
await shot(page, '04-inside-backrooms');

// Flashlight sweep: aim around the clock, including the 6-to-8 o'clock arc
// where the old cone collapsed.
const sweep = [
  ['east', CX + 200, CY],
  ['southeast', CX + 140, CY + 140],
  ['south-6oclock', CX, CY + 200],
  ['7oclock', CX - 140, CY + 140],
  ['8oclock', CX - 173, CY + 100],
  ['west', CX - 200, CY],
  ['northwest', CX - 140, CY - 140],
  ['north', CX, CY - 200],
];
for (const [name, mx, my] of sweep) {
  await page.mouse.move(mx, my);
  await page.waitForTimeout(250);
  await shot(page, `05-sweep-${name}`);
}

// Toggle the flashlight off and back on.
await page.keyboard.press('f');
await page.waitForTimeout(300);
await shot(page, '06-flashlight-off');
await page.keyboard.press('f');
await page.waitForTimeout(300);

// Walk around the backrooms a bit to see furniture clusters and enemies.
await holdKey(page, 'd', 1200);
await page.mouse.move(CX + 200, CY);
await page.waitForTimeout(300);
await shot(page, '07-backrooms-explore');

const finalState = await gameEval(page, () => {
  const s = window.__game.scene.getScene('GameScene');
  const riftTarget = s.entranceRoom.doors[0].targetRoomId;
  return {
    riftCrossed: s.riftCrossed,
    flashlightOn: s.flashlightState.on,
    segments: s.wallSegments.length,
    hp: s.combatState.hp,
    battery: Math.round(s.batteryState.charge),
    doorOnRift: s.doorStates.some(d => d.roomId === 0 && d.targetRoomId === riftTarget),
  };
});
log(`final: ${JSON.stringify(finalState)}`);
if (finalState.doorOnRift) log('FAIL: a closable door spawned on the rift');

await browser.close();
log('done');
