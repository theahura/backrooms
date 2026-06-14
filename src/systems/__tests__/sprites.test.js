import { describe, it, expect } from 'vitest';
import { SPRITE_DEFS, getSpriteConfig, getAllSpriteKeys, ANIM_DEFS, getAllAnimKeys, getEnemyTextureKey, getAnimKeyForState, directionFromAngle, getDirectionalFrame } from '../sprites.js';
import { FURNITURE_TYPES } from '../furniture.js';
import { ITEM_TYPES } from '../items.js';
import { WEAPON_TYPES } from '../weapons.js';

function getRenderedSize(config) {
  const pw = config.pixelWidth || 1;
  const ph = config.pixelHeight || pw;
  return {
    width: config.data[0].length * pw,
    height: config.data.length * ph,
  };
}

describe('sprites', () => {
  describe('furniture sprite coverage', () => {
    it('has a sprite definition for every furniture type', () => {
      for (const type of Object.keys(FURNITURE_TYPES)) {
        expect(getSpriteConfig(`furniture_${type}`)).toBeDefined();
      }
    });

    it('furniture sprites render at the correct furniture dimensions', () => {
      for (const [type, def] of Object.entries(FURNITURE_TYPES)) {
        const config = getSpriteConfig(`furniture_${type}`);
        const size = getRenderedSize(config);
        expect(size.width).toBe(def.width);
        expect(size.height).toBe(def.height);
      }
    });
  });

  describe('item sprite coverage', () => {
    it('has a sprite definition for every item type', () => {
      for (const item of ITEM_TYPES) {
        expect(getSpriteConfig(`item_${item.type}`)).toBeDefined();
      }
    });

    it('item sprites render at the correct item sizes', () => {
      for (const item of ITEM_TYPES) {
        const config = getSpriteConfig(`item_${item.type}`);
        const size = getRenderedSize(config);
        expect(size.width).toBe(item.size.w);
        expect(size.height).toBe(item.size.h);
      }
    });
  });

  describe('weapon pickup sprite coverage', () => {
    it('has a pickup sprite for every weapon type', () => {
      for (const wpn of WEAPON_TYPES) {
        expect(getSpriteConfig(`pickup_${wpn.id}`)).toBeDefined();
      }
    });
  });

  describe('bullet sprite coverage', () => {
    it('has bullet sprites for all weapon types and enemy bullets', () => {
      expect(getSpriteConfig('bullet_pistol')).toBeDefined();
      expect(getSpriteConfig('bullet_shotgun')).toBeDefined();
      expect(getSpriteConfig('bullet_rifle')).toBeDefined();
      expect(getSpriteConfig('enemyBullet')).toBeDefined();
    });
  });

  describe('utility sprite coverage', () => {
    it('has a lore note sprite', () => {
      expect(getSpriteConfig('lore_note')).toBeDefined();
    });

    it('has a door sprite', () => {
      expect(getSpriteConfig('door_closed')).toBeDefined();
    });

    it('has switch on and off sprites', () => {
      expect(getSpriteConfig('switch_on')).toBeDefined();
      expect(getSpriteConfig('switch_off')).toBeDefined();
    });
  });

  describe('getAllSpriteKeys returns at least all entity sprites', () => {
    it('includes furniture, item, weapon, bullet, and utility sprites', () => {
      const keys = getAllSpriteKeys();
      for (const type of Object.keys(FURNITURE_TYPES)) {
        expect(keys).toContain(`furniture_${type}`);
      }
      for (const item of ITEM_TYPES) {
        expect(keys).toContain(`item_${item.type}`);
      }
      for (const wpn of WEAPON_TYPES) {
        expect(keys).toContain(`pickup_${wpn.id}`);
      }
      expect(keys).toContain('lore_note');
      expect(keys).toContain('door_closed');
      expect(keys).toContain('switch_on');
      expect(keys).toContain('switch_off');
    });
  });

  describe('palette completeness', () => {
    it('every data character is present in the sprite palette', () => {
      for (const [key, def] of Object.entries(SPRITE_DEFS)) {
        for (let r = 0; r < def.data.length; r++) {
          for (const ch of def.data[r]) {
            if (ch !== '.') {
              expect(def.palette, `sprite '${key}' row ${r} uses char '${ch}' not in palette`).toHaveProperty(ch);
            }
          }
        }
      }
    });
  });

  describe('character sprite coverage', () => {
    it('has all crawler animation frames', () => {
      expect(getSpriteConfig('crawler_idle_0')).toBeDefined();
      expect(getSpriteConfig('crawler_walk_0')).toBeDefined();
      expect(getSpriteConfig('crawler_walk_1')).toBeDefined();
    });

    it('has all spitter animation frames', () => {
      expect(getSpriteConfig('spitter_idle_0')).toBeDefined();
      expect(getSpriteConfig('spitter_idle_1')).toBeDefined();
      expect(getSpriteConfig('spitter_walk_0')).toBeDefined();
      expect(getSpriteConfig('spitter_walk_1')).toBeDefined();
      expect(getSpriteConfig('spitter_attack_0')).toBeDefined();
    });

    const CHARACTER_KEYS = [
      'crawler_idle_0', 'crawler_walk_0', 'crawler_walk_1',
      'spitter_idle_0', 'spitter_idle_1', 'spitter_walk_0', 'spitter_walk_1', 'spitter_attack_0',
    ];

    it('character sprites are large enough to read (at least 24px per axis)', () => {
      for (const key of CHARACTER_KEYS) {
        const size = getRenderedSize(getSpriteConfig(key));
        expect(size.width, `${key} width`).toBeGreaterThanOrEqual(24);
        expect(size.height, `${key} height`).toBeGreaterThanOrEqual(24);
      }
    });
  });

  describe('directional facing', () => {
    const PI = Math.PI;

    it('maps the eight cardinal/diagonal aim angles to the right facing', () => {
      // Screen space: +x is right, +y is DOWN (so atan2(vy, vx)).
      expect(directionFromAngle(0)).toBe('right');
      expect(directionFromAngle(PI / 4)).toBe('down_right');
      expect(directionFromAngle(PI / 2)).toBe('down');
      expect(directionFromAngle((3 * PI) / 4)).toBe('down_left');
      expect(directionFromAngle(PI)).toBe('left');
      expect(directionFromAngle(-(3 * PI) / 4)).toBe('up_left');
      expect(directionFromAngle(-PI / 2)).toBe('up');
      expect(directionFromAngle(-PI / 4)).toBe('up_right');
    });

    it('wraps angles outside [-PI, PI]', () => {
      expect(directionFromAngle(2 * PI)).toBe('right');
      expect(directionFromAngle(-PI)).toBe('left');
      expect(directionFromAngle(PI / 2 + 2 * PI)).toBe('down');
    });

    it('snaps at the 22.5-degree midpoints between two facings', () => {
      // Midpoint between right (0) and down_right (45deg) is 22.5deg.
      expect(directionFromAngle(PI / 8 - 0.05)).toBe('right');
      expect(directionFromAngle(PI / 8 + 0.05)).toBe('down_right');
    });

    it('resolves non-mirrored facings to their own texture', () => {
      expect(getDirectionalFrame('player', PI / 2)).toMatchObject({ textureKey: 'player_down', flipX: false });
      expect(getDirectionalFrame('player', 0)).toMatchObject({ textureKey: 'player_right', flipX: false });
      expect(getDirectionalFrame('player', -PI / 2)).toMatchObject({ textureKey: 'player_up', flipX: false });
      expect(getDirectionalFrame('player', -PI / 4)).toMatchObject({ textureKey: 'player_up_right', flipX: false });
    });

    it('mirrors the three left-side facings onto the right-side textures', () => {
      expect(getDirectionalFrame('player', PI)).toMatchObject({ textureKey: 'player_right', flipX: true });
      expect(getDirectionalFrame('player', (3 * PI) / 4)).toMatchObject({ textureKey: 'player_down_right', flipX: true });
      expect(getDirectionalFrame('player', -(3 * PI) / 4)).toMatchObject({ textureKey: 'player_up_right', flipX: true });
    });

    it('applies the prefix so enemies and players resolve to distinct textures', () => {
      expect(getDirectionalFrame('enemy', PI / 2).textureKey).toBe('enemy_down');
      expect(getDirectionalFrame('enemy', PI)).toMatchObject({ textureKey: 'enemy_right', flipX: true });
    });
  });

  describe('animation definitions', () => {
    it('every animation frame references an existing sprite definition', () => {
      for (const [animKey, animDef] of Object.entries(ANIM_DEFS)) {
        for (const frameKey of animDef.frames) {
          expect(getSpriteConfig(frameKey), `frame '${frameKey}' in animation '${animKey}' not found`).toBeDefined();
        }
      }
    });

    it('getAllAnimKeys returns all animation keys', () => {
      const keys = getAllAnimKeys();
      expect(keys).toContain('crawler_idle');
      expect(keys).toContain('crawler_walk');
      expect(keys).toContain('spitter_idle');
      expect(keys).toContain('spitter_walk');
      expect(keys).toContain('spitter_attack');
    });
  });

  describe('getEnemyTextureKey', () => {
    it('returns a defined initial texture for procedural enemy types', () => {
      expect(getSpriteConfig(getEnemyTextureKey('crawler'))).toBeDefined();
      expect(getSpriteConfig(getEnemyTextureKey('spitter'))).toBeDefined();
    });

    it('returns a directional facing key for basic enemies', () => {
      expect(getEnemyTextureKey('basic')).toBe('enemy_down');
    });

    it('returns different texture keys for different enemy types', () => {
      const basic = getEnemyTextureKey('basic');
      const crawler = getEnemyTextureKey('crawler');
      const spitter = getEnemyTextureKey('spitter');
      expect(basic).not.toBe(crawler);
      expect(basic).not.toBe(spitter);
      expect(crawler).not.toBe(spitter);
    });
  });

  describe('getAnimKeyForState', () => {
    it('returns walk animation for chase state', () => {
      expect(ANIM_DEFS[getAnimKeyForState('crawler', 'chase')]).toBeDefined();
      expect(ANIM_DEFS[getAnimKeyForState('spitter', 'chase')]).toBeDefined();
    });

    it('returns idle animation for idle state', () => {
      expect(ANIM_DEFS[getAnimKeyForState('crawler', 'idle')]).toBeDefined();
      expect(ANIM_DEFS[getAnimKeyForState('spitter', 'idle')]).toBeDefined();
    });

    it('returns walk animation for search state', () => {
      expect(ANIM_DEFS[getAnimKeyForState('crawler', 'search')]).toBeDefined();
    });

    it('returns attack animation for spitter in attack state', () => {
      const key = getAnimKeyForState('spitter', 'attack');
      expect(ANIM_DEFS[key]).toBeDefined();
    });
  });
});
