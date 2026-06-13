import { describe, it, expect } from 'vitest';
import { raySegmentIntersection, getVisibilityPolygon, getFlashlightPolygon, filterSegmentsNear, filterRectsNear } from '../visibility.js';
import { wallRectSegments, wallRectOccluders, generateMazeWalls, getRoomType } from '../maze.js';
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

describe('thick wall rects (light cannot leak through wall bands)', () => {
  // Geometric oracle: no polygon vertex may receive light farther than the
  // closest wall hit along its own ray.
  function assertNoLightBeyondWalls(polygon, origin, segments, maxRange) {
    for (const p of polygon) {
      const dist = Math.hypot(p.x - origin.x, p.y - origin.y);
      if (dist < 0.01) continue;
      const angle = Math.atan2(p.y - origin.y, p.x - origin.x);
      const ray = { x: origin.x, y: origin.y, dx: Math.cos(angle), dy: Math.sin(angle) };
      let closest = maxRange;
      for (const seg of segments) {
        const hit = raySegmentIntersection(ray, seg);
        if (hit && hit.t < closest) closest = hit.t;
      }
      expect(dist, `vertex (${p.x.toFixed(1)},${p.y.toFixed(1)})`).toBeLessThanOrEqual(closest + 2);
    }
  }

  function assertNoVertexInsideRect(polygon, rect) {
    for (const p of polygon) {
      const inside =
        p.x > rect.x + 0.01 && p.x < rect.x + rect.width - 0.01 &&
        p.y > rect.y + 0.01 && p.y < rect.y + rect.height - 0.01;
      expect(inside, `vertex (${p.x.toFixed(1)},${p.y.toFixed(1)}) inside wall band`).toBe(false);
    }
  }

  it('stops light at the near face of a free-standing wall band', () => {
    const rect = { x: 100, y: -50, width: 50, height: 100 };
    const segments = wallRectSegments(rect);
    const origin = { x: 0, y: 0 };
    const polygon = getFlashlightPolygon(origin, 0, Math.PI / 6, segments, 300);

    assertNoVertexInsideRect(polygon, rect);
    for (const p of polygon) {
      const angle = Math.atan2(p.y - origin.y, p.x - origin.x);
      if (Math.abs(angle) < 0.45) {
        expect(p.x).toBeLessThanOrEqual(100.01);
      }
    }
  });

  it('does not let grazing light tunnel lengthwise through a wall band (captured leak)', () => {
    // Captured in playtest: light entered a horizontal band near its end and
    // travelled 56px inside the visually solid wall before exiting beyond it.
    const rect = { x: 968, y: 407, width: 56, height: 16 };
    const segments = wallRectSegments(rect);
    const origin = { x: 751, y: 400 };
    const aim = Math.atan2(416 - origin.y, 1050 - origin.x);
    const polygon = getFlashlightPolygon(origin, aim, Math.PI / 6, segments, 300);

    assertNoVertexInsideRect(polygon, rect);
    assertNoLightBeyondWalls(polygon, origin, segments, 300);
    // Light past the band's right end at band height can only get there by
    // tunneling through the band: rays over the top reach at most y=407.8 out
    // there, rays under the near end arrive below y=423.
    for (const p of polygon) {
      const tunneled = p.x > rect.x + rect.width && p.y > 407.8 && p.y < 422.9;
      expect(tunneled, `vertex (${p.x.toFixed(1)},${p.y.toFixed(1)}) tunneled through the band`).toBe(false);
    }
  });

  it('does not leak light through the junction where a maze wall meets the room perimeter (captured leak)', () => {
    // Captured in playtest: the maze wall occluder ended at the perimeter's
    // inner face, letting rays cut diagonally through the visually solid
    // junction. The wall rect must reach the true room edge.
    const room = { x: 0, y: 0, width: 720, height: 600 };
    const perimeter = createRoomWalls(room.x, room.y, room.width, room.height, []);
    const wallRect = { x: 255, y: 0, width: 16, height: 353 };
    const segments = [...perimeter, ...wallRectSegments(wallRect)];
    const origin = { x: 245, y: 26 };

    for (const aim of [Math.atan2(-10, 18), -Math.PI / 4, -Math.PI / 8]) {
      const polygon = getFlashlightPolygon(origin, aim, 0.46, segments, 300);
      assertNoVertexInsideRect(polygon, wallRect);
      for (const p of polygon) {
        expect(p.x, `vertex (${p.x.toFixed(1)},${p.y.toFixed(1)}) beyond the wall band`)
          .toBeLessThanOrEqual(wallRect.x + wallRect.width + 0.01);
      }
    }
  });

  it('does not let light wrap through the drawn corner where two wall bands meet (captured leak)', () => {
    // Captured in playtest: cubicle partition occluders met at a zero-width
    // centerline corner, so corner rays wrapped through the drawn 16px corner
    // block and lit the floor 71px beyond it. Overlapping band rects seal it.
    const hBand = { x: 926, y: 264, width: 64, height: 16 };
    const vBand = { x: 918, y: 272, width: 16, height: 64 };
    const segments = [...wallRectSegments(hBand), ...wallRectSegments(vBand)];
    const origin = { x: 750.6666666666673, y: 399.99999999999943 };
    const aim = Math.atan2(272 - origin.y, 926 - origin.x);
    const polygon = getFlashlightPolygon(origin, aim, 0.46, segments, 300);

    assertNoVertexInsideRect(polygon, hBand);
    assertNoVertexInsideRect(polygon, vBand);
    assertNoLightBeyondWalls(polygon, origin, segments, 300);
  });
});

describe('filterRectsNear', () => {
  const origin = { x: 0, y: 0 };

  it('keeps a rect whose nearest edge is within range', () => {
    const near = { x: 50, y: 0, width: 20, height: 20 };
    const far = { x: 500, y: 500, width: 20, height: 20 };
    const kept = filterRectsNear(origin, 100, [near, far]);
    expect(kept).toContain(near);
    expect(kept).not.toContain(far);
  });

  it('keeps a rect that straddles the range boundary and drops one clearly beyond it', () => {
    const straddling = { x: 90, y: -10, width: 40, height: 20 }; // nearest x=90 < 100
    const beyond = { x: 200, y: 0, width: 10, height: 10 }; // nearest x=200 > 100
    const kept = filterRectsNear(origin, 100, [straddling, beyond]);
    expect(kept).toContain(straddling);
    expect(kept).not.toContain(beyond);
  });
});

describe('back-face wall occluders light the near band without leaking', () => {
  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      const intersects =
        (a.y > point.y) !== (b.y > point.y) &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  it('lights a point inside the near band of a wall the player is facing', () => {
    // Light below a horizontal band, aiming up at it. A point just inside the
    // band's near (bottom) face must fall inside the lit flashlight polygon --
    // i.e. the wall now shows thickness instead of a flat near-face shadow.
    const band = { x: 100, y: 100, width: 200, height: 16 }; // top100 bottom116
    const origin = { x: 200, y: 320 };
    const occluders = wallRectOccluders(band, origin);
    const polygon = getFlashlightPolygon(origin, -Math.PI / 2, Math.PI / 3, occluders, 600);

    const nearBandPoint = { x: 200, y: 114 }; // 2px inside the near (bottom) face
    expect(pointInPolygon(nearBandPoint, polygon)).toBe(true);
  });

  it('does not let light leak onto the floor beyond a wall the player faces', () => {
    const band = { x: 100, y: 100, width: 200, height: 16 };
    const origin = { x: 200, y: 320 };
    const occluders = wallRectOccluders(band, origin);
    const polygon = getFlashlightPolygon(origin, -Math.PI / 2, Math.PI / 3, occluders, 600);

    // No lit vertex may sit above the band's far (top) face within its x-span:
    // that floor is on the other side of the wall.
    for (const p of polygon) {
      if (p.x > band.x + 1 && p.x < band.x + band.width - 1) {
        expect(p.y, `vertex (${p.x.toFixed(1)},${p.y.toFixed(1)}) leaked past the wall`).toBeGreaterThanOrEqual(band.y - 0.5);
      }
    }
    // Sample actual floor points behind the wall (not just polygon vertices):
    // every point above the far face within the band's x-span must stay dark.
    for (let x = band.x + 10; x < band.x + band.width - 10; x += 20) {
      for (const y of [band.y - 10, band.y - 60, band.y - 120]) {
        expect(pointInPolygon({ x, y }, polygon), `floor point (${x},${y}) behind the wall is lit`).toBe(false);
      }
    }
  });

  it('blocks every through-ray that the solid walls block, across real maze rooms', () => {
    // Composition invariant over real generated rooms: for a dense fan of rays
    // from the room centre, any ray the SOLID wall outlines stop must also be
    // stopped by the back-face occluders (no floor leak past a wall), and the
    // back-face hit is never nearer than the solid hit (light reaches at least
    // the near face). Some rays travel strictly farther -- that is the lit
    // near band the fix introduces.
    const ROOM = { x: 0, y: 0, width: 720, height: 600, thickness: 16 };
    const center = { x: ROOM.x + ROOM.width / 2, y: ROOM.y + ROOM.height / 2 };
    const doors = [{ wall: 'east', offset: 280, width: 80, targetRoomId: 1 }];

    let roomsSeen = 0;
    let sawLitBand = false;
    for (let seed = 0; seed < 120; seed++) {
      const type = getRoomType(seed);
      if (type !== 'maze' && type !== 'corridor' && type !== 'cubicles' && type !== 'storage') continue;
      const rects = generateMazeWalls(ROOM.x, ROOM.y, ROOM.width, ROOM.height, ROOM.thickness, seed, doors);
      if (rects.length === 0) continue;
      roomsSeen++;

      // The full outline in the SAME edge orientation the occluders use, so the
      // culled set is an exact coordinate subset of it -- otherwise a ray that
      // exactly grazes a shared rect corner can round its t just outside [0,1]
      // for one endpoint ordering and inside for the other, a float artifact
      // (not a leak) that would make this comparison fragile.
      const fullSegments = rects.flatMap(rectEdges);
      const culledSegments = rects.flatMap(r => wallRectOccluders(r, center));

      for (let k = 0; k < 360; k++) {
        const angle = (k / 360) * Math.PI * 2;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const full = closestRayHit(center, dx, dy, fullSegments);
        if (!full) continue; // ray sees no wall; nothing to block
        const culled = closestRayHit(center, dx, dy, culledSegments);
        expect(culled, `seed ${seed} angle ${k}: a solid-blocked ray escaped the back-face occluders`).not.toBeNull();
        expect(culled.t).toBeGreaterThanOrEqual(full.t - 1e-6);
        if (culled.t > full.t + 1) sawLitBand = true;
      }
    }

    expect(roomsSeen).toBeGreaterThan(0);
    expect(sawLitBand, 'no wall ever lit its near band across the sweep').toBe(true);
  });
});

function closestRayHit(origin, dx, dy, segments) {
  const ray = { x: origin.x, y: origin.y, dx, dy };
  let closest = null;
  for (const seg of segments) {
    const hit = raySegmentIntersection(ray, seg);
    if (hit && (closest === null || hit.t < closest.t)) closest = hit;
  }
  return closest;
}

// The four edges of a rect in the same endpoint orientation wallRectOccluders
// emits, so a culled edge is coordinate-identical to its full counterpart.
function rectEdges(rect) {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  return [
    { x1: left, y1: top, x2: right, y2: top },
    { x1: left, y1: bottom, x2: right, y2: bottom },
    { x1: left, y1: top, x2: left, y2: bottom },
    { x1: right, y1: top, x2: right, y2: bottom },
  ];
}
