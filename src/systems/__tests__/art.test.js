import { describe, it, expect } from 'vitest';
import {
  getTextureSource,
  isBackgroundSample,
  shopIconKey,
  getArtSpriteKeys,
} from '../art.js';
import { UPGRADES } from '../shop.js';

describe('getTextureSource', () => {
  it('uses the loaded PNG when a texture exists for the key', () => {
    const hasTexture = (key) => key === 'player_idle_0';
    expect(getTextureSource(hasTexture, 'player_idle_0')).toBe('png');
  });

  it('falls back to procedural generation when no PNG texture is loaded', () => {
    const hasTexture = () => false;
    expect(getTextureSource(hasTexture, 'player_idle_0')).toBe('procedural');
  });
});

describe('isBackgroundSample (chroma key decision)', () => {
  // A sampled background corner colour (the green screen the model produced).
  const ref = [150, 191, 99];

  it('removes pixels that are already transparent regardless of colour', () => {
    expect(isBackgroundSample(255, 0, 0, 0, ...ref)).toBe(true);
  });

  it('removes pixels close to the sampled background colour', () => {
    expect(isBackgroundSample(152, 188, 102, 255, ...ref)).toBe(true);
  });

  it('keeps a dark outline pixel far from the background', () => {
    expect(isBackgroundSample(10, 10, 10, 255, ...ref)).toBe(false);
  });

  it('keeps a bright sprite color far from the background', () => {
    expect(isBackgroundSample(235, 235, 230, 255, ...ref)).toBe(false);
  });

  it('keeps the muted character greens, which differ from the bright bg', () => {
    // player palette '#3a5a3a' = (58, 90, 58)
    expect(isBackgroundSample(58, 90, 58, 255, ...ref)).toBe(false);
  });

  it('keys grey-green and purple backgrounds against their own corner', () => {
    expect(isBackgroundSample(159, 160, 140, 255, 159, 160, 140)).toBe(true);
    expect(isBackgroundSample(153, 136, 156, 255, 153, 136, 156)).toBe(true);
  });
});

describe('shopIconKey', () => {
  it('maps every real shop upgrade to a distinct, stable icon texture key', () => {
    const keys = UPGRADES.map((u) => shopIconKey(u.id));
    expect(keys.every((k) => typeof k === 'string' && k.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(UPGRADES.length);
    expect(shopIconKey('battery')).toBe(shopIconKey('battery'));
  });

  it('returns null for an unknown upgrade id', () => {
    expect(shopIconKey('not_a_real_upgrade')).toBeNull();
  });
});

describe('art generation scope', () => {
  it('includes the visually important sprites', () => {
    const keys = getArtSpriteKeys();
    expect(keys).toContain('player_idle_0');
    expect(keys).toContain('enemy_idle_0');
    expect(keys).toContain('furniture_table');
  });

  it('excludes micro-sprites that are intentionally kept procedural', () => {
    const keys = getArtSpriteKeys();
    expect(keys).not.toContain('bullet_pistol');
    expect(keys).not.toContain('item_copper_coin');
    expect(keys).not.toContain('enemyBullet');
  });
});
