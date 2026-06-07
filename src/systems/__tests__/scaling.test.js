import { describe, it, expect } from 'vitest';
import { getEnemyHP, getEnemyCount, getEnemyChaseSpeed, getEnemyDamage } from '../scaling.js';

describe('getEnemyHP', () => {
  it('returns base HP at run 0', () => {
    expect(getEnemyHP(50, 0)).toBe(50);
  });

  it('increases HP with run count', () => {
    const hp4 = getEnemyHP(50, 4);
    expect(hp4).toBeGreaterThan(50);
    expect(hp4).toBe(100);
  });

  it('caps HP at 3x base', () => {
    const hp20 = getEnemyHP(50, 20);
    expect(hp20).toBeLessThanOrEqual(150);
  });

  it('works with different base HP values', () => {
    expect(getEnemyHP(100, 0)).toBe(100);
    expect(getEnemyHP(100, 4)).toBe(200);
  });
});

describe('getEnemyCount', () => {
  it('returns base range at run 0', () => {
    const extra = getEnemyCount(0);
    expect(extra).toBe(0);
  });

  it('adds extra enemies at higher runs', () => {
    const extra4 = getEnemyCount(4);
    expect(extra4).toBeGreaterThan(0);
  });

  it('caps extra enemies at 3', () => {
    const extra20 = getEnemyCount(20);
    expect(extra20).toBe(3);
  });

  it('scales at expected rate', () => {
    expect(getEnemyCount(0)).toBe(0);
    expect(getEnemyCount(1)).toBe(0);
    expect(getEnemyCount(2)).toBe(1);
    expect(getEnemyCount(3)).toBe(1);
    expect(getEnemyCount(4)).toBe(2);
    expect(getEnemyCount(6)).toBe(3);
  });
});

describe('getEnemyChaseSpeed', () => {
  it('returns base speed at run 0', () => {
    expect(getEnemyChaseSpeed(80, 0)).toBe(80);
  });

  it('increases speed with run count', () => {
    expect(getEnemyChaseSpeed(80, 3)).toBeGreaterThan(80);
  });

  it('caps at 30% increase', () => {
    const speed6 = getEnemyChaseSpeed(80, 6);
    const speed20 = getEnemyChaseSpeed(80, 20);
    expect(speed6).toBeCloseTo(104);
    expect(speed20).toBe(speed6);
  });
});

describe('getEnemyDamage', () => {
  it('returns base damage at run 0', () => {
    expect(getEnemyDamage(20, 0)).toBe(20);
  });

  it('increases damage with run count', () => {
    expect(getEnemyDamage(20, 2)).toBe(30);
  });

  it('caps at base + 20', () => {
    const dmg4 = getEnemyDamage(20, 4);
    const dmg20 = getEnemyDamage(20, 20);
    expect(dmg4).toBe(40);
    expect(dmg20).toBe(40);
  });
});
