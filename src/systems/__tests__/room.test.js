import { describe, it, expect } from 'vitest';
import { createRoomWalls } from '../room.js';

describe('createRoomWalls', () => {
  it('wall segments form a closed boundary', () => {
    const walls = createRoomWalls(0, 0, 100, 80);

    for (let i = 0; i < walls.length; i++) {
      const current = walls[i];
      const next = walls[(i + 1) % walls.length];
      expect(current.x2).toBeCloseTo(next.x1, 5);
      expect(current.y2).toBeCloseTo(next.y1, 5);
    }
  });

  it('wall segments match the specified dimensions', () => {
    const walls = createRoomWalls(10, 20, 200, 150);

    const allX = walls.flatMap(w => [w.x1, w.x2]);
    const allY = walls.flatMap(w => [w.y1, w.y2]);
    expect(Math.min(...allX)).toBe(10);
    expect(Math.max(...allX)).toBe(210);
    expect(Math.min(...allY)).toBe(20);
    expect(Math.max(...allY)).toBe(170);
  });
});
