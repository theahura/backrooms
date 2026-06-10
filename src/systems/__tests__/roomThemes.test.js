import { describe, it, expect } from 'vitest';
import { getRoomTheme } from '../roomThemes.js';

const ROOM_TYPES = ['open', 'maze', 'columns', 'corridor', 'storage', 'cubicles'];

describe('getRoomTheme', () => {
  it('returns floorColor and wallColor for every room type', () => {
    for (const type of ROOM_TYPES) {
      const theme = getRoomTheme(type);
      expect(theme).toHaveProperty('floorColor');
      expect(theme).toHaveProperty('wallColor');
    }
  });

  it('returns distinct color combinations for each room type', () => {
    const combos = new Set();
    for (const type of ROOM_TYPES) {
      const theme = getRoomTheme(type);
      combos.add(`${theme.floorColor}-${theme.wallColor}`);
    }
    expect(combos.size).toBe(ROOM_TYPES.length);
  });

  it('returns a usable fallback theme for unknown room type', () => {
    const theme = getRoomTheme('nonexistent');
    expect(theme).toHaveProperty('floorColor');
    expect(theme).toHaveProperty('wallColor');
    expect(theme.floorColor).not.toBe(theme.wallColor);
  });

});
