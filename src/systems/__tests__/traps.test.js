import { describe, it, expect } from 'vitest';
import { generateRoomTraps } from '../traps.js';

describe('generateRoomTraps', () => {
  const baseRoom = {
    x: 0, y: 0, width: 1200, height: 1000, wallThickness: 20,
  };
  const noFurniture = [];

  it('returns no traps for room 0 (starting room)', () => {
    const traps = generateRoomTraps(
      baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
      baseRoom.wallThickness, 12345, noFurniture, 0, 5
    );
    expect(traps).toEqual([]);
  });

  it('returns no traps when distance is less than 2', () => {
    const results = [];
    for (let seed = 0; seed < 200; seed++) {
      const traps = generateRoomTraps(
        baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
        baseRoom.wallThickness, seed, noFurniture, 1, 0
      );
      results.push(...traps);
    }
    expect(results).toHaveLength(0);

    const results1 = [];
    for (let seed = 0; seed < 200; seed++) {
      const traps = generateRoomTraps(
        baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
        baseRoom.wallThickness, seed, noFurniture, 1, 1
      );
      results1.push(...traps);
    }
    expect(results1).toHaveLength(0);
  });

  it('can produce spike traps at distance >= 2', () => {
    const spikeTraps = [];
    for (let seed = 0; seed < 500; seed++) {
      const traps = generateRoomTraps(
        baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
        baseRoom.wallThickness, seed, noFurniture, 1, 2
      );
      spikeTraps.push(...traps.filter(t => t.type === 'spike'));
    }
    expect(spikeTraps.length).toBeGreaterThan(0);
  });

  it('does not produce noise traps at distance < 3', () => {
    const noiseTraps = [];
    for (let seed = 0; seed < 500; seed++) {
      const traps = generateRoomTraps(
        baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
        baseRoom.wallThickness, seed, noFurniture, 1, 2
      );
      noiseTraps.push(...traps.filter(t => t.type === 'noise'));
    }
    expect(noiseTraps).toHaveLength(0);
  });

  it('can produce noise traps at distance >= 3', () => {
    const noiseTraps = [];
    for (let seed = 0; seed < 500; seed++) {
      const traps = generateRoomTraps(
        baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
        baseRoom.wallThickness, seed, noFurniture, 1, 3
      );
      noiseTraps.push(...traps.filter(t => t.type === 'noise'));
    }
    expect(noiseTraps.length).toBeGreaterThan(0);
  });

  it('places traps within room bounds (respecting wall thickness and margin)', () => {
    const margin = 40;
    const wt = baseRoom.wallThickness;
    const minX = baseRoom.x + wt + margin;
    const minY = baseRoom.y + wt + margin;
    const maxX = baseRoom.x + baseRoom.width - wt - margin;
    const maxY = baseRoom.y + baseRoom.height - wt - margin;

    for (let seed = 0; seed < 300; seed++) {
      const traps = generateRoomTraps(
        baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
        baseRoom.wallThickness, seed, noFurniture, 1, 4
      );
      for (const trap of traps) {
        expect(trap.x).toBeGreaterThanOrEqual(minX);
        expect(trap.x).toBeLessThanOrEqual(maxX);
        expect(trap.y).toBeGreaterThanOrEqual(minY);
        expect(trap.y).toBeLessThanOrEqual(maxY);
      }
    }
  });

  it('does not place traps overlapping furniture', () => {
    const bigFurniture = [
      { x: 200, y: 200, width: 800, height: 600 },
    ];
    for (let seed = 0; seed < 200; seed++) {
      const traps = generateRoomTraps(
        baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
        baseRoom.wallThickness, seed, bigFurniture, 1, 4
      );
      for (const trap of traps) {
        const overlaps =
          trap.x >= bigFurniture[0].x - 10 &&
          trap.x <= bigFurniture[0].x + bigFurniture[0].width + 10 &&
          trap.y >= bigFurniture[0].y - 10 &&
          trap.y <= bigFurniture[0].y + bigFurniture[0].height + 10;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('produces deterministic results for the same seed', () => {
    const traps1 = generateRoomTraps(
      baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
      baseRoom.wallThickness, 99999, noFurniture, 1, 5
    );
    const traps2 = generateRoomTraps(
      baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
      baseRoom.wallThickness, 99999, noFurniture, 1, 5
    );
    expect(traps1).toEqual(traps2);
  });

  it('produces different results for different seeds', () => {
    const allTraps = [];
    for (let seed = 0; seed < 100; seed++) {
      allTraps.push(generateRoomTraps(
        baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
        baseRoom.wallThickness, seed, noFurniture, 1, 5
      ));
    }
    const nonEmpty = allTraps.filter(t => t.length > 0);
    expect(nonEmpty.length).toBeGreaterThan(0);
    const positions = nonEmpty.map(t => `${t[0].x},${t[0].y}`);
    const unique = new Set(positions);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('places at most 1 trap per room', () => {
    for (let seed = 0; seed < 500; seed++) {
      const traps = generateRoomTraps(
        baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
        baseRoom.wallThickness, seed, noFurniture, 1, 5
      );
      expect(traps.length).toBeLessThanOrEqual(1);
    }
  });

  it('spike traps report positive damage values', () => {
    const spikeTraps = [];
    for (let seed = 0; seed < 500; seed++) {
      spikeTraps.push(...generateRoomTraps(
        baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
        baseRoom.wallThickness, seed, noFurniture, 1, 4
      ).filter(t => t.type === 'spike'));
    }
    expect(spikeTraps.length).toBeGreaterThan(0);
    for (const trap of spikeTraps) {
      expect(trap.damage).toBeGreaterThan(0);
    }
  });

  it('noise traps report zero damage', () => {
    const noiseTraps = [];
    for (let seed = 0; seed < 500; seed++) {
      noiseTraps.push(...generateRoomTraps(
        baseRoom.x, baseRoom.y, baseRoom.width, baseRoom.height,
        baseRoom.wallThickness, seed, noFurniture, 1, 5
      ).filter(t => t.type === 'noise'));
    }
    expect(noiseTraps.length).toBeGreaterThan(0);
    for (const trap of noiseTraps) {
      expect(trap.damage).toBe(0);
    }
  });
});
