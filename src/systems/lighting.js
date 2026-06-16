// Per-prop flashlight light model. The world's darkness is a depth-100 overlay
// masked by a floor-space reveal polygon, so anything drawn BELOW it that rises
// above its floor footprint (an upright billboard prop) gets blacked out except
// at its feet. Instead, props are drawn ABOVE the darkness and tinted by the
// light level sampled at their base, so a lit prop's whole front face brightens
// as a unit (like a maze pillar) and an unlit one fades into the dark.

// Even-odd ray-cast point-in-polygon. `polygon` is an array of {x,y}; used to
// test whether a prop's base sits inside the flashlight cone polygon (which is
// concave wherever a wall bites a shadow out of the beam).
export function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Linear radial falloff: full brightness at the source, fading to 0 at the rim
// and staying 0 beyond it. A non-positive radius contributes no light.
export function radialBrightness(px, py, cx, cy, radius) {
  if (radius <= 0) return 0;
  const d = Math.hypot(px - cx, py - cy);
  const b = 1 - d / radius;
  return b < 0 ? 0 : b > 1 ? 1 : b;
}

// Brightness in [0,1] at a point, taking the strongest contribution across the
// active light sources: lit rooms and the flashlight cone read as full light;
// the player's near-field pool and ceiling lamps fall off radially (a lamp also
// scales by its own flicker brightness). `field` may omit any source.
export function sampleBrightness(px, py, field = {}) {
  const { litRoomRects, cone, nearField, lamps } = field;

  if (litRoomRects) {
    for (const r of litRoomRects) {
      if (px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height) return 1;
    }
  }

  let b = 0;
  if (cone && cone.length >= 3 && pointInPolygon(px, py, cone)) b = 1;
  if (b < 1 && nearField) {
    b = Math.max(b, radialBrightness(px, py, nearField.x, nearField.y, nearField.radius));
  }
  if (b < 1 && lamps) {
    for (const lamp of lamps) {
      const contribution = radialBrightness(px, py, lamp.x, lamp.y, lamp.radius) * (lamp.brightness ?? 1);
      if (contribution > b) b = contribution;
    }
  }
  return b < 0 ? 0 : b > 1 ? 1 : b;
}

// Map a brightness to a gray multiply-tint channel (0..255). `minFraction` is
// the floor an unlit prop is darkened to, matching the world's darkness (which
// is ~0.95 opaque, leaving the floor at ~5% brightness) so a prop in the dark
// reads as a faint silhouette rather than a pure-black cutout.
export function brightnessToGray(b, minFraction) {
  const clamped = b < 0 ? 0 : b > 1 ? 1 : b;
  return Math.round(255 * (minFraction + (1 - minFraction) * clamped));
}
