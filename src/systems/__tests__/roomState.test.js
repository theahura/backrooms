import { describe, it, expect } from 'vitest';
import {
  createRoomState,
  markItemConsumed,
  isItemConsumed,
  addCorpse,
  getCorpses,
  CORPSE_CAP,
  trackLamp,
  isLampOn,
  trackSwitch,
  setSwitchOn,
  isSwitchOn,
  flipLights,
  daySpawnSeed,
} from '../roomState.js';
import { generateRoomItems } from '../items.js';
import { generateRoomEnemies } from '../enemy.js';
import { mulberry32 } from '../random.js';

// generateRoomItems positional args roomX, roomY, width, height, wallThickness.
// A room large enough that placement never starves; the entrance-cell guard
// (roomId === 0 -> no items) is dodged by passing roomId 1 at each call site.
const ROOM = [0, 0, 720, 600, 20];

// The same survivor filter activateRoomItems uses in production: drop any item
// whose stable generation index has been consumed.
const survivingItems = (items, state, cellKey) =>
  items.filter((_, index) => !isItemConsumed(state, cellKey, index));

function findItemSeed(minCount) {
  for (let seed = 1; seed < 8000; seed++) {
    const items = generateRoomItems(...ROOM, seed, [], 1, 5, []);
    if (items.length >= minCount) return { seed, items };
  }
  throw new Error('no seed produced enough items');
}

describe('persistent item consumption (anti-farm)', () => {
  it('an item picked up in a room never reappears when the room is regenerated', () => {
    const { seed, items } = findItemSeed(2);
    const state = createRoomState();
    const cellKey = '0:1,1';

    markItemConsumed(state, cellKey, 1); // pick up the second generated item

    const regenerated = generateRoomItems(...ROOM, seed, [], 1, 5, []);
    const available = survivingItems(regenerated, state, cellKey);

    expect(available).toEqual([items[0], ...items.slice(2)]);
    expect(available).not.toContainEqual(items[1]);
  });

  it('leaves a room with no consumed items fully intact', () => {
    const { seed, items } = findItemSeed(1);
    const state = createRoomState();
    const regenerated = generateRoomItems(...ROOM, seed, [], 1, 5, []);
    expect(survivingItems(regenerated, state, '0:9,9')).toEqual(items);
  });
});

describe('day-varying enemy spawns vs. day-stable room content', () => {
  it("keeps a room's items identical across days while its enemies vary by day", () => {
    const roomSeed = 12345;

    const itemsDay1 = generateRoomItems(...ROOM, roomSeed, [], 1, 5, []);
    const itemsDay2 = generateRoomItems(...ROOM, roomSeed, [], 1, 5, []);
    expect(itemsDay2).toEqual(itemsDay1); // item generation takes no day -> stable

    const spawnsByDay = [];
    for (let day = 1; day <= 6; day++) {
      spawnsByDay.push(
        generateRoomEnemies(...ROOM, daySpawnSeed(roomSeed, day), [], 1, 8, [])
      );
    }

    // Reproducible for the same (room, day).
    expect(generateRoomEnemies(...ROOM, daySpawnSeed(roomSeed, 3), [], 1, 8, []))
      .toEqual(spawnsByDay[2]);

    // The spawn set genuinely varies across days, not just on one outlier day.
    const distinctSpawnSets = new Set(spawnsByDay.map(s => JSON.stringify(s)));
    expect(distinctSpawnSets.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps day-varied spawns out of caller keep-out zones', () => {
    const roomSeed = 999;
    const keepOut = [{ x: 100, y: 100, width: 200, height: 200 }];
    const radius = 10;

    for (let day = 1; day <= 12; day++) {
      const spawns = generateRoomEnemies(...ROOM, daySpawnSeed(roomSeed, day), [], 1, 8, keepOut);
      for (const s of spawns) {
        const insideX = s.x >= 100 - radius && s.x <= 300 + radius;
        const insideY = s.y >= 100 - radius && s.y <= 300 + radius;
        expect(insideX && insideY).toBe(false);
      }
    }
  });
});

describe('persistent dead bodies', () => {
  it('keeps at most CORPSE_CAP bodies per room, dropping the oldest first', () => {
    const state = createRoomState();
    const cellKey = '0:2,2';

    for (let i = 0; i < CORPSE_CAP + 3; i++) {
      addCorpse(state, cellKey, { x: i, y: 0, type: 'basic', angle: 90 });
    }

    const corpses = getCorpses(state, cellKey);
    expect(corpses.length).toBe(CORPSE_CAP);
    expect(corpses[0].x).toBe(3); // x=0,1,2 (oldest) were dropped
    expect(corpses[corpses.length - 1].x).toBe(CORPSE_CAP + 2);
  });

  it('reports no bodies for a room nothing has died in', () => {
    expect(getCorpses(createRoomState(), '0:5,5')).toEqual([]);
  });
});

describe('lights flip between days (bidirectional)', () => {
  it('turns roughly 20% of lit ceiling lamps off', () => {
    const state = createRoomState();
    const N = 2000;
    for (let i = 0; i < N; i++) trackLamp(state, `0:${i},0`); // all start on

    flipLights(state, mulberry32(1), 0.2, 0.2);

    let off = 0;
    for (let i = 0; i < N; i++) if (!isLampOn(state, `0:${i},0`)) off++;
    expect(off / N).toBeGreaterThan(0.15);
    expect(off / N).toBeLessThan(0.25);
  });

  it('lets a dark lamp come back on a later day', () => {
    const state = createRoomState();
    const N = 2000;
    for (let i = 0; i < N; i++) trackLamp(state, `0:${i},0`);

    flipLights(state, mulberry32(1), 0.2, 0.2);
    const wentDark = [];
    for (let i = 0; i < N; i++) {
      const k = `0:${i},0`;
      if (!isLampOn(state, k)) wentDark.push(k);
    }
    expect(wentDark.length).toBeGreaterThan(0);

    flipLights(state, mulberry32(2), 0.2, 0.2);
    const cameBack = wentDark.filter(k => isLampOn(state, k)).length;
    expect(cameBack).toBeGreaterThan(0);
  });

  it('flips a manually-lit switch dark and re-lights a dark switch', () => {
    const state = createRoomState();
    for (let i = 0; i < 1000; i++) {
      const k = `0:${i},0`;
      trackSwitch(state, k);
      if (i % 2 === 0) setSwitchOn(state, k, true); // half on, half off
    }

    flipLights(state, mulberry32(7), 0.2, 0.2);

    let onWentOff = 0;
    let offCameOn = 0;
    for (let i = 0; i < 1000; i++) {
      const on = isSwitchOn(state, `0:${i},0`);
      if (i % 2 === 0 && !on) onWentOff++;
      if (i % 2 === 1 && on) offCameOn++;
    }
    expect(onWentOff).toBeGreaterThan(0);
    expect(offCameOn).toBeGreaterThan(0);
  });

  it('is deterministic for the same cell order and rng seed', () => {
    const build = () => {
      const s = createRoomState();
      for (let i = 0; i < 50; i++) trackLamp(s, `0:${i},0`);
      return s;
    };

    const a = build();
    flipLights(a, mulberry32(42));
    const b = build();
    flipLights(b, mulberry32(42));

    const lampsOf = (s) => Array.from({ length: 50 }, (_, i) => isLampOn(s, `0:${i},0`));
    expect(lampsOf(b)).toEqual(lampsOf(a));
  });
});
