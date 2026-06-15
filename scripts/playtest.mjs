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

// Make the player invulnerable for the rest of the scripted run, the instant
// they enter the backrooms. New Game mints a random world seed, so some runs
// spawn an enemy right where the player materializes or sweeps; a death tears
// down GameScene (-> RunSummaryScene) and would crash every downstream check.
// The shot check below re-enables damage explicitly.
await gameEval(page, () => {
  const s = window.__game.scene.getScene('GameScene');
  if (s && s.combatState) {
    s.combatState = { ...s.combatState, damageCooldown: Infinity, isDead: false, hp: s.combatState.maxHp };
  }
});

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

// Spec item: "lamps / fluorescent lights ... areas that do provide light
// automatically in some rooms." A lamp must light its local pool on its OWN --
// independent of the flashlight/battery. Drive the REAL render loop: surface a
// lamp-bearing room, drop the player on the lamp, force the flashlight OFF with a
// dead battery, and spy the actual drawRadialGlow used to carve the reveal mask.
// It must still be called at the lamp position (the pool reveals the room with no
// flashlight). Runs here -- right after exploration, loop reliably live -- before
// the mutation-heavy stair/rift checks. Non-vacuous: lampStates must be populated.
const lampCheck = await gameEval(page, async () => {
  const s = window.__game.scene.getScene('GameScene');
  if (!s || !s.lampStates || !s.player || !s.player.body) return { skipped: 'GameScene inactive (player died this run)' };
  // Defensively keep the update loop live so updateDarkness ticks.
  s.isTeleporting = false; s.dayEnding = false;
  s.combatState = { ...s.combatState, isDead: false, damageCooldown: Infinity };

  // Exploration above already activated several backrooms rooms (and their lamps).
  if (s.lampStates.length === 0) return { skipped: 'no lamps generated this seed' };

  const lamp = s.lampStates[0];
  const room = s.roomsById.get(lamp.roomId);
  if (room) s.currentFloor = room.floor;
  const saved = { fx: { ...s.flashlightState }, batt: { ...s.batteryState } };
  s.player.body.reset(lamp.x, lamp.y);
  s.cameras.main.centerOn(lamp.x, lamp.y);
  s.flashlightState = { on: false, hiding: false };
  s.batteryState = { ...s.batteryState, charge: 0, isDepleted: true };

  let lampGlow = 0;
  const realGlow = s.drawRadialGlow.bind(s);
  s.drawRadialGlow = (gfx, x, y, r, steps, color, a) => {
    if (Math.abs(x - lamp.x) < 0.5 && Math.abs(y - lamp.y) < 0.5) lampGlow++;
    return realGlow(gfx, x, y, r, steps, color, a);
  };
  await new Promise(r => setTimeout(r, 250));
  const flashlightOn = s.flashlightState.on;
  s.drawRadialGlow = realGlow;
  s.flashlightState = saved.fx;
  s.batteryState = saved.batt;

  return { lamps: s.lampStates.length, lampGlowWhileFlashlightOff: lampGlow, flashlightOn };
});
if (lampCheck.skipped) {
  log(`lamp check skipped (${lampCheck.skipped})`);
} else {
  await shot(page, '08-lamp-room');
  log(`lamps: count=${lampCheck.lamps} glowWhileOff=${lampCheck.lampGlowWhileFlashlightOff} flashlightOn=${lampCheck.flashlightOn}`);
  if (lampCheck.flashlightOn) log('FAIL: lamp probe did not actually turn the flashlight off (guard is vacuous)');
  if (lampCheck.lampGlowWhileFlashlightOff <= 0) log('FAIL: a lamp did not light its pool with the flashlight off (auto-light broken)');
}

// Stair transition: the camera must SNAP onto the landing so the player is
// revealed dead-centre, never "dropped in a random place nowhere near the
// stairs" (it smooth-follows otherwise, easing across the cross-floor gap).
const stairCheck = await gameEval(page, async () => {
  const s = window.__game.scene.getScene('GameScene');
  if (!window.__game.scene.isActive('GameScene') || !s.cameras || !s.cameras.main) {
    return { skipped: 'GameScene inactive (player died this run)' };
  }
  const cam = s.cameras.main;
  const cx = cam.width / 2, cy = cam.height / 2;

  // Find the nearest floor-0 cell with a down-stair and activate it.
  let target = null;
  for (let r = 1; r <= 8 && !target; r++) {
    for (let gx = 0; gx <= r && !target; gx++) {
      for (let gy = 0; gy <= r && !target; gy++) {
        if (s.roomStairDirection({ floor: 0, gridX: gx, gridY: gy }) === 'down') target = { gx, gy };
      }
    }
  }
  if (!target) return { skipped: 'no down-stair this seed' };
  s.ensureRoomsAround(0, target.gx, target.gy);
  const zone = s.stairZones.find(z =>
    z.getData('direction') === 'down' && z.getData('gx') === target.gx && z.getData('gy') === target.gy);
  if (!zone) return { skipped: 'down-stair not activated' };

  // Step onto the stair and let the REAL physics overlap fire onStairEnter.
  // Only assert centring once a transition ACTUALLY fires -- placing the player
  // onto a far freshly-activated zone does not always trigger the overlap, and
  // that setup miss must not masquerade as a centring failure.
  s.player.body.reset(zone.getData('glowX') + 30, zone.getData('glowY') + 30);
  const t0 = Date.now();
  let fired = false;
  while (Date.now() - t0 < 2000) {
    if (s.isTeleporting) { fired = true; break; }
    await new Promise(r => setTimeout(r, 16));
  }
  if (!fired) return { skipped: 'overlap did not fire after reset (setup miss)' };
  while (s.isTeleporting && Date.now() - t0 < 4000) await new Promise(r => setTimeout(r, 30));

  const sx = (s.player.x - cam.scrollX - cx) * cam.zoom + cx;
  const sy = (s.player.y - cam.scrollY - cy) * cam.zoom + cy;

  // Stair-landing safe zone: no enemy may stand on the spot the player lands on.
  // Drop a real enemy right next to the landing and run the actual
  // clearLandingZone -- it must be pushed out (non-vacuous: it starts inside).
  const px = s.player.x, py = s.player.y;
  const destRoom = s.level.rooms.find(r =>
    px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height);
  let safeZone = { skipped: 'no dest room' };
  if (destRoom) {
    const inRoom = s.enemyStates.filter(es =>
      es.sprite.x >= destRoom.x && es.sprite.x <= destRoom.x + destRoom.width &&
      es.sprite.y >= destRoom.y && es.sprite.y <= destRoom.y + destRoom.height);
    if (inRoom.length === 0) {
      safeZone = { skipped: 'no enemy in dest room to probe' };
    } else {
      const es = inRoom[0];
      es.sprite.body.reset(px + 30, py - 30);
      es.x = es.sprite.x; es.y = es.sprite.y;
      const beforePx = Math.round(Math.hypot(es.sprite.x - px, es.sprite.y - py));
      s.clearLandingZone(destRoom, px, py);
      const afterPx = Math.round(Math.hypot(es.sprite.x - px, es.sprite.y - py));
      safeZone = { beforePx, afterPx };
    }
  }
  return { floor: s.currentFloor, offCentrePx: Math.round(Math.hypot(sx - cx, sy - cy)), safeZone };
});
if (stairCheck.skipped) {
  log(`stair check skipped (${stairCheck.skipped})`);
} else {
  log(`stair landing: floor=${stairCheck.floor} offCentre=${stairCheck.offCentrePx}px`);
  if (stairCheck.offCentrePx > 20) {
    log(`FAIL: after a stair the player is ${stairCheck.offCentrePx}px off-centre (camera did not snap)`);
  }
  const sz = stairCheck.safeZone;
  if (sz.skipped) {
    log(`stair safe zone check skipped (${sz.skipped})`);
  } else {
    log(`stair safe zone: enemy ${sz.beforePx}px -> ${sz.afterPx}px from landing`);
    if (sz.beforePx >= 150) log('FAIL: safe-zone probe enemy did not start near the landing (guard is vacuous)');
    if (sz.afterPx < 150) log(`FAIL: clearLandingZone left an enemy ${sz.afterPx}px from the landing (inside the safe zone)`);
  }
}

// Rift re-entry guard: the dimensional-transition effect must fire ONCE per real
// crossing through the rift opening and must NOT replay when the player loops
// through a room north/south of the store (which shares the store's east-edge X)
// and then re-enters the rift's horizontal band. Drives the REAL state machine.
const riftCheck = await gameEval(page, () => {
  const s = window.__game.scene.getScene('GameScene');
  if (!s.riftRect || !s.entranceRoom) return { skipped: 'no rift this run' };
  const room = s.entranceRoom;
  const edge = room.x + room.width;
  const riftY = s.riftRect.y + s.riftRect.height / 2;

  const saved = { floor: s.currentFloor, x: s.player.x, y: s.player.y, crossed: s.riftCrossed };
  let flashes = 0;
  const realFlash = s.cameras.main.flash.bind(s.cameras.main);
  s.cameras.main.flash = (...a) => { flashes++; return realFlash(...a); };
  const drive = (x, y) => { s.player.x = x; s.player.y = y; s.updateRiftCrossing(); };

  s.currentFloor = 0;
  s.riftCrossed = false;
  drive(room.x + 100, riftY);   // inside the store, not yet crossed
  drive(edge + 10, riftY);      // genuine crossing -> flash #1
  const afterCross = flashes;

  // Loop to room (0,-1): west of the east edge but NORTH of the store (NOT the
  // store). This must not re-arm the one-shot.
  drive(edge - 100, room.y - 300);
  const rearmedSpuriously = s.riftCrossed === false;
  drive(edge + 10, riftY);      // re-enter the band east -> must NOT flash again
  const afterReentry = flashes;

  // Non-vacuous control: a genuine return into the store re-arms, and re-crossing
  // DOES replay -- proving the guard isn't passing by simply never firing.
  drive(room.x + 100, riftY);
  drive(edge + 10, riftY);
  const afterRealReentry = flashes;

  s.cameras.main.flash = realFlash;
  s.currentFloor = saved.floor; s.player.x = saved.x; s.player.y = saved.y; s.riftCrossed = saved.crossed;
  return { afterCross, afterReentry, afterRealReentry, rearmedSpuriously };
});
if (riftCheck.skipped) {
  log(`rift re-entry check skipped (${riftCheck.skipped})`);
} else {
  log(`rift re-entry: afterCross=${riftCheck.afterCross} afterReentry=${riftCheck.afterReentry} afterRealReentry=${riftCheck.afterRealReentry}`);
  if (riftCheck.afterReentry !== riftCheck.afterCross || riftCheck.rearmedSpuriously) {
    log('FAIL: the rift transition replayed after looping through a column-0 neighbor (spurious re-arm)');
  }
  if (riftCheck.afterRealReentry <= riftCheck.afterReentry) {
    log('FAIL: a genuine return-to-store + re-cross did NOT replay the transition (guard is vacuous)');
  }
}

// Rechargeable Battery upgrade: with the upgrade owned, the flashlight battery
// must RECHARGE while the light is OFF and still DRAIN while ON. Drives the REAL
// per-frame update loop (window.__game ticks update() every frame), so this guards
// the actual GameScene wiring (init flag -> rate passed to updateBatteryWithFlashlight),
// not just the pure function. Non-vacuous: a control with the upgrade NOT owned must
// NOT recharge while off.
const rechargeCheck = await gameEval(page, async () => {
  const s = window.__game.scene.getScene('GameScene');
  if (!s || !s.batteryState) return { skipped: 'no game scene' };
  const frac = () => s.batteryState.charge / s.batteryState.maxCharge;
  const settle = (ms) => new Promise(r => setTimeout(r, ms));
  const drainToHalf = () => { s.batteryState = { ...s.batteryState, charge: s.batteryState.maxCharge * 0.5, isDepleted: false }; };

  s.player.body.stop();

  // OFF + upgrade owned -> recharges.
  s.hasRechargeBattery = true;
  drainToHalf();
  s.flashlightState = { on: false, hiding: false };
  const offStart = frac();
  await settle(2000);
  const offEnd = frac();

  // ON + upgrade owned -> still drains.
  drainToHalf();
  s.flashlightState = { on: true, hiding: false };
  const onStart = frac();
  await settle(2000);
  const onEnd = frac();

  // OFF + upgrade NOT owned -> does NOT recharge (gate proof).
  s.hasRechargeBattery = false;
  drainToHalf();
  s.flashlightState = { on: false, hiding: false };
  const gateStart = frac();
  await settle(2000);
  const gateEnd = frac();

  return { offStart, offEnd, onStart, onEnd, gateStart, gateEnd };
});
if (rechargeCheck.skipped) {
  log(`rechargeable battery check skipped (${rechargeCheck.skipped})`);
} else {
  const off = rechargeCheck.offEnd - rechargeCheck.offStart;
  const on = rechargeCheck.onEnd - rechargeCheck.onStart;
  const gate = rechargeCheck.gateEnd - rechargeCheck.gateStart;
  log(`rechargeable battery: off +${off.toFixed(4)} on ${on.toFixed(4)} gate ${gate.toFixed(4)}`);
  if (off <= 0) log('FAIL: battery did not recharge while the flashlight was off (upgrade owned)');
  if (on >= 0) log('FAIL: battery did not drain while the flashlight was on');
  if (gate > 0.0001) log('FAIL: battery recharged while off WITHOUT the upgrade (gate broken)');
}

// Spec Known bug: "being shot makes the player fully disappear." The old damage
// feedback was a FULL-OPACITY camera flash (cameras.main.flash(_, 255,0,0)) that
// overlaid the whole view in solid red, erasing the player. The fix replaces it
// with a capped-alpha red tint (depth below the player). Drive the REAL damage
// handler and assert: the hit lands, the capped damage tint fires, NO full-screen
// camera flash runs, and the player sprite stays visible. Non-vacuous: hpDropped
// proves a real hit occurred.
const shotCheck = await gameEval(page, () => {
  const s = window.__game.scene.getScene('GameScene');
  if (!s || !s.player) return { skipped: 'no game scene' };
  const hpBefore = s.combatState.hp;
  s.combatState.damageCooldown = 0;
  s.onEnemyBulletHitPlayer({ setActive() {}, setVisible() {}, body: { stop() {} } });
  const fx = s.cameras.main.flashEffect;
  return {
    hpDropped: s.combatState.hp < hpBefore,
    damageTintActive: s.damageFlashRemaining > 0,
    cameraFlashRunning: fx ? fx.isRunning : false,
    playerVisible: s.player.visible && s.player.alpha >= 0.85,
  };
});
if (shotCheck.skipped) {
  log(`damage-flash check skipped (${shotCheck.skipped})`);
} else {
  log(`damage flash: hpDropped=${shotCheck.hpDropped} tint=${shotCheck.damageTintActive} cameraFlash=${shotCheck.cameraFlashRunning} playerVisible=${shotCheck.playerVisible}`);
  if (!shotCheck.hpDropped) log('FAIL: the shot did not damage the player (guard is vacuous)');
  if (!shotCheck.damageTintActive) log('FAIL: being shot did not trigger the damage tint');
  if (shotCheck.cameraFlashRunning) log('FAIL: being shot still triggers a full-screen camera flash (player disappears)');
  if (!shotCheck.playerVisible) log('FAIL: the player is not visible after being shot');
}

await browser.close();
log('done');
