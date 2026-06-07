import { describe, it, expect } from 'vitest';
import { calculateVelocity } from '../movement.js';

describe('calculateVelocity', () => {
  const SPEED = 200;

  it('returns zero velocity when no keys are pressed', () => {
    const velocity = calculateVelocity({ up: false, down: false, left: false, right: false }, SPEED);
    expect(velocity.x).toBe(0);
    expect(velocity.y).toBe(0);
  });

  it('moves up when W/up key is pressed', () => {
    const velocity = calculateVelocity({ up: true, down: false, left: false, right: false }, SPEED);
    expect(velocity.x).toBe(0);
    expect(velocity.y).toBe(-SPEED);
  });

  it('moves down when S/down key is pressed', () => {
    const velocity = calculateVelocity({ up: false, down: true, left: false, right: false }, SPEED);
    expect(velocity.x).toBe(0);
    expect(velocity.y).toBe(SPEED);
  });

  it('moves left when A/left key is pressed', () => {
    const velocity = calculateVelocity({ up: false, down: false, left: true, right: false }, SPEED);
    expect(velocity.x).toBe(-SPEED);
    expect(velocity.y).toBe(0);
  });

  it('moves right when D/right key is pressed', () => {
    const velocity = calculateVelocity({ up: false, down: false, left: false, right: true }, SPEED);
    expect(velocity.x).toBe(SPEED);
    expect(velocity.y).toBe(0);
  });

  it('normalizes diagonal movement to the same speed as cardinal', () => {
    const velocity = calculateVelocity({ up: true, down: false, left: true, right: false }, SPEED);
    const magnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
    expect(magnitude).toBeCloseTo(SPEED, 5);
  });

  it('cancels out opposing directions', () => {
    const velocity = calculateVelocity({ up: true, down: true, left: false, right: false }, SPEED);
    expect(velocity.x).toBe(0);
    expect(velocity.y).toBe(0);
  });
});
