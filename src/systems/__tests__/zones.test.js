import { describe, it, expect } from 'vitest';
import { getZoneAt, isZoneBoundary, ZONE_IDS } from '../zones.js';

const SEED = 0x1234abcd;

const WALL_DELTA = {
  east: [1, 0],
  west: [-1, 0],
  north: [0, -1],
  south: [0, 1],
};

describe('getZoneAt', () => {
  it('is deterministic for the same cell', () => {
    for (let gx = -10; gx <= 10; gx++) {
      for (let gy = -10; gy <= 10; gy++) {
        expect(getZoneAt(SEED, gx, gy)).toBe(getZoneAt(SEED, gx, gy));
      }
    }
  });

  it('assigns every backrooms cell a known zone id', () => {
    for (let gx = -8; gx <= 8; gx++) {
      for (let gy = -8; gy <= 8; gy++) {
        if (gx === 0 && gy === 0) continue;
        expect(ZONE_IDS).toContain(getZoneAt(SEED, gx, gy));
      }
    }
  });

  it('gives the store cell its own dedicated zone, not shared with backrooms', () => {
    expect(getZoneAt(SEED, 0, 0)).toBe('store');
    expect(ZONE_IDS).not.toContain('store');
  });

  it('groups rooms into contiguous multi-room zones rather than per-cell noise', () => {
    // Average horizontal run of identical-zone cells must clearly exceed the
    // ~1.25 you'd get from independent per-cell assignment over this many zones.
    let runs = 0;
    let cells = 0;
    for (let gy = -15; gy <= 15; gy++) {
      let prev = null;
      for (let gx = -30; gx <= 30; gx++) {
        const z = getZoneAt(SEED, gx, gy);
        cells++;
        if (z !== prev) runs++;
        prev = z;
      }
    }
    const avgRun = cells / runs;
    expect(avgRun).toBeGreaterThan(2);
  });

  it('a zone reachable from a cell spans more than one room', () => {
    // Flood-fill the zone containing an arbitrary backrooms cell; a contiguous
    // theme must cover several rooms (so a "mall" really is multiple rooms).
    const start = [2, 2];
    const zone = getZoneAt(SEED, start[0], start[1]);
    const seen = new Set([`${start[0]},${start[1]}`]);
    const stack = [start];
    while (stack.length) {
      const [gx, gy] = stack.pop();
      for (const [dx, dy] of Object.values(WALL_DELTA)) {
        const nx = gx + dx;
        const ny = gy + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        if (nx === 0 && ny === 0) continue;
        if (getZoneAt(SEED, nx, ny) === zone) {
          seen.add(key);
          stack.push([nx, ny]);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('produces a different partition for a different seed', () => {
    let differences = 0;
    let cells = 0;
    for (let gx = -10; gx <= 10; gx++) {
      for (let gy = -10; gy <= 10; gy++) {
        cells++;
        if (getZoneAt(SEED, gx, gy) !== getZoneAt(SEED + 1, gx, gy)) differences++;
      }
    }
    // A meaningfully different map, not just a cell or two: at least a tenth of
    // cells land in a different zone under a different seed.
    expect(differences).toBeGreaterThan(cells * 0.1);
  });
});

describe('isZoneBoundary', () => {
  it('is true exactly when the neighbor across the wall is a different zone', () => {
    for (let gx = -6; gx <= 6; gx++) {
      for (let gy = -6; gy <= 6; gy++) {
        if (gx === 0 && gy === 0) continue;
        for (const [wall, [dx, dy]] of Object.entries(WALL_DELTA)) {
          const sameZone = getZoneAt(SEED, gx, gy) === getZoneAt(SEED, gx + dx, gy + dy);
          expect(isZoneBoundary(SEED, gx, gy, wall)).toBe(!sameZone);
        }
      }
    }
  });

  it('agrees from both sides of a shared wall', () => {
    for (let gx = -6; gx <= 6; gx++) {
      for (let gy = -6; gy <= 6; gy++) {
        // east of (gx,gy) is the same physical wall as west of (gx+1,gy)
        expect(isZoneBoundary(SEED, gx, gy, 'east')).toBe(isZoneBoundary(SEED, gx + 1, gy, 'west'));
        // south of (gx,gy) is the same physical wall as north of (gx,gy+1)
        expect(isZoneBoundary(SEED, gx, gy, 'south')).toBe(isZoneBoundary(SEED, gx, gy + 1, 'north'));
      }
    }
  });
});
