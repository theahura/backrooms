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

export function getFlashlightPolygon(origin, angle, coneAngle, segments) {
  const visPolygon = getVisibilityPolygon(origin, segments);

  const points = visPolygon.filter(p => {
    const pointAngle = Math.atan2(p.y - origin.y, p.x - origin.x);
    return isAngleInCone(pointAngle, angle, coneAngle);
  });

  const coneLeftAngle = normalizeAngle(angle - coneAngle);
  const coneRightAngle = normalizeAngle(angle + coneAngle);

  const leftHit = castClosestRay(
    { x: origin.x, y: origin.y, dx: Math.cos(coneLeftAngle), dy: Math.sin(coneLeftAngle) },
    segments
  );
  const rightHit = castClosestRay(
    { x: origin.x, y: origin.y, dx: Math.cos(coneRightAngle), dy: Math.sin(coneRightAngle) },
    segments
  );

  if (leftHit) points.push({ x: leftHit.x, y: leftHit.y });
  if (rightHit) points.push({ x: rightHit.x, y: rightHit.y });

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
