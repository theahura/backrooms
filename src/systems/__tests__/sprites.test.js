import { describe, it, expect } from 'vitest';
import { SPRITE_DEFS, getSpriteConfig, getAllSpriteKeys, ANIM_DEFS, getAllAnimKeys, getEnemyTextureKey, getAnimKeyForState } from '../sprites.js';
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
    it('has all player animation frames', () => {
      expect(getSpriteConfig('player_idle_0')).toBeDefined();
      expect(getSpriteConfig('player_idle_1')).toBeDefined();
      expect(getSpriteConfig('player_walk_0')).toBeDefined();
      expect(getSpriteConfig('player_walk_1')).toBeDefined();
    });

    it('has all basic enemy animation frames', () => {
      expect(getSpriteConfig('enemy_idle_0')).toBeDefined();
      expect(getSpriteConfig('enemy_walk_0')).toBeDefined();
      expect(getSpriteConfig('enemy_walk_1')).toBeDefined();
    });

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
      'player_idle_0', 'player_idle_1', 'player_walk_0', 'player_walk_1',
      'enemy_idle_0', 'enemy_walk_0', 'enemy_walk_1',
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

    it('the player aims its flashlight toward the facing (east) edge', () => {
      // The sprite is authored facing east and rotated in-engine to the aim
      // vector, so the brightest element (the flashlight beam) must sit on the
      // east half of the grid for the facing direction to read after rotation.
      // We identify the beam by luminance, not by a specific palette char, so
      // the test survives re-encoding of the art.
      const luminance = (hex) => {
        const n = parseInt(hex.replace('#', ''), 16);
        const r = (n >> 16) & 0xff;
        const g = (n >> 8) & 0xff;
        const b = n & 0xff;
        return 0.299 * r + 0.587 * g + 0.114 * b;
      };
      const playerKeys = ['player_idle_0', 'player_idle_1', 'player_walk_0', 'player_walk_1'];
      for (const key of playerKeys) {
        const def = getSpriteConfig(key);
        const cols = def.data[0].length;
        const center = (cols - 1) / 2;
        const brightChars = new Set(
          Object.entries(def.palette).filter(([, hex]) => luminance(hex) > 200).map(([ch]) => ch)
        );
        const beamCols = [];
        for (const row of def.data) {
          for (let c = 0; c < row.length; c++) {
            if (brightChars.has(row[c])) beamCols.push(c);
          }
        }
        expect(beamCols.length, `${key} has a bright flashlight beam`).toBeGreaterThan(0);
        const meanCol = beamCols.reduce((a, b) => a + b, 0) / beamCols.length;
        expect(meanCol, `${key} flashlight is on the east half`).toBeGreaterThan(center);
      }
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
      expect(keys).toContain('player_idle');
      expect(keys).toContain('player_walk');
      expect(keys).toContain('enemy_idle');
      expect(keys).toContain('enemy_walk');
      expect(keys).toContain('crawler_idle');
      expect(keys).toContain('crawler_walk');
      expect(keys).toContain('spitter_idle');
      expect(keys).toContain('spitter_walk');
      expect(keys).toContain('spitter_attack');
    });
  });

  describe('getEnemyTextureKey', () => {
    it('returns the idle frame texture for each enemy type', () => {
      expect(getSpriteConfig(getEnemyTextureKey('basic'))).toBeDefined();
      expect(getSpriteConfig(getEnemyTextureKey('crawler'))).toBeDefined();
      expect(getSpriteConfig(getEnemyTextureKey('spitter'))).toBeDefined();
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
      expect(ANIM_DEFS[getAnimKeyForState('basic', 'chase')]).toBeDefined();
      expect(ANIM_DEFS[getAnimKeyForState('crawler', 'chase')]).toBeDefined();
      expect(ANIM_DEFS[getAnimKeyForState('spitter', 'chase')]).toBeDefined();
    });

    it('returns idle animation for idle state', () => {
      expect(ANIM_DEFS[getAnimKeyForState('basic', 'idle')]).toBeDefined();
      expect(ANIM_DEFS[getAnimKeyForState('crawler', 'idle')]).toBeDefined();
      expect(ANIM_DEFS[getAnimKeyForState('spitter', 'idle')]).toBeDefined();
    });

    it('returns walk animation for search state', () => {
      expect(ANIM_DEFS[getAnimKeyForState('basic', 'search')]).toBeDefined();
    });

    it('returns attack animation for spitter in attack state', () => {
      const key = getAnimKeyForState('spitter', 'attack');
      expect(ANIM_DEFS[key]).toBeDefined();
    });
  });
});
