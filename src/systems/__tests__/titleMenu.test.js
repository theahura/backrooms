import { describe, it, expect } from 'vitest';
import { getMenuOptions, getTitleText } from '../titleMenu.js';

describe('titleMenu', () => {
  describe('getMenuOptions', () => {
    it('returns only new game when no save exists', () => {
      const options = getMenuOptions(false);
      const keys = options.map(o => o.key);
      expect(keys).toContain('new_game');
      expect(keys).not.toContain('continue');
      expect(keys).not.toContain('delete_save');
    });

    it('returns continue, new game, and delete save when save exists', () => {
      const options = getMenuOptions(true);
      const keys = options.map(o => o.key);
      expect(keys).toContain('continue');
      expect(keys).toContain('new_game');
      expect(keys).toContain('delete_save');
    });

    it('places continue before new game when save exists', () => {
      const options = getMenuOptions(true);
      const continueIdx = options.findIndex(o => o.key === 'continue');
      const newGameIdx = options.findIndex(o => o.key === 'new_game');
      expect(continueIdx).toBeLessThan(newGameIdx);
    });

    it('gives delete save a distinct color from continue and new game', () => {
      const options = getMenuOptions(true);
      const deleteOpt = options.find(o => o.key === 'delete_save');
      const continueOpt = options.find(o => o.key === 'continue');
      expect(deleteOpt.color).not.toBe(continueOpt.color);
    });
  });

  describe('getTitleText', () => {
    it('returns the game title as BACKROOMS', () => {
      const text = getTitleText();
      expect(text.title).toBe('BACKROOMS');
      expect(text.subtitle).toBeTruthy();
    });
  });
});
