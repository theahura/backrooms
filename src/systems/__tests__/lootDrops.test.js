import { describe, it, expect } from 'vitest';
import { getDropChance, getDistanceBonus, rollEnemyDrop } from '../lootDrops.js';


describe('getDropChance', () => {
  it('returns distinct probabilities for each enemy type', () => {
    const basic = getDropChance('basic');
    const crawler = getDropChance('crawler');
    const spitter = getDropChance('spitter');

    expect(basic).toBeGreaterThan(0);
    expect(basic).toBeLessThan(1);
    expect(crawler).toBeGreaterThan(basic);
    expect(spitter).toBeGreaterThan(crawler);
  });

  it('returns basic rate for unknown enemy types', () => {
    expect(getDropChance('unknown')).toBe(getDropChance('basic'));
  });
});

describe('getDistanceBonus', () => {
  it('returns increasing bonus for harder enemy types', () => {
    const basic = getDistanceBonus('basic');
    const crawler = getDistanceBonus('crawler');
    const spitter = getDistanceBonus('spitter');

    expect(basic).toBe(0);
    expect(crawler).toBeGreaterThan(basic);
    expect(spitter).toBeGreaterThan(crawler);
  });

  it('returns 0 for unknown enemy types', () => {
    expect(getDistanceBonus('unknown')).toBe(0);
  });
});

describe('rollEnemyDrop', () => {
  it('returns null when the drop roll exceeds the drop chance', () => {
    const alwaysHigh = () => 0.99;
    const result = rollEnemyDrop('basic', 3, alwaysHigh);
    expect(result).toBeNull();
  });

  it('returns an item with a known type and matching value when the drop roll succeeds', () => {
    const knownTypes = ['battery', 'ammo', 'copper_coin', 'silver_coin', 'gold_coin', 'gem'];
    let callCount = 0;
    const deterministicRand = () => {
      callCount++;
      return callCount === 1 ? 0.01 : 0.5;
    };
    const result = rollEnemyDrop('basic', 3, deterministicRand);
    expect(result).not.toBeNull();
    expect(knownTypes).toContain(result.type);
    expect(result.value).toBeGreaterThanOrEqual(0);
  });

  it('never drops medkits regardless of enemy type or distance', () => {
    const types = ['basic', 'crawler', 'spitter'];
    const distances = [0, 1, 3, 5, 7];
    let dropCount = 0;

    for (const type of types) {
      for (const dist of distances) {
        for (let i = 0; i < 200; i++) {
          let callCount = 0;
          const rand = () => {
            callCount++;
            return callCount === 1 ? 0.001 : Math.random();
          };
          const drop = rollEnemyDrop(type, dist, rand);
          if (drop) {
            expect(drop.type).not.toBe('medkit');
            dropCount++;
          }
        }
      }
    }
    expect(dropCount).toBeGreaterThan(0);
  });

  it('produces copper-heavy drops at distance 0', () => {
    const typeCounts = {};
    for (let i = 0; i < 1000; i++) {
      let callCount = 0;
      const rand = () => {
        callCount++;
        return callCount === 1 ? 0.001 : Math.random();
      };
      const drop = rollEnemyDrop('basic', 0, rand);
      if (drop) {
        typeCounts[drop.type] = (typeCounts[drop.type] || 0) + 1;
      }
    }
    const copperCount = typeCounts['copper_coin'] || 0;
    const totalDrops = Object.values(typeCounts).reduce((a, b) => a + b, 0);
    expect(copperCount / totalDrops).toBeGreaterThan(0.2);
  });

  it('produces higher-tier drops at greater distances', () => {
    const countHighTier = (dist) => {
      let count = 0;
      for (let i = 0; i < 1000; i++) {
        let callCount = 0;
        const rand = () => {
          callCount++;
          return callCount === 1 ? 0.001 : Math.random();
        };
        const drop = rollEnemyDrop('basic', dist, rand);
        if (drop && ['silver_coin', 'gold_coin', 'gem'].includes(drop.type)) {
          count++;
        }
      }
      return count;
    };

    const highTierAtZero = countHighTier(0);
    const highTierAtSix = countHighTier(6);
    expect(highTierAtSix).toBeGreaterThan(highTierAtZero);
  });

  it('applies enemy type distance bonus to loot quality', () => {
    const countHighTier = (enemyType) => {
      let count = 0;
      for (let i = 0; i < 1000; i++) {
        let callCount = 0;
        const rand = () => {
          callCount++;
          return callCount === 1 ? 0.001 : Math.random();
        };
        const drop = rollEnemyDrop(enemyType, 3, rand);
        if (drop && ['silver_coin', 'gold_coin', 'gem'].includes(drop.type)) {
          count++;
        }
      }
      return count;
    };

    const basicHighTier = countHighTier('basic');
    const spitterHighTier = countHighTier('spitter');
    expect(spitterHighTier).toBeGreaterThan(basicHighTier);
  });

  it('returns correct value for each item type', () => {
    const expectedValues = {
      battery: 0, ammo: 0, copper_coin: 10,
      silver_coin: 50, gold_coin: 200, gem: 1000,
    };
    const foundTypes = new Set();

    for (let i = 0; i < 5000; i++) {
      let callCount = 0;
      const rand = () => {
        callCount++;
        return callCount === 1 ? 0.001 : Math.random();
      };
      const drop = rollEnemyDrop('spitter', 7, rand);
      if (drop) {
        foundTypes.add(drop.type);
        expect(drop.value).toBe(expectedValues[drop.type]);
      }
    }
    expect(foundTypes.size).toBeGreaterThan(3);
  });
});

