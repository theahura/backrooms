import { describe, it, expect } from 'vitest';
import { getRoomType, generateMazeWalls, generateColumns, doorEntryZones } from '../maze.js';

const ALL_TYPES = ['open', 'maze', 'columns', 'corridor', 'storage', 'cubicles'];

function findSeedForType(type) {
  for (let s = 0; s < 200; s++) {
    if (getRoomType(s) === type) return s;
  }
  return null;
}

describe('getRoomType', () => {
  it('returns one of the six valid room types', () => {
    for (let seed = 0; seed < 50; seed++) {
      const type = getRoomType(seed);
      expect(ALL_TYPES).toContain(type);
    }
  });

  it('is deterministic for the same seed', () => {
    const type1 = getRoomType(42);
    const type2 = getRoomType(42);
    expect(type1).toBe(type2);
  });

  it('produces every type at least once across different seeds', () => {
    const types = new Set();
    for (let seed = 0; seed < 200; seed++) {
      types.add(getRoomType(seed));
    }
    for (const type of ALL_TYPES) {
      expect(types.has(type)).toBe(true);
    }
  });
});

describe('liminal room type distribution', () => {
  it('keeps plain open rooms rare', () => {
    let open = 0;
    for (let seed = 0; seed < 1000; seed++) {
      if (getRoomType(seed) === 'open') open++;
    }
    expect(open).toBeLessThanOrEqual(80);
    expect(open).toBeGreaterThan(0);
  });
});

describe('generateMazeWalls', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;
  const doors = [{ wall: 'east', offset: 400, width: 80, targetRoomId: 1 }];

  it('returns wall rects with positive area for a maze-type room', () => {
    const mazeSeed = findSeedForType('maze');
    expect(mazeSeed).not.toBeNull();

    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
    }
  });

  it('returns empty array for open-type rooms', () => {
    const openSeed = findSeedForType('open');
    expect(openSeed).not.toBeNull();

    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, openSeed, doors);
    expect(rects).toHaveLength(0);
  });

  it('subdivision walls are as thick as the drawn wall band', () => {
    const mazeSeed = findSeedForType('maze');
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    for (const rect of rects) {
      expect(Math.min(rect.width, rect.height)).toBe(WALL_THICKNESS);
    }
  });

  it('all wall rects stay within the room bounds', () => {
    const mazeSeed = findSeedForType('maze');
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(ROOM_X);
      expect(rect.x + rect.width).toBeLessThanOrEqual(ROOM_X + ROOM_WIDTH);
      expect(rect.y).toBeGreaterThanOrEqual(ROOM_Y);
      expect(rect.y + rect.height).toBeLessThanOrEqual(ROOM_Y + ROOM_HEIGHT);
    }
  });

  it('no single wall spans the full room width or height (gaps exist)', () => {
    const mazeSeed = findSeedForType('maze');
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    for (const rect of rects) {
      expect(rect.width).toBeLessThan(ROOM_WIDTH);
      expect(rect.height).toBeLessThan(ROOM_HEIGHT);
    }
  });

  it('walls never stop at the inner face of the perimeter band (no occluder-free junction slot)', () => {
    // A wall that reaches the maze area edge must continue through the drawn
    // perimeter band to the true room edge; otherwise light slips through the
    // visually-solid 16px junction between the wall band and the perimeter.
    const innerMinX = ROOM_X + WALL_THICKNESS;
    const innerMinY = ROOM_Y + WALL_THICKNESS;
    const innerMaxX = ROOM_X + ROOM_WIDTH - WALL_THICKNESS;
    const innerMaxY = ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS;

    let extendedToEdge = 0;
    for (let seed = 0; seed < 300; seed++) {
      const type = getRoomType(seed);
      if (type !== 'maze' && type !== 'corridor') continue;
      const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
      for (const rect of rects) {
        const vertical = rect.height > rect.width;
        if (vertical) {
          expect(rect.y === ROOM_Y || rect.y > innerMinY, `seed ${seed} rect top stops inside the perimeter band`).toBe(true);
          const bottom = rect.y + rect.height;
          expect(bottom === ROOM_Y + ROOM_HEIGHT || bottom < innerMaxY, `seed ${seed} rect bottom stops inside the perimeter band`).toBe(true);
          if (rect.y === ROOM_Y || bottom === ROOM_Y + ROOM_HEIGHT) extendedToEdge++;
        } else {
          expect(rect.x === ROOM_X || rect.x > innerMinX, `seed ${seed} rect left end stops inside the perimeter band`).toBe(true);
          const right = rect.x + rect.width;
          expect(right === ROOM_X + ROOM_WIDTH || right < innerMaxX, `seed ${seed} rect right end stops inside the perimeter band`).toBe(true);
          if (rect.x === ROOM_X || right === ROOM_X + ROOM_WIDTH) extendedToEdge++;
        }
      }
    }
    expect(extendedToEdge).toBeGreaterThan(0);
  });

  it('does not generate walls that block door zones', () => {
    const mazeSeed = findSeedForType('maze');
    const testDoors = [
      { wall: 'north', offset: 500, width: 80, targetRoomId: 1 },
      { wall: 'south', offset: 300, width: 80, targetRoomId: 2 },
    ];

    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, testDoors);
    assertNoDoorZoneOverlap(rects, testDoors, ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS);
  });

  it('is deterministic for the same seed', () => {
    const mazeSeed = findSeedForType('maze');
    const result1 = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    const result2 = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    expect(result1).toEqual(result2);
  });
});

describe('generateColumns', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;

  it('returns multiple columns for a columns-type room', () => {
    const colSeed = findSeedForType('columns');
    expect(colSeed).not.toBeNull();

    const columns = generateColumns(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, colSeed);
    expect(columns.length).toBeGreaterThan(2);
    for (const col of columns) {
      expect(col.size).toBeGreaterThan(0);
    }
  });

  it('all columns are within room interior bounds', () => {
    const colSeed = findSeedForType('columns');
    const columns = generateColumns(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, colSeed);
    const innerMinX = ROOM_X + WALL_THICKNESS + 40;
    const innerMinY = ROOM_Y + WALL_THICKNESS + 40;
    const innerMaxX = ROOM_X + ROOM_WIDTH - WALL_THICKNESS - 40;
    const innerMaxY = ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS - 40;

    for (const col of columns) {
      const half = col.size / 2;
      expect(col.x - half).toBeGreaterThanOrEqual(innerMinX);
      expect(col.x + half).toBeLessThanOrEqual(innerMaxX);
      expect(col.y - half).toBeGreaterThanOrEqual(innerMinY);
      expect(col.y + half).toBeLessThanOrEqual(innerMaxY);
    }
  });

  it('is deterministic for the same seed', () => {
    const colSeed = findSeedForType('columns');
    const result1 = generateColumns(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, colSeed);
    const result2 = generateColumns(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, colSeed);
    expect(result1).toEqual(result2);
  });
});

describe('corridor room type', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;
  const doors = [{ wall: 'east', offset: 400, width: 80, targetRoomId: 1 }];

  it('produces non-zero wall rects', () => {
    const seed = findSeedForType('corridor');
    expect(seed).not.toBeNull();

    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    expect(rects.length).toBeGreaterThan(0);
  });

  it('produces more subdivisions than basic maze type', () => {
    const corridorSeed = findSeedForType('corridor');
    const mazeSeed = findSeedForType('maze');

    const corridorRects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, corridorSeed, doors);
    const mazeRects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    expect(corridorRects.length).toBeGreaterThan(mazeRects.length);
  });

  it('all wall rects stay within the room bounds', () => {
    const seed = findSeedForType('corridor');
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(ROOM_X);
      expect(rect.x + rect.width).toBeLessThanOrEqual(ROOM_X + ROOM_WIDTH);
      expect(rect.y).toBeGreaterThanOrEqual(ROOM_Y);
      expect(rect.y + rect.height).toBeLessThanOrEqual(ROOM_Y + ROOM_HEIGHT);
    }
  });

  it('does not generate walls that overlap door zones', () => {
    const seed = findSeedForType('corridor');
    const testDoors = [
      { wall: 'north', offset: 500, width: 80, targetRoomId: 1 },
      { wall: 'west', offset: 300, width: 80, targetRoomId: 2 },
    ];
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, testDoors);
    assertNoDoorZoneOverlap(rects, testDoors, ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS);
  });

  it('is deterministic for the same seed', () => {
    const seed = findSeedForType('corridor');
    const result1 = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const result2 = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    expect(result1).toEqual(result2);
  });
});

describe('storage room type', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;
  const doors = [{ wall: 'east', offset: 400, width: 80, targetRoomId: 1 }];

  it('produces non-zero wall rects', () => {
    const seed = findSeedForType('storage');
    expect(seed).not.toBeNull();

    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    expect(rects.length).toBeGreaterThan(0);
  });

  it('produces crate-sized obstacles', () => {
    const seed = findSeedForType('storage');
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);

    for (const rect of rects) {
      expect(rect.width).toBeGreaterThanOrEqual(40);
      expect(rect.width).toBeLessThanOrEqual(80);
      expect(rect.height).toBeGreaterThanOrEqual(40);
      expect(rect.height).toBeLessThanOrEqual(60);
    }
  });

  it('generates obstacles spread across multiple positions in the room', () => {
    const seed = findSeedForType('storage');
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const uniqueXPositions = new Set(rects.map(r => Math.round(r.x / 100)));
    const uniqueYPositions = new Set(rects.map(r => Math.round(r.y / 100)));
    expect(uniqueXPositions.size).toBeGreaterThan(2);
    expect(uniqueYPositions.size).toBeGreaterThan(2);
  });

  it('all crates are within room interior bounds with margin', () => {
    const seed = findSeedForType('storage');
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const margin = WALL_THICKNESS + 40;

    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(ROOM_X + margin);
      expect(rect.x + rect.width).toBeLessThanOrEqual(ROOM_X + ROOM_WIDTH - margin);
      expect(rect.y).toBeGreaterThanOrEqual(ROOM_Y + margin);
      expect(rect.y + rect.height).toBeLessThanOrEqual(ROOM_Y + ROOM_HEIGHT - margin);
    }
  });

  it('does not generate crates that overlap door zones', () => {
    const seed = findSeedForType('storage');
    const testDoors = [
      { wall: 'south', offset: 600, width: 80, targetRoomId: 1 },
      { wall: 'east', offset: 200, width: 80, targetRoomId: 2 },
    ];
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, testDoors);
    assertNoDoorZoneOverlap(rects, testDoors, ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS);
  });

  it('is deterministic for the same seed', () => {
    const seed = findSeedForType('storage');
    const result1 = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const result2 = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    expect(result1).toEqual(result2);
  });
});

describe('cubicles room type', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;
  const doors = [{ wall: 'east', offset: 400, width: 80, targetRoomId: 1 }];

  it('produces non-zero wall rects', () => {
    const seed = findSeedForType('cubicles');
    expect(seed).not.toBeNull();

    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    expect(rects.length).toBeGreaterThan(0);
  });

  it('produces partition walls as thick as the drawn band', () => {
    const seed = findSeedForType('cubicles');
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    for (const rect of rects) {
      expect(Math.min(rect.width, rect.height)).toBe(WALL_THICKNESS);
      expect(Math.max(rect.width, rect.height)).toBeGreaterThan(80);
      expect(Math.max(rect.width, rect.height)).toBeLessThan(130);
    }
  });

  it('partition walls of the same cubicle overlap at their corners (no see-through corner gap)', () => {
    const seed = findSeedForType('cubicles');
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const overlaps = (a, b) =>
      a.x < b.x + b.width && a.x + a.width > b.x &&
      a.y < b.y + b.height && a.y + a.height > b.y;

    // Every perpendicular pair that forms a corner must share covered area, so
    // light cannot wrap a zero-width corner point inside the drawn walls.
    let cornerPairs = 0;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const perpendicular = (a.width > a.height) !== (b.width > b.height);
        if (!perpendicular) continue;
        const touches =
          a.x <= b.x + b.width && a.x + a.width >= b.x &&
          a.y <= b.y + b.height && a.y + a.height >= b.y;
        if (!touches) continue;
        cornerPairs++;
        expect(overlaps(a, b), `rects ${i} and ${j} touch but do not overlap`).toBe(true);
      }
    }
    expect(cornerPairs).toBeGreaterThan(0);
  });

  it('all partitions are within room interior bounds with margin', () => {
    const seed = findSeedForType('cubicles');
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const margin = WALL_THICKNESS + 40;

    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(ROOM_X + margin - WALL_THICKNESS / 2);
      expect(rect.x + rect.width).toBeLessThanOrEqual(ROOM_X + ROOM_WIDTH - margin + WALL_THICKNESS / 2);
      expect(rect.y).toBeGreaterThanOrEqual(ROOM_Y + margin - WALL_THICKNESS / 2);
      expect(rect.y + rect.height).toBeLessThanOrEqual(ROOM_Y + ROOM_HEIGHT - margin + WALL_THICKNESS / 2);
    }
  });

  it('does not generate partitions that overlap door zones', () => {
    const seed = findSeedForType('cubicles');
    const testDoors = [
      { wall: 'north', offset: 300, width: 80, targetRoomId: 1 },
      { wall: 'south', offset: 800, width: 80, targetRoomId: 2 },
      { wall: 'west', offset: 450, width: 80, targetRoomId: 3 },
    ];
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, testDoors);
    assertNoDoorZoneOverlap(rects, testDoors, ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS);
  });

  it('is deterministic for the same seed', () => {
    const seed = findSeedForType('cubicles');
    const result1 = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const result2 = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    expect(result1).toEqual(result2);
  });
});

describe('columns room type wall rects', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;
  const doors = [{ wall: 'east', offset: 400, width: 80, targetRoomId: 1 }];

  it('produces one square rect per column matching the column footprint', () => {
    const seed = findSeedForType('columns');
    const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const columns = generateColumns(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed);
    expect(rects.length).toBeGreaterThan(0);
    expect(rects.length).toBeLessThanOrEqual(columns.length);
    for (const rect of rects) {
      expect(rect.width).toBe(rect.height);
      const match = columns.find(c => c.x === rect.x + rect.width / 2 && c.y === rect.y + rect.height / 2);
      expect(match).toBeTruthy();
      expect(rect.width).toBe(match.size);
    }
  });
});

describe('generateMazeWalls keep-out zones', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;
  const doors = [{ wall: 'east', offset: 400, width: 80, targetRoomId: 1 }];

  const overlaps = (a, b) =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  it('produces no wall rect overlapping a supplied keep-out zone', () => {
    const keepOut = { x: 500, y: 400, width: 200, height: 200 };
    for (let seed = 0; seed < 300; seed++) {
      const rects = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors, [keepOut]);
      for (const rect of rects) {
        expect(overlaps(rect, keepOut), `seed ${seed}`).toBe(false);
      }
    }
  });

  it('produces the same walls whether keep-out is omitted or passed empty', () => {
    for (let seed = 0; seed < 50; seed++) {
      const omitted = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
      const empty = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors, []);
      expect(empty, `seed ${seed}`).toEqual(omitted);
    }
  });
});

describe('doorEntryZones', () => {
  const WALL_THICKNESS = 16;
  const room = {
    x: 0,
    y: 0,
    width: 1200,
    height: 1000,
    doors: [
      { wall: 'north', offset: 300, width: 80, targetRoomId: 1 },
      { wall: 'south', offset: 500, width: 80, targetRoomId: 2 },
      { wall: 'east', offset: 200, width: 80, targetRoomId: 3 },
      { wall: 'west', offset: 600, width: 80, targetRoomId: 4 },
    ],
  };

  it('returns one entry zone per door', () => {
    expect(doorEntryZones(room, WALL_THICKNESS)).toHaveLength(4);
  });

  it('places each entry zone against its door wall and extends it into the room', () => {
    const [north, south, east, west] = doorEntryZones(room, WALL_THICKNESS);

    // North door: zone hugs the top edge, spans the door, extends downward.
    expect(north.y).toBe(room.y);
    expect(north.x).toBe(room.x + 300);
    expect(north.width).toBe(80);
    expect(north.height).toBeGreaterThan(WALL_THICKNESS);

    // South door: zone reaches the bottom edge.
    expect(south.y + south.height).toBe(room.y + room.height);
    expect(south.x).toBe(room.x + 500);

    // East door: zone reaches the right edge, spans the door vertically.
    expect(east.x + east.width).toBe(room.x + room.width);
    expect(east.y).toBe(room.y + 200);
    expect(east.height).toBe(80);
    expect(east.width).toBeGreaterThan(WALL_THICKNESS);

    // West door: zone hugs the left edge.
    expect(west.x).toBe(room.x);
    expect(west.y).toBe(room.y + 600);
  });

  it('returns an empty array for a room with no doors', () => {
    expect(doorEntryZones({ x: 0, y: 0, width: 100, height: 100, doors: [] }, WALL_THICKNESS)).toEqual([]);
  });
});

function assertNoDoorZoneOverlap(rects, testDoors, roomX, roomY, roomWidth, roomHeight, wallThickness) {
  const doorZones = testDoors.map(d => {
    if (d.wall === 'north') return { x: roomX + d.offset, y: roomY, width: d.width, height: 80 + wallThickness };
    if (d.wall === 'south') return { x: roomX + d.offset, y: roomY + roomHeight - 80 - wallThickness, width: d.width, height: 80 + wallThickness };
    if (d.wall === 'east') return { x: roomX + roomWidth - 80 - wallThickness, y: roomY + d.offset, width: 80 + wallThickness, height: d.width };
    return { x: roomX, y: roomY + d.offset, width: 80 + wallThickness, height: d.width };
  });

  for (const rect of rects) {
    for (const zone of doorZones) {
      const overlap =
        rect.x < zone.x + zone.width && rect.x + rect.width > zone.x &&
        rect.y < zone.y + zone.height && rect.y + rect.height > zone.y;
      expect(overlap, `rect ${JSON.stringify(rect)} overlaps door zone ${JSON.stringify(zone)}`).toBe(false);
    }
  }
}
