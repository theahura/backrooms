import { describe, it, expect } from 'vitest';
import { ZONES, getRoomVibe } from '../roomVibes.js';
import { ZONE_IDS } from '../zones.js';
import { FURNITURE_TYPES, planScene } from '../furniture.js';

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

  it('every zone places a coherent scene into a room', () => {
    for (const id of ZONE_IDS) {
      const { items, clearing } = planScene(0, 0, 720, 600, 16, 7, ZONES[id].furniture.scenes);
      expect(items.length, id).toBeGreaterThan(0);
      expect(clearing, id).not.toBeNull();
    }
  });

  it('only references furniture types that exist', () => {
    for (const id of ZONE_IDS) {
      const profile = ZONES[id].furniture;
      for (const scene of profile.scenes) {
        for (const piece of scene.pieces) {
          expect(FURNITURE_TYPES[piece.type], `${id} scene ${scene.name} type ${piece.type}`).toBeDefined();
        }
      }
      for (const type of profile.ambient) {
        expect(FURNITURE_TYPES[type], `${id} ambient type ${type}`).toBeDefined();
      }
    }
  });

  it('never lets a scene overlap its own pieces (footprints)', () => {
    const overlaps = (a, b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (const id of ZONE_IDS) {
      for (const scene of ZONES[id].furniture.scenes) {
        const rects = scene.pieces.map(p => ({
          x: p.dx, y: p.dy,
          w: FURNITURE_TYPES[p.type].width, h: FURNITURE_TYPES[p.type].height,
        }));
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(overlaps(rects[i], rects[j]), `${id} scene ${scene.name} self-overlap`).toBe(false);
          }
        }
      }
    }
  });

  it('keeps hero set-piece props out of the ambient scatter pool', () => {
    // Big structural props must only appear inside a designed scene, never
    // scattered alone -- a lone reception desk in a random spot reads as broken.
    const HERO = new Set(['reception_desk', 'forklift', 'pallet_rack', 'cubicle_partition',
      'ice_machine', 'mall_directory', 'bed', 'counter', 'lockers']);
    for (const id of ZONE_IDS) {
      for (const type of ZONES[id].furniture.ambient) {
        expect(HERO.has(type), `${id} scatters hero prop ${type}`).toBe(false);
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
