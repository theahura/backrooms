import { describe, it, expect } from 'vitest';
import { getEnemyHP, getEnemyCount, getEnemyDamage, SAFE_DISTANCE } from '../scaling.js';

describe('getEnemyHP', () => {
  it('returns base HP within the safe band near the entrance', () => {
    expect(getEnemyHP(50, 0)).toBe(50);
    expect(getEnemyHP(50, 1)).toBe(50);
    expect(getEnemyHP(50, SAFE_DISTANCE)).toBe(50);
  });

  it('increases HP with distance from the start', () => {
    expect(getEnemyHP(50, 7)).toBe(75);
    expect(getEnemyHP(50, 12)).toBe(100);
  });

  it('caps HP at 2.5x base in the deepest rooms', () => {
    expect(getEnemyHP(50, 100)).toBe(125);
    expect(getEnemyHP(50, 17)).toBe(getEnemyHP(50, 100));
  });

  it('works with different base HP values', () => {
    expect(getEnemyHP(30, 1)).toBe(30);
    expect(getEnemyHP(40, 7)).toBe(60);
    expect(getEnemyHP(30, 100)).toBe(75);
  });
});

describe('getEnemyCount', () => {
  it('adds no extra enemies near the entrance', () => {
    expect(getEnemyCount(0)).toBe(0);
    expect(getEnemyCount(1)).toBe(0);
    expect(getEnemyCount(6)).toBe(0);
  });

  it('adds extra enemies as distance grows', () => {
    expect(getEnemyCount(7)).toBe(1);
    expect(getEnemyCount(11)).toBe(2);
  });

  it('caps extra enemies at 3', () => {
    expect(getEnemyCount(15)).toBe(3);
    expect(getEnemyCount(100)).toBe(3);
  });
});

describe('getEnemyDamage', () => {
  it('returns base damage within the safe band near the entrance', () => {
    expect(getEnemyDamage(20, 0)).toBe(20);
    expect(getEnemyDamage(20, SAFE_DISTANCE)).toBe(20);
  });

  it('increases damage in steps as distance grows', () => {
    expect(getEnemyDamage(20, 5)).toBe(20);
    expect(getEnemyDamage(20, 6)).toBe(25);
    expect(getEnemyDamage(20, 10)).toBe(30);
  });

  it('caps at base + 20', () => {
    expect(getEnemyDamage(20, 18)).toBe(40);
    expect(getEnemyDamage(20, 100)).toBe(40);
  });
});
