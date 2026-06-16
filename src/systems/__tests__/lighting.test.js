import { describe, it, expect } from 'vitest';
import { pointInPolygon, radialBrightness, sampleBrightness, brightnessToGray } from '../lighting.js';

describe('pointInPolygon', () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

  it('is true for a point clearly inside', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
  });

  it('is false for a point clearly outside', () => {
    expect(pointInPolygon(15, 5, square)).toBe(false);
  });

  // A chevron with a notch cut into the bottom edge (apex at (5,4)). The solid
  // body is above the apex; the wedge below it is outside the shape -- this is
  // the shape of a flashlight cone with a wall shadow bitten out of it.
  const chevron = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 5, y: 4 }, { x: 0, y: 10 }];

  it('is true inside the solid part of a concave shape', () => {
    expect(pointInPolygon(5, 1, chevron)).toBe(true);
  });

  it('is false inside the concave notch', () => {
    expect(pointInPolygon(5, 8, chevron)).toBe(false);
  });
});

describe('radialBrightness', () => {
  it('is full brightness at the center', () => {
    expect(radialBrightness(0, 0, 0, 0, 10)).toBe(1);
  });

  it('falls to zero at the radius edge', () => {
    expect(radialBrightness(10, 0, 0, 0, 10)).toBe(0);
  });

  it('stays zero beyond the radius', () => {
    expect(radialBrightness(20, 0, 0, 0, 10)).toBe(0);
  });

  it('is half brightness at half the radius (linear falloff)', () => {
    expect(radialBrightness(5, 0, 0, 0, 10)).toBeCloseTo(0.5);
  });

  it('is zero for a non-positive radius', () => {
    expect(radialBrightness(0, 0, 0, 0, 0)).toBe(0);
  });
});

describe('sampleBrightness', () => {
  it('fully lights a base inside a lit room', () => {
    const field = { litRoomRects: [{ x: 0, y: 0, width: 100, height: 100 }] };
    expect(sampleBrightness(50, 50, field)).toBe(1);
  });

  it('fully lights a base inside the flashlight cone', () => {
    const cone = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    expect(sampleBrightness(50, 50, { cone })).toBe(1);
  });

  it('leaves a base far from every light source fully dark', () => {
    const field = {
      litRoomRects: [{ x: 0, y: 0, width: 10, height: 10 }],
      cone: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      nearField: { x: 0, y: 0, radius: 10 },
      lamps: [{ x: 0, y: 0, radius: 10, brightness: 1 }],
    };
    expect(sampleBrightness(500, 500, field)).toBe(0);
  });

  it('scales a lamp-only base by the lamp falloff and its brightness', () => {
    // base 50 from a radius-100 lamp -> radial 0.5, times brightness 0.5 -> 0.25
    const field = { lamps: [{ x: 0, y: 0, radius: 100, brightness: 0.5 }] };
    expect(sampleBrightness(50, 0, field)).toBeCloseTo(0.25);
  });

  it('takes the strongest of overlapping sources', () => {
    // near-field gives 0.5 here; the dim lamp gives 0.1; the max wins.
    const field = {
      nearField: { x: 0, y: 0, radius: 100 },
      lamps: [{ x: 0, y: 0, radius: 100, brightness: 0.2 }],
    };
    expect(sampleBrightness(50, 0, field)).toBeCloseTo(0.5);
  });
});

describe('brightnessToGray', () => {
  it('darkens a fully unlit prop down to the floor minimum', () => {
    // round(255 * 0.05) === 13 -- a faint silhouette matching the darkened floor.
    expect(brightnessToGray(0, 0.05)).toBe(13);
  });

  it('leaves a fully lit prop at full brightness', () => {
    expect(brightnessToGray(1, 0.05)).toBe(255);
  });

  it('brightens monotonically between dark and lit', () => {
    expect(brightnessToGray(0.25, 0.05)).toBeLessThan(brightnessToGray(0.75, 0.05));
  });

  it('drives the unlit floor off the minFraction argument, not a hardcoded value', () => {
    expect(brightnessToGray(0, 0.2)).toBeGreaterThan(brightnessToGray(0, 0.05));
  });
});
