import { describe, it, expect } from 'vitest';
import { isHudObject, partitionSceneObjects } from '../camera.js';

// HUD objects are pinned to the screen (scrollFactor 0 on both axes) and must
// be rendered by the fixed UI camera; everything else is a world object that
// the zoomed main camera renders. These helpers classify objects for that
// split, so the tests drive plain objects carrying only the fields the
// classifier inspects.

describe('isHudObject', () => {
  it('treats an object pinned on both axes as HUD', () => {
    expect(isHudObject({ scrollFactorX: 0, scrollFactorY: 0 })).toBe(true);
  });

  it('treats a fully-scrolling world object as not HUD', () => {
    expect(isHudObject({ scrollFactorX: 1, scrollFactorY: 1 })).toBe(false);
  });

  it('does not treat a world label pinned on only one axis as HUD', () => {
    // Mirrors interactText: scrollFactor x=1 (follows the world) even though it
    // lives at a HUD-like depth. It must render on the world (zoomed) camera.
    expect(isHudObject({ scrollFactorX: 1, scrollFactorY: 0 })).toBe(false);
    expect(isHudObject({ scrollFactorX: 0, scrollFactorY: 1 })).toBe(false);
  });
});

describe('partitionSceneObjects', () => {
  it('routes pinned objects to hud and scrolling objects to world', () => {
    const hpBar = { scrollFactorX: 0, scrollFactorY: 0 };
    const player = { scrollFactorX: 1, scrollFactorY: 1 };
    const enemy = { scrollFactorX: 1, scrollFactorY: 1 };
    const treasureText = { scrollFactorX: 0, scrollFactorY: 0 };

    const { hud, world } = partitionSceneObjects([hpBar, player, enemy, treasureText]);

    expect(hud).toEqual([hpBar, treasureText]);
    expect(world).toEqual([player, enemy]);
  });

  it('keeps a one-axis-pinned world label out of the hud bucket', () => {
    const interactText = { scrollFactorX: 1, scrollFactorY: 0 };
    const { hud, world } = partitionSceneObjects([interactText]);
    expect(hud).toEqual([]);
    expect(world).toEqual([interactText]);
  });

  it('returns empty buckets for an empty scene', () => {
    const { hud, world } = partitionSceneObjects([]);
    expect(hud).toEqual([]);
    expect(world).toEqual([]);
  });
});
