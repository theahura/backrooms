import { describe, it, expect } from 'vitest';
import { getControlsList } from '../pause.js';

describe('pause', () => {
  describe('getControlsList', () => {
    it('desktop controls include keyboard and mouse entries', () => {
      const controls = getControlsList(false);
      const keys = controls.map(c => c.key);
      expect(keys).toContain('WASD');
      expect(keys.some(k => k.toLowerCase().includes('click'))).toBe(true);
    });

    it('desktop controls include ESC for resuming', () => {
      const controls = getControlsList(false);
      const keys = controls.map(c => c.key);
      expect(keys).toContain('ESC');
    });

    it('mobile controls include touch stick and button entries', () => {
      const controls = getControlsList(true);
      const keys = controls.map(c => c.key);
      expect(keys.some(k => k.toLowerCase().includes('stick'))).toBe(true);
      expect(keys).toContain('FIRE');
    });

    it('mobile controls omit ESC since touch devices lack keyboards', () => {
      const controls = getControlsList(true);
      const keys = controls.map(c => c.key);
      expect(keys).not.toContain('ESC');
    });

    it('both platforms cover movement, aiming, and shooting', () => {
      for (const touchMode of [true, false]) {
        const controls = getControlsList(touchMode);
        const actions = controls.map(c => c.action.toLowerCase());
        expect(actions.some(a => a.includes('move'))).toBe(true);
        expect(actions.some(a => a.includes('aim'))).toBe(true);
        expect(actions.some(a => a.includes('shoot'))).toBe(true);
      }
    });
  });
});
