import { describe, it, expect } from 'vitest';
import { SPRITE_DEFS, getSpriteConfig, getAllSpriteKeys } from '../sprites.js';
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
});
