import { describe, it, expect } from 'vitest';
import { ZONES, getRoomVibe } from '../roomVibes.js';
import { ZONE_IDS } from '../zones.js';
import { FURNITURE_TYPES, generateRoomFurniture } from '../furniture.js';

describe('ZONES catalogue', () => {
  it('defines a zone for every backrooms zone id', () => {
    for (const id of ZONE_IDS) {
      expect(ZONES[id], id).toBeDefined();
    }
  });

  it('covers the spec-named liminal zones (mall, hospital, hotel)', () => {
    expect(ZONE_IDS).toContain('mall');
    expect(ZONE_IDS).toContain('hospital');
    expect(ZONE_IDS).toContain('hotel');
  });

  it('every zone profile actually furnishes a room', () => {
    for (const id of ZONE_IDS) {
      const items = generateRoomFurniture(0, 0, 720, 600, 16, 7, ZONES[id].furniture);
      expect(items.length, id).toBeGreaterThan(0);
    }
  });

  it('only references furniture types that exist', () => {
    for (const id of ZONE_IDS) {
      const profile = ZONES[id].furniture;
      for (const cluster of profile.clusters) {
        for (const piece of cluster) {
          expect(FURNITURE_TYPES[piece.type], `${id} cluster type ${piece.type}`).toBeDefined();
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
    for (const id of ZONE_IDS) {
      for (const cluster of ZONES[id].furniture.clusters) {
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
  it('gives floor and wall distinct colors in every zone', () => {
    for (const id of ZONE_IDS) {
      for (const seed of [1, 50, 999, 123456]) {
        const vibe = getRoomVibe(id, seed);
        expect(vibe.floorColor, id).not.toBe(vibe.wallColor);
      }
    }
  });

  it('is deterministic for the same zone and seed', () => {
    const a = getRoomVibe('mall', 4242);
    const b = getRoomVibe('mall', 4242);
    expect(a.floorColor).toBe(b.floorColor);
    expect(a.wallColor).toBe(b.wallColor);
  });

  it('varies the palette room-to-room within a single zone (never one shared palette)', () => {
    const floors = new Set();
    for (let seed = 0; seed < 100; seed++) {
      floors.add(getRoomVibe('mall', seed).floorColor);
    }
    expect(floors.size).toBeGreaterThan(1);
  });

  it('keeps each zone visually distinct from the others', () => {
    // Zone base palettes are separated by more than the per-room jitter, so the
    // jittered colours never collide between zones for any seed.
    for (const seed of [7, 8080]) {
      const combos = new Set(ZONE_IDS.map(id => {
        const v = getRoomVibe(id, seed);
        return `${v.floorColor}-${v.wallColor}`;
      }));
      expect(combos.size).toBe(ZONE_IDS.length);
    }
  });

  it('reports the zone id it was asked for', () => {
    for (const id of ZONE_IDS) {
      expect(getRoomVibe(id, 11).id).toBe(id);
    }
  });

  it('falls back to a real vibe for an unknown zone id rather than crashing', () => {
    const vibe = getRoomVibe('not-a-zone', 11);
    expect(ZONES[vibe.id]).toBeDefined();
    expect(typeof vibe.floorColor).toBe('number');
  });
});
