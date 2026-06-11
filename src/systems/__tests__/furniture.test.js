import { describe, it, expect } from 'vitest';
import { createFurnitureSegments, generateRoomFurniture, FURNITURE_TYPES, blocksBullets } from '../furniture.js';
import { getFlashlightPolygon } from '../visibility.js';
import { createRoomWalls } from '../room.js';
import { findNearestHideable } from '../hiding.js';

describe('createFurnitureSegments', () => {
  it('returns 4 segments forming a closed boundary', () => {
    const segments = createFurnitureSegments(50, 50, 80, 40);

    expect(segments).toHaveLength(4);
    for (let i = 0; i < segments.length; i++) {
      const current = segments[i];
      const next = segments[(i + 1) % segments.length];
      expect(current.x2).toBeCloseTo(next.x1, 5);
      expect(current.y2).toBeCloseTo(next.y1, 5);
    }
  });

  it('segments span the correct dimensions', () => {
    const segments = createFurnitureSegments(30, 40, 100, 60);

    const allX = segments.flatMap(s => [s.x1, s.x2]);
    const allY = segments.flatMap(s => [s.y1, s.y2]);
    expect(Math.min(...allX)).toBe(30);
    expect(Math.max(...allX)).toBe(130);
    expect(Math.min(...allY)).toBe(40);
    expect(Math.max(...allY)).toBe(100);
  });
});

describe('generateRoomFurniture', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;

  it('returns furniture items within room bounds', () => {
    const furniture = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42);

    expect(furniture.length).toBeGreaterThan(0);

    for (const item of furniture) {
      expect(item.x).toBeGreaterThanOrEqual(ROOM_X + WALL_THICKNESS);
      expect(item.y).toBeGreaterThanOrEqual(ROOM_Y + WALL_THICKNESS);
      expect(item.x + item.width).toBeLessThanOrEqual(ROOM_X + ROOM_WIDTH - WALL_THICKNESS);
      expect(item.y + item.height).toBeLessThanOrEqual(ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS);
    }
  });

  it('produces no overlapping furniture', () => {
    for (const seed of [3, 11, 42, 99]) {
      const furniture = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed);

      for (let i = 0; i < furniture.length; i++) {
        for (let j = i + 1; j < furniture.length; j++) {
          const a = furniture[i];
          const b = furniture[j];
          const overlaps =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
          expect(overlaps, `seed ${seed}`).toBe(false);
        }
      }
    }
  });

  it('produces deterministic output for the same seed', () => {
    const first = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99);
    const second = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99);

    expect(first).toEqual(second);
  });

  it('produces different output for different seeds', () => {
    const first = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 1);
    const second = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 2);

    expect(first).not.toEqual(second);
  });

});

describe('furniture light blocking behavior', () => {
  it('a table between origin and far wall does NOT reduce visible polygon reach', () => {
    const roomSegments = createRoomWalls(0, 0, 200, 200);
    const tableSegments = createFurnitureSegments(80, 80, 80, 50);
    // Only include segments for light-blocking furniture
    const blocksLight = FURNITURE_TYPES.table.blocksLight;
    const allSegments = blocksLight ? [...roomSegments, ...tableSegments] : roomSegments;

    const origin = { x: 50, y: 100 };
    const angle = 0;
    const coneAngle = Math.PI / 6;

    const polyWithTable = getFlashlightPolygon(origin, angle, coneAngle, allSegments);
    const polyWithoutTable = getFlashlightPolygon(origin, angle, coneAngle, roomSegments);

    const maxXWith = Math.max(...polyWithTable.map(p => p.x));
    const maxXWithout = Math.max(...polyWithoutTable.map(p => p.x));

    // Table should NOT block light (same reach)
    expect(maxXWith).toBe(maxXWithout);
  });

  it('a shelf between origin and far wall DOES reduce visible polygon reach', () => {
    // Use a large room with a shelf that fully blocks a narrow cone
    const roomSegments = createRoomWalls(0, 0, 600, 200);
    // Wide shelf spanning most of the room, positioned to block a narrow cone aimed right
    const shelfSegments = createFurnitureSegments(100, 70, 20, 60);
    const blocksLight = FURNITURE_TYPES.shelf.blocksLight;
    const allSegments = blocksLight ? [...roomSegments, ...shelfSegments] : roomSegments;

    const origin = { x: 50, y: 100 };
    const angle = 0;
    const coneAngle = Math.PI / 16;

    const polyWithShelf = getFlashlightPolygon(origin, angle, coneAngle, allSegments);
    const polyWithoutShelf = getFlashlightPolygon(origin, angle, coneAngle, roomSegments);

    const maxXWith = Math.max(...polyWithShelf.map(p => p.x));
    const maxXWithout = Math.max(...polyWithoutShelf.map(p => p.x));

    expect(maxXWith).toBeLessThan(maxXWithout);
  });
});

describe('new hiding furniture types', () => {
  it('generated rooms can contain new furniture types', () => {
    const allTypes = new Set();
    for (let seed = 0; seed < 200; seed++) {
      const furniture = generateRoomFurniture(0, 0, 1200, 1000, 16, seed);
      for (const item of furniture) {
        allTypes.add(item.type);
      }
    }
    expect(allTypes.has('bed')).toBe(true);
    expect(allTypes.has('armoire')).toBe(true);
    expect(allTypes.has('closet')).toBe(true);
    expect(allTypes.has('vent')).toBe(true);
  });

  it('generated rooms produce all new types as hideable and findable', () => {
    const hideableTypes = new Set();
    for (let seed = 0; seed < 200; seed++) {
      const furniture = generateRoomFurniture(0, 0, 1200, 1000, 16, seed);
      const furnitureMap = new Map([[0, furniture]]);
      for (const item of furniture) {
        const cx = item.x + item.width / 2;
        const cy = item.y + item.height / 2;
        const result = findNearestHideable(furnitureMap, cx, cy, 80);
        if (result) hideableTypes.add(result.furniture.type);
      }
    }
    expect(hideableTypes.has('bed')).toBe(true);
    expect(hideableTypes.has('armoire')).toBe(true);
    expect(hideableTypes.has('closet')).toBe(true);
    expect(hideableTypes.has('vent')).toBe(true);
  });

  it('armoire and closet have blocksLight true in FURNITURE_TYPES', () => {
    expect(FURNITURE_TYPES.armoire.blocksLight).toBe(true);
    expect(FURNITURE_TYPES.closet.blocksLight).toBe(true);
  });

  it('bed and vent have blocksLight false in FURNITURE_TYPES', () => {
    expect(FURNITURE_TYPES.bed.blocksLight).toBe(false);
    expect(FURNITURE_TYPES.vent.blocksLight).toBe(false);
  });
});

describe('furniture blocks flashlight rays', () => {
  it('a furniture item between origin and far wall reduces visible polygon reach', () => {
    const roomSegments = createRoomWalls(0, 0, 200, 200);
    const furnitureSegments = createFurnitureSegments(80, 80, 40, 40);
    const allSegments = [...roomSegments, ...furnitureSegments];

    const origin = { x: 50, y: 100 };
    const angle = 0;
    const coneAngle = Math.PI / 6;

    const polyWithFurniture = getFlashlightPolygon(origin, angle, coneAngle, allSegments);
    const polyWithoutFurniture = getFlashlightPolygon(origin, angle, coneAngle, roomSegments);

    const maxXWith = Math.max(...polyWithFurniture.map(p => p.x));
    const maxXWithout = Math.max(...polyWithoutFurniture.map(p => p.x));

    expect(maxXWith).toBeLessThan(maxXWithout);
  });
});

describe('liminal furnishing', () => {
  const W = 720;
  const H = 600;
  const WALL = 16;

  it('fills a small room densely enough to feel inhabited', () => {
    for (const seed of [3, 11, 42, 99]) {
      const items = generateRoomFurniture(0, 0, W, H, WALL, seed);
      expect(items.length, `seed ${seed}`).toBeGreaterThanOrEqual(8);
    }
  });

});

describe('vibe-driven furnishing', () => {
  // Real shipped room dimensions (worldgen.js ROOM_WIDTH/ROOM_HEIGHT), so the
  // tests track production rather than an oversized room.
  const W = 720;
  const H = 600;
  const WALL = 16;

  const forestProfile = {
    clusters: [
      [
        { type: 'tree', dx: 0, dy: 0 },
        { type: 'tree', dx: 90, dy: 0 },
        { type: 'rock', dx: 0, dy: 80 },
      ],
    ],
    singletons: ['tree', 'rock', 'bush'],
  };

  it('a custom profile only places furniture types from that profile', () => {
    const allowed = new Set(['tree', 'rock', 'bush']);
    for (const seed of [1, 7, 23, 88]) {
      const furniture = generateRoomFurniture(0, 0, W, H, WALL, seed, forestProfile);
      expect(furniture.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const item of furniture) {
        expect(allowed.has(item.type), `seed ${seed} got ${item.type}`).toBe(true);
      }
    }
  });

  it('is deterministic with a profile', () => {
    const a = generateRoomFurniture(0, 0, W, H, WALL, 55, forestProfile);
    const b = generateRoomFurniture(0, 0, W, H, WALL, 55, forestProfile);
    expect(a).toEqual(b);
  });

  it('falls back to the default generic profile when none is given', () => {
    // The default mix still contains office/bedroom pieces, never forest ones.
    const types = new Set();
    for (let seed = 0; seed < 80; seed++) {
      for (const item of generateRoomFurniture(0, 0, W, H, WALL, seed)) types.add(item.type);
    }
    expect(types.has('desk')).toBe(true);
    expect(types.has('tree')).toBe(false);
  });
});

describe('new vibe furniture types', () => {
  it('forest types have correct light/hide properties', () => {
    expect(FURNITURE_TYPES.tree.blocksLight).toBe(true);
    expect(FURNITURE_TYPES.tree.canHide).toBe(false);
    expect(FURNITURE_TYPES.rock.blocksLight).toBe(true);
    expect(FURNITURE_TYPES.bush.canHide).toBe(true);
    expect(FURNITURE_TYPES.bush.blocksLight).toBe(false);
  });

  it('spaceship types have correct light/hide properties', () => {
    expect(FURNITURE_TYPES.console.blocksLight).toBe(true);
    expect(FURNITURE_TYPES.console.canHide).toBe(false);
    expect(FURNITURE_TYPES.pod.canHide).toBe(true);
  });

  it('every new type has full dimensions and a colour', () => {
    for (const type of ['tree', 'rock', 'bush', 'console', 'pod']) {
      const def = FURNITURE_TYPES[type];
      expect(def.width, type).toBeGreaterThan(0);
      expect(def.height, type).toBeGreaterThan(0);
      expect(typeof def.color, type).toBe('number');
    }
  });
});

describe('blocksBullets', () => {
  // Low furniture you shoot across -- the spec's "tables and desks and low
  // furniture" that gunfire goes over.
  const LOW = ['table', 'desk', 'bed', 'vent', 'couch', 'bush', 'pod'];
  // Tall/solid cover -- the spec's "armoires and other furniture" that stops
  // gunfire.
  const TALL = ['armoire', 'closet', 'bookcase', 'shelf', 'counter', 'tree', 'rock', 'console'];

  it('lets gunfire pass over low furniture', () => {
    for (const type of LOW) {
      expect(blocksBullets(type), type).toBe(false);
    }
  });

  it('stops gunfire at tall, solid furniture', () => {
    for (const type of TALL) {
      expect(blocksBullets(type), type).toBe(true);
    }
  });

  it('does not stop gunfire on an unrecognised furniture type', () => {
    expect(blocksBullets('not_a_real_type')).toBe(false);
    expect(blocksBullets(undefined)).toBe(false);
  });

  it('classifies every furniture type as either low or tall', () => {
    // Guards against a new furniture type being added without deciding whether
    // gunfire passes over it -- the hand-authored LOW/TALL lists above are the
    // ground truth and must cover the whole catalogue.
    expect([...LOW, ...TALL].sort()).toEqual(Object.keys(FURNITURE_TYPES).sort());
  });
});
