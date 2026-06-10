import { describe, it, expect } from 'vitest';
import { ROOM_VIBES, getRoomVibe } from '../roomVibes.js';
import { FURNITURE_TYPES } from '../furniture.js';

const VIBE_IDS = Object.keys(ROOM_VIBES);

describe('ROOM_VIBES catalogue', () => {
  it('includes the spec-named vibes (furniture store, library, spaceship, forest)', () => {
    expect(VIBE_IDS).toContain('furnitureStore');
    expect(VIBE_IDS).toContain('library');
    expect(VIBE_IDS).toContain('spaceship');
    expect(VIBE_IDS).toContain('forest');
  });

  it('gives every vibe a numeric floorColor and wallColor that differ', () => {
    for (const id of VIBE_IDS) {
      const vibe = ROOM_VIBES[id];
      expect(typeof vibe.floorColor, id).toBe('number');
      expect(typeof vibe.wallColor, id).toBe('number');
      expect(vibe.floorColor, id).not.toBe(vibe.wallColor);
    }
  });

  it('gives every vibe a coherent but distinct palette', () => {
    const combos = new Set(VIBE_IDS.map(id => `${ROOM_VIBES[id].floorColor}-${ROOM_VIBES[id].wallColor}`));
    expect(combos.size).toBe(VIBE_IDS.length);
  });

  it('gives every vibe a furniture profile of clusters and singletons', () => {
    for (const id of VIBE_IDS) {
      const profile = ROOM_VIBES[id].furniture;
      expect(Array.isArray(profile.clusters), id).toBe(true);
      expect(Array.isArray(profile.singletons), id).toBe(true);
      expect(profile.clusters.length, id).toBeGreaterThan(0);
      expect(profile.singletons.length, id).toBeGreaterThan(0);
    }
  });

  it('only references furniture types that exist', () => {
    for (const id of VIBE_IDS) {
      const profile = ROOM_VIBES[id].furniture;
      for (const cluster of profile.clusters) {
        for (const piece of cluster) {
          expect(FURNITURE_TYPES[piece.type], `${id} cluster type ${piece.type}`).toBeDefined();
          expect(typeof piece.dx, `${id} ${piece.type} dx`).toBe('number');
          expect(typeof piece.dy, `${id} ${piece.type} dy`).toBe('number');
        }
      }
      for (const type of profile.singletons) {
        expect(FURNITURE_TYPES[type], `${id} singleton type ${type}`).toBeDefined();
      }
    }
  });

  it('cluster pieces never overlap their own template siblings', () => {
    const overlaps = (a, b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (const id of VIBE_IDS) {
      for (const cluster of ROOM_VIBES[id].furniture.clusters) {
        const rects = cluster.map(p => ({
          x: p.dx, y: p.dy,
          w: FURNITURE_TYPES[p.type].width, h: FURNITURE_TYPES[p.type].height,
        }));
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(overlaps(rects[i], rects[j]), `${id} template self-overlap`).toBe(false);
          }
        }
      }
    }
  });
});

describe('getRoomVibe', () => {
  it('returns a vibe from the catalogue', () => {
    const vibe = getRoomVibe(12345);
    expect(VIBE_IDS).toContain(vibe.id);
    expect(vibe).toBe(ROOM_VIBES[vibe.id]);
  });

  it('is deterministic for the same seed', () => {
    expect(getRoomVibe(777)).toBe(getRoomVibe(777));
  });

  it('produces more than one vibe across a range of seeds', () => {
    const seen = new Set();
    for (let seed = 0; seed < 400; seed++) {
      seen.add(getRoomVibe(seed).id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('reaches every vibe across a range of seeds', () => {
    const seen = new Set();
    for (let seed = 0; seed < 2000; seed++) {
      seen.add(getRoomVibe(seed).id);
    }
    expect(seen.size).toBe(VIBE_IDS.length);
  });
});
