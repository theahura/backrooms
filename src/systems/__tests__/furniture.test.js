import { describe, it, expect } from 'vitest';
import { createFurnitureSegments, generateRoomFurniture, FURNITURE_TYPES, blocksBullets, opaqueBounds, visibleFurnitureRect } from '../furniture.js';
import { generateMazeWalls, wallRectSegments, wallRectOccluders } from '../maze.js';
import { getFlashlightPolygon } from '../visibility.js';
import { createRoomWalls } from '../room.js';
import { findNearestHideable } from '../hiding.js';

describe('opaqueBounds', () => {
  // Build a flat RGBA buffer where a sub-rectangle is opaque and the rest is
  // transparent, mirroring an AI furniture PNG with transparent padding.
  function buildImage(width, height, opaque) {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const inside = x >= opaque.x && x < opaque.x + opaque.width &&
          y >= opaque.y && y < opaque.y + opaque.height;
        data[(y * width + x) * 4 + 3] = inside ? 255 : 0;
      }
    }
    return data;
  }

  it('finds the bounding box of the opaque pixels (transparent padding ignored)', () => {
    const data = buildImage(10, 10, { x: 3, y: 2, width: 4, height: 5 });
    expect(opaqueBounds(data, 10, 10)).toEqual({ x: 3, y: 2, width: 4, height: 5 });
  });

  it('returns the full image when every pixel is opaque', () => {
    const data = buildImage(8, 6, { x: 0, y: 0, width: 8, height: 6 });
    expect(opaqueBounds(data, 8, 6)).toEqual({ x: 0, y: 0, width: 8, height: 6 });
  });

  it('returns null when the image is fully transparent', () => {
    const data = new Uint8Array(4 * 4 * 4); // all zero alpha
    expect(opaqueBounds(data, 4, 4)).toBeNull();
  });
});

describe('light-blocking furniture illumination (Bug 6 / Bug 2)', () => {
  // Standard even-odd point-in-polygon test.
  function pointInPolygon(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = (yi > py) !== (yj > py) &&
        px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  it('lights the near face of a light-blocking furniture piece (sized to its visible art) instead of leaving it black', () => {
    // A real light-blocking, tall furniture type. Its occluder is the VISIBLE
    // art sub-rect (the same rect GameScene pushes for blocksLight furniture),
    // derived here via visibleFurnitureRect from the furniture module.
    const type = 'bookcase';
    expect(FURNITURE_TYPES[type].blocksLight).toBe(true);
    const def = FURNITURE_TYPES[type];
    const item = { type, x: 200, y: 100, width: def.width, height: def.height };
    const frac = { x: 0.2, y: 0.18, width: 0.6, height: 0.65 }; // padded art
    const occ = visibleFurnitureRect(item, frac);

    const origin = { x: occ.x - 100, y: occ.y + occ.height / 2 }; // to its left, facing it
    const aim = 0;
    const cone = Math.PI / 4;
    const nearFace = { x: occ.x + 2, y: origin.y }; // just inside the near (left) face

    // Old behavior: the full outline blocks the ray at the near face, so the
    // footprint falls OUTSIDE the lit polygon (renders black).
    const polyFull = getFlashlightPolygon(origin, aim, cone, wallRectSegments(occ), 300);
    expect(pointInPolygon(nearFace.x, nearFace.y, polyFull)).toBe(false);

    // New behavior: back-face culling drops the near face, so the cone reaches
    // across the piece to its far face and the near surface is lit.
    const polyCulled = getFlashlightPolygon(origin, aim, cone, wallRectOccluders(occ, origin), 300);
    expect(pointInPolygon(nearFace.x, nearFace.y, polyCulled)).toBe(true);
  });
});

describe('visibleFurnitureRect', () => {
  it('maps a normalized opaque box onto the furniture world rect', () => {
    const item = { x: 100, y: 200, width: 80, height: 40 };
    const frac = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    expect(visibleFurnitureRect(item, frac)).toEqual({ x: 120, y: 210, width: 40, height: 20 });
  });

  it('returns the full furniture rect when the art fills its texture', () => {
    const item = { x: 0, y: 0, width: 60, height: 160 };
    const frac = { x: 0, y: 0, width: 1, height: 1 };
    expect(visibleFurnitureRect(item, frac)).toEqual({ x: 0, y: 0, width: 60, height: 160 });
  });

  it('keeps the visible rect strictly inside the furniture rect for padded art', () => {
    const item = { x: 500, y: 300, width: 100, height: 120 };
    const frac = { x: 0.22, y: 0.175, width: 0.58, height: 0.667 };
    const r = visibleFurnitureRect(item, frac);
    expect(r.x).toBeGreaterThan(item.x);
    expect(r.y).toBeGreaterThan(item.y);
    expect(r.x + r.width).toBeLessThan(item.x + item.width);
    expect(r.y + r.height).toBeLessThan(item.y + item.height);
  });
});

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

describe('generateRoomFurniture obstacle avoidance', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;

  const overlaps = (a, b) =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  it('does not place furniture overlapping a supplied obstacle rect', () => {
    const obstacle = { x: 400, y: 300, width: 400, height: 400 };
    for (let seed = 0; seed < 120; seed++) {
      const furniture = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, undefined, [obstacle]);
      for (const item of furniture) {
        expect(overlaps(item, obstacle), `seed ${seed}`).toBe(false);
      }
    }
  });

  it('does not place furniture overlapping the real maze walls of the same room', () => {
    const doors = [{ wall: 'east', offset: 400, width: 80, targetRoomId: 1 }];
    for (let seed = 0; seed < 150; seed++) {
      const walls = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
      const furniture = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, undefined, walls);
      for (const item of furniture) {
        for (const wall of walls) {
          expect(overlaps(item, wall), `seed ${seed}`).toBe(false);
        }
      }
    }
  });

  it('produces the same furniture whether obstacles is omitted or passed empty', () => {
    for (const seed of [3, 11, 42, 99, 123]) {
      const omitted = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed);
      const empty = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, undefined, []);
      expect(empty, `seed ${seed}`).toEqual(omitted);
    }
  });

  it('still furnishes rooms when an obstacle leaves ample free space', () => {
    const obstacle = { x: 0, y: 0, width: 200, height: 200 };
    for (let seed = 0; seed < 30; seed++) {
      const furniture = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, undefined, [obstacle]);
      expect(furniture.length, `seed ${seed}`).toBeGreaterThanOrEqual(8);
    }
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
