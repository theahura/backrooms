import { describe, it, expect } from 'vitest';
import {
  calculateBulletVelocity,
  canFire,
  updateFireCooldown,
  isBulletExpired,
} from '../shooting.js';

describe('calculateBulletVelocity', () => {
  it('velocity magnitude equals the given speed', () => {
    const { vx, vy } = calculateBulletVelocity(10, 20, 50, 80, 500);
    const magnitude = Math.sqrt(vx * vx + vy * vy);
    expect(magnitude).toBeCloseTo(500, 1);
  });

  it('handles firing straight right', () => {
    const { vx, vy } = calculateBulletVelocity(0, 0, 100, 0, 400);
    expect(vx).toBeCloseTo(400, 1);
    expect(vy).toBeCloseTo(0, 1);
  });

  it('handles firing straight down', () => {
    const { vx, vy } = calculateBulletVelocity(0, 0, 0, 100, 400);
    expect(vx).toBeCloseTo(0, 1);
    expect(vy).toBeCloseTo(400, 1);
  });

  it('handles diagonal firing', () => {
    const { vx, vy } = calculateBulletVelocity(0, 0, 100, 100, 400);
    expect(vx).toBeCloseTo(vy, 1);
    const magnitude = Math.sqrt(vx * vx + vy * vy);
    expect(magnitude).toBeCloseTo(400, 1);
  });

  it('returns zero velocity when origin equals target', () => {
    const { vx, vy } = calculateBulletVelocity(5, 5, 5, 5, 500);
    expect(vx).toBe(0);
    expect(vy).toBe(0);
  });
});

describe('canFire', () => {
  it('returns true when cooldown is 0', () => {
    expect(canFire(0)).toBe(true);
  });

  it('returns false when cooldown is positive', () => {
    expect(canFire(100)).toBe(false);
  });
});

describe('updateFireCooldown', () => {
  it('decrements cooldown by delta', () => {
    expect(updateFireCooldown(200, 50)).toBe(150);
  });

  it('does not go below 0', () => {
    expect(updateFireCooldown(30, 50)).toBe(0);
  });
});

describe('isBulletExpired', () => {
  it('returns true when bullet has traveled beyond max range', () => {
    expect(isBulletExpired(0, 0, 700, 0, 600)).toBe(true);
  });

  it('returns false when bullet is within range', () => {
    expect(isBulletExpired(0, 0, 100, 0, 600)).toBe(false);
  });

  it('returns false when bullet is exactly at max range', () => {
    expect(isBulletExpired(0, 0, 600, 0, 600)).toBe(false);
  });
});
