import { describe, it, expect } from 'vitest';
import { raySegmentIntersection, getVisibilityPolygon, getFlashlightPolygon, filterSegmentsNear } from '../visibility.js';
import { createRoomWalls } from '../room.js';
import { getRoomAt, isRiftDoor } from '../worldgen.js';

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

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

describe('getFlashlightPolygon with maxRange', () => {
  const origin = { x: 0, y: 0 };
  const CONE_HALF = Math.PI / 6;
  const RANGE = 300;

  it('renders a full rounded cone in every direction when nothing blocks the light', () => {
    const sectorArea = CONE_HALF * RANGE * RANGE;
    for (let i = 0; i < 16; i++) {
      const angle = -Math.PI + (i / 16) * 2 * Math.PI;
      const poly = getFlashlightPolygon(origin, angle, CONE_HALF, [], RANGE);
      expect(poly.length, `angle ${angle}`).toBeGreaterThanOrEqual(3);
      for (const p of poly) {
        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(RANGE + 1e-6);
      }
      expect(polygonArea(poly), `angle ${angle}`).toBeGreaterThan(sectorArea * 0.5);
    }
  });

  it('does not collapse when the only wall is behind the player (6-to-8 o-clock regression)', () => {
    const wallBehind = [{ x1: -50, y1: -100, x2: 50, y2: -100 }];
    for (const angle of [Math.PI / 2, (2 * Math.PI) / 3, (5 * Math.PI) / 6]) {
      const poly = getFlashlightPolygon(origin, angle, CONE_HALF, wallBehind, RANGE);
      expect(poly.length, `angle ${angle}`).toBeGreaterThanOrEqual(3);
      expect(polygonArea(poly), `angle ${angle}`).toBeGreaterThan(0.25 * CONE_HALF * RANGE * RANGE);
    }
  });

  it('is truncated by a wall closer than maxRange but still reaches it', () => {
    const wall = [{ x1: 100, y1: -200, x2: 100, y2: 200 }];
    const poly = getFlashlightPolygon(origin, 0, CONE_HALF, wall, RANGE);
    for (const p of poly) expect(p.x).toBeLessThanOrEqual(100 + 1e-6);
    expect(Math.max(...poly.map(p => p.x))).toBeGreaterThan(99);
  });

  it('caps the light at maxRange when walls are further away', () => {
    const farWall = [{ x1: 500, y1: -400, x2: 500, y2: 400 }];
    const poly = getFlashlightPolygon(origin, 0, CONE_HALF, farWall, RANGE);
    for (const p of poly) {
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(RANGE + 1e-6);
    }
    expect(Math.max(...poly.map(p => Math.hypot(p.x, p.y)))).toBeGreaterThan(RANGE - 1);
  });

  it('renders a cone spanning the +/-PI seam with no segments at all', () => {
    const sectorArea = CONE_HALF * RANGE * RANGE;
    for (const angle of [Math.PI * 0.999, -Math.PI * 0.999, Math.PI]) {
      const poly = getFlashlightPolygon(origin, angle, CONE_HALF, [], RANGE);
      expect(poly.length, `angle ${angle}`).toBeGreaterThanOrEqual(3);
      expect(polygonArea(poly), `angle ${angle}`).toBeGreaterThan(sectorArea * 0.5);
    }
  });
});

describe('filterSegmentsNear', () => {
  it('keeps segments a lit ray could reach and drops far ones', () => {
    const near = { x1: 299, y1: -50, x2: 299, y2: 50 };
    const far = { x1: 3000, y1: -50, x2: 3000, y2: 50 };
    const kept = filterSegmentsNear({ x: 0, y: 0 }, 300, [near, far]);
    expect(kept).toContain(near);
    expect(kept).not.toContain(far);
  });

  it('produces the same flashlight coverage as the unfiltered segment set', () => {
    const segments = [
      ...createRoomWalls(-200, -200, 400, 400, []),
      { x1: 5000, y1: -100, x2: 5000, y2: 100 },
      { x1: -5000, y1: -100, x2: -5000, y2: 100 },
    ];
    const origin = { x: 0, y: 0 };
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const full = getFlashlightPolygon(origin, angle, Math.PI / 5, segments, 300);
      const filtered = getFlashlightPolygon(
        origin, angle, Math.PI / 5, filterSegmentsNear(origin, 300, segments), 300
      );
      expect(polygonArea(filtered) / polygonArea(full)).toBeCloseTo(1, 5);
    }
  });
});

describe('the rift seals the store against light', () => {
  it('lets no light through the sealed east wall of the store', () => {
    const room = getRoomAt(11, 0, 0);
    const nonRiftDoors = room.doors.filter(d => !isRiftDoor(room, d));
    const segments = createRoomWalls(room.x, room.y, room.width, room.height, nonRiftDoors);
    const origin = { x: room.x + room.width / 2, y: room.y + room.height / 2 };
    const poly = getFlashlightPolygon(origin, 0, Math.PI / 4, segments, room.width * 2);
    for (const p of poly) {
      expect(p.x).toBeLessThanOrEqual(room.x + room.width + 1e-6);
    }
    expect(Math.max(...poly.map(p => p.x))).toBeGreaterThan(room.x + room.width - 1);
  });
});
