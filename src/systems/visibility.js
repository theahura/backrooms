export function raySegmentIntersection(ray, segment) {
  const r_dx = ray.dx;
  const r_dy = ray.dy;
  const s_dx = segment.x2 - segment.x1;
  const s_dy = segment.y2 - segment.y1;

  const denom = s_dx * r_dy - s_dy * r_dx;
  if (Math.abs(denom) < 1e-10) return null;

  const t2 = (r_dx * (segment.y1 - ray.y) - r_dy * (segment.x1 - ray.x)) / denom;
  const t1 = (s_dx * (segment.y1 - ray.y) - s_dy * (segment.x1 - ray.x)) / denom;

  if (t1 < 0 || t2 < 0 || t2 > 1) return null;

  return {
    x: ray.x + r_dx * t1,
    y: ray.y + r_dy * t1,
    t: t1,
  };
}

export function getVisibilityPolygon(origin, segments) {
  const uniqueAngles = new Set();

  for (const seg of segments) {
    const a1 = Math.atan2(seg.y1 - origin.y, seg.x1 - origin.x);
    const a2 = Math.atan2(seg.y2 - origin.y, seg.x2 - origin.x);
    uniqueAngles.add(a1);
    uniqueAngles.add(a2);

    const offset = 0.00001;
    uniqueAngles.add(a1 - offset);
    uniqueAngles.add(a1 + offset);
    uniqueAngles.add(a2 - offset);
    uniqueAngles.add(a2 + offset);
  }

  const sortedAngles = [...uniqueAngles].sort((a, b) => a - b);
  const points = [];

  for (const angle of sortedAngles) {
    const ray = {
      x: origin.x,
      y: origin.y,
      dx: Math.cos(angle),
      dy: Math.sin(angle),
    };

    let closest = null;
    for (const seg of segments) {
      const hit = raySegmentIntersection(ray, seg);
      if (hit && (closest === null || hit.t < closest.t)) {
        closest = hit;
      }
    }

    if (closest) {
      points.push({ x: closest.x, y: closest.y, angle });
    }
  }

  return points;
}

function normalizeAngle(a) {
  while (a < -Math.PI) a += 2 * Math.PI;
  while (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

function isAngleInCone(angle, coneCenter, coneHalf) {
  const diff = normalizeAngle(angle - coneCenter);
  return Math.abs(diff) <= coneHalf;
}

function castClosestRay(ray, segments) {
  let closest = null;
  for (const seg of segments) {
    const hit = raySegmentIntersection(ray, seg);
    if (hit && (closest === null || hit.t < closest.t)) {
      closest = hit;
    }
  }
  return closest;
}

export const FLASHLIGHT_RANGE = 300;

const ARC_SAMPLE_STEP = Math.PI / 18;

// Keep only segments whose bounding box is within reach of a capped ray; with
// maxRange capping, anything further can never affect the polygon.
export function filterSegmentsNear(origin, range, segments) {
  return segments.filter(seg => {
    const minX = Math.min(seg.x1, seg.x2);
    const maxX = Math.max(seg.x1, seg.x2);
    const minY = Math.min(seg.y1, seg.y2);
    const maxY = Math.max(seg.y1, seg.y2);
    const dx = Math.max(minX - origin.x, 0, origin.x - maxX);
    const dy = Math.max(minY - origin.y, 0, origin.y - maxY);
    return dx * dx + dy * dy <= range * range;
  });
}

// Same bounding-box-vs-range prefilter as filterSegmentsNear, for the {x,y,
// width,height} rects that interior walls are expanded from each frame.
export function filterRectsNear(origin, range, rects) {
  return rects.filter(rect => {
    const minX = rect.x;
    const maxX = rect.x + rect.width;
    const minY = rect.y;
    const maxY = rect.y + rect.height;
    const dx = Math.max(minX - origin.x, 0, origin.x - maxX);
    const dy = Math.max(minY - origin.y, 0, origin.y - maxY);
    return dx * dx + dy * dy <= range * range;
  });
}

export function getFlashlightPolygon(origin, angle, coneAngle, segments, maxRange = Infinity) {
  const rayAngles = [angle - coneAngle, angle + coneAngle];

  const offset = 0.00001;
  for (const seg of segments) {
    for (const [ex, ey] of [[seg.x1, seg.y1], [seg.x2, seg.y2]]) {
      const a = Math.atan2(ey - origin.y, ex - origin.x);
      for (const candidate of [a - offset, a, a + offset]) {
        if (isAngleInCone(candidate, angle, coneAngle)) rayAngles.push(candidate);
      }
    }
  }

  for (let rel = -coneAngle; rel <= coneAngle; rel += ARC_SAMPLE_STEP) {
    rayAngles.push(angle + rel);
  }

  const points = [];
  for (const rayAngle of rayAngles) {
    const dx = Math.cos(rayAngle);
    const dy = Math.sin(rayAngle);
    const hit = castClosestRay({ x: origin.x, y: origin.y, dx, dy }, segments);

    if (hit && hit.t <= maxRange) {
      points.push({ x: hit.x, y: hit.y });
    } else if (Number.isFinite(maxRange)) {
      points.push({ x: origin.x + dx * maxRange, y: origin.y + dy * maxRange });
    }
  }

  const seen = new Set();
  const deduped = points.filter(p => {
    const key = `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    const aRel = normalizeAngle(Math.atan2(a.y - origin.y, a.x - origin.x) - angle);
    const bRel = normalizeAngle(Math.atan2(b.y - origin.y, b.x - origin.x) - angle);
    return aRel - bRel;
  });

  deduped.unshift({ x: origin.x, y: origin.y });

  return deduped;
}
