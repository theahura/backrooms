import { describe, it, expect } from 'vitest';
import { raySegmentIntersection, getVisibilityPolygon, getFlashlightPolygon } from '../visibility.js';

describe('raySegmentIntersection', () => {
  it('returns the intersection point when a ray hits a segment', () => {
    const ray = { x: 0, y: 0, dx: 1, dy: 0 };
    const segment = { x1: 5, y1: -5, x2: 5, y2: 5 };
    const hit = raySegmentIntersection(ray, segment);
    expect(hit).not.toBeNull();
    expect(hit.x).toBeCloseTo(5, 5);
    expect(hit.y).toBeCloseTo(0, 5);
  });

  it('returns null when the ray misses the segment', () => {
    const ray = { x: 0, y: 0, dx: 1, dy: 0 };
    const segment = { x1: 5, y1: 10, x2: 5, y2: 20 };
    const hit = raySegmentIntersection(ray, segment);
    expect(hit).toBeNull();
  });

  it('returns null when the segment is behind the ray', () => {
    const ray = { x: 0, y: 0, dx: 1, dy: 0 };
    const segment = { x1: -5, y1: -5, x2: -5, y2: 5 };
    const hit = raySegmentIntersection(ray, segment);
    expect(hit).toBeNull();
  });

  it('returns null for parallel ray and segment', () => {
    const ray = { x: 0, y: 0, dx: 1, dy: 0 };
    const segment = { x1: 0, y1: 0, x2: 10, y2: 0 };
    const hit = raySegmentIntersection(ray, segment);
    expect(hit).toBeNull();
  });

});

describe('getVisibilityPolygon', () => {
  it('computes a polygon matching the interior of a simple box room', () => {
    const segments = [
      { x1: 0, y1: 0, x2: 100, y2: 0 },
      { x1: 100, y1: 0, x2: 100, y2: 100 },
      { x1: 100, y1: 100, x2: 0, y2: 100 },
      { x1: 0, y1: 100, x2: 0, y2: 0 },
    ];
    const origin = { x: 50, y: 50 };
    const polygon = getVisibilityPolygon(origin, segments);

    expect(polygon.length).toBeGreaterThanOrEqual(4);

    for (const point of polygon) {
      expect(point.x).toBeGreaterThanOrEqual(-0.01);
      expect(point.x).toBeLessThanOrEqual(100.01);
      expect(point.y).toBeGreaterThanOrEqual(-0.01);
      expect(point.y).toBeLessThanOrEqual(100.01);
    }
  });

  it('produces a polygon that covers the entire room when player is centered', () => {
    const segments = [
      { x1: 0, y1: 0, x2: 100, y2: 0 },
      { x1: 100, y1: 0, x2: 100, y2: 100 },
      { x1: 100, y1: 100, x2: 0, y2: 100 },
      { x1: 0, y1: 100, x2: 0, y2: 0 },
    ];
    const origin = { x: 50, y: 50 };
    const polygon = getVisibilityPolygon(origin, segments);

    const hasTopLeft = polygon.some(p => p.x < 1 && p.y < 1);
    const hasTopRight = polygon.some(p => p.x > 99 && p.y < 1);
    const hasBottomLeft = polygon.some(p => p.x < 1 && p.y > 99);
    const hasBottomRight = polygon.some(p => p.x > 99 && p.y > 99);
    expect(hasTopLeft && hasTopRight && hasBottomLeft && hasBottomRight).toBe(true);
  });
});

describe('getFlashlightPolygon', () => {
  it('returns a polygon clipped to the flashlight cone', () => {
    const segments = [
      { x1: 0, y1: 0, x2: 200, y2: 0 },
      { x1: 200, y1: 0, x2: 200, y2: 200 },
      { x1: 200, y1: 200, x2: 0, y2: 200 },
      { x1: 0, y1: 200, x2: 0, y2: 0 },
    ];
    const origin = { x: 100, y: 100 };
    const angle = 0;
    const coneAngle = Math.PI / 4;
    const polygon = getFlashlightPolygon(origin, angle, coneAngle, segments);

    expect(polygon.length).toBeGreaterThanOrEqual(3);

    const allOnRightSide = polygon.every(p => {
      if (p.x === origin.x && p.y === origin.y) return true;
      const pointAngle = Math.atan2(p.y - origin.y, p.x - origin.x);
      const diff = Math.abs(pointAngle - angle);
      const normalizedDiff = Math.min(diff, 2 * Math.PI - diff);
      return normalizedDiff <= coneAngle + 0.01;
    });
    expect(allOnRightSide).toBe(true);
  });

  it('works correctly when aiming left (PI angle boundary)', () => {
    const segments = [
      { x1: 0, y1: 0, x2: 200, y2: 0 },
      { x1: 200, y1: 0, x2: 200, y2: 200 },
      { x1: 200, y1: 200, x2: 0, y2: 200 },
      { x1: 0, y1: 200, x2: 0, y2: 0 },
    ];
    const origin = { x: 100, y: 100 };
    const angle = Math.PI;
    const coneAngle = Math.PI / 4;
    const polygon = getFlashlightPolygon(origin, angle, coneAngle, segments);

    expect(polygon.length).toBeGreaterThanOrEqual(3);

    const allOnLeftSide = polygon.every(p => {
      if (Math.abs(p.x - origin.x) < 0.01 && Math.abs(p.y - origin.y) < 0.01) return true;
      const pointAngle = Math.atan2(p.y - origin.y, p.x - origin.x);
      const diff = Math.abs(pointAngle - angle);
      const normalizedDiff = Math.min(diff, 2 * Math.PI - diff);
      return normalizedDiff <= coneAngle + 0.01;
    });
    expect(allOnLeftSide).toBe(true);

    const hasLeftWallPoint = polygon.some(p => p.x < 1);
    expect(hasLeftWallPoint).toBe(true);
  });

  it('includes the origin point', () => {
    const segments = [
      { x1: 0, y1: 0, x2: 200, y2: 0 },
      { x1: 200, y1: 0, x2: 200, y2: 200 },
      { x1: 200, y1: 200, x2: 0, y2: 200 },
      { x1: 0, y1: 200, x2: 0, y2: 0 },
    ];
    const origin = { x: 100, y: 100 };
    const polygon = getFlashlightPolygon(origin, 0, Math.PI / 4, segments);

    const hasOrigin = polygon.some(p =>
      Math.abs(p.x - origin.x) < 0.01 && Math.abs(p.y - origin.y) < 0.01
    );
    expect(hasOrigin).toBe(true);
  });
});
