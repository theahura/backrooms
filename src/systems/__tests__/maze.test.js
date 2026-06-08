import { describe, it, expect } from 'vitest';
import { getRoomType, generateMazeWalls, generateColumns } from '../maze.js';

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

describe('generateMazeWalls', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;
  const doors = [{ wall: 'east', offset: 400, width: 80, targetRoomId: 1 }];

  it('returns non-zero-length wall segments for a maze-type room', () => {
    const mazeSeed = findSeedForType('maze');
    expect(mazeSeed).not.toBeNull();

    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) {
      const length = Math.sqrt((seg.x2 - seg.x1) ** 2 + (seg.y2 - seg.y1) ** 2);
      expect(length).toBeGreaterThan(0);
    }
  });

  it('returns empty array for open-type rooms', () => {
    const openSeed = findSeedForType('open');
    expect(openSeed).not.toBeNull();

    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, openSeed, doors);
    expect(segments).toHaveLength(0);
  });

  it('all generated segments are within room interior bounds', () => {
    const mazeSeed = findSeedForType('maze');
    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    const innerMinX = ROOM_X + WALL_THICKNESS;
    const innerMinY = ROOM_Y + WALL_THICKNESS;
    const innerMaxX = ROOM_X + ROOM_WIDTH - WALL_THICKNESS;
    const innerMaxY = ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS;

    for (const seg of segments) {
      expect(seg.x1).toBeGreaterThanOrEqual(innerMinX);
      expect(seg.x2).toBeLessThanOrEqual(innerMaxX);
      expect(seg.y1).toBeGreaterThanOrEqual(innerMinY);
      expect(seg.y2).toBeLessThanOrEqual(innerMaxY);
    }
  });

  it('no single wall spans the full room width or height (gaps exist)', () => {
    const mazeSeed = findSeedForType('maze');
    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    const innerWidth = ROOM_WIDTH - 2 * WALL_THICKNESS;
    const innerHeight = ROOM_HEIGHT - 2 * WALL_THICKNESS;

    for (const seg of segments) {
      const segLength = Math.sqrt((seg.x2 - seg.x1) ** 2 + (seg.y2 - seg.y1) ** 2);
      expect(segLength).toBeLessThan(Math.max(innerWidth, innerHeight));
    }
  });

  it('does not generate walls that block door zones', () => {
    const mazeSeed = findSeedForType('maze');
    const testDoors = [
      { wall: 'north', offset: 500, width: 80, targetRoomId: 1 },
      { wall: 'south', offset: 300, width: 80, targetRoomId: 2 },
    ];

    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, testDoors);
    assertNoDoorZoneCrossing(segments, testDoors, ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS);
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

  it('produces non-zero wall segments', () => {
    const seed = findSeedForType('corridor');
    expect(seed).not.toBeNull();

    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    expect(segments.length).toBeGreaterThan(0);
  });

  it('produces more subdivisions than basic maze type', () => {
    const corridorSeed = findSeedForType('corridor');
    const mazeSeed = findSeedForType('maze');

    const corridorSegs = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, corridorSeed, doors);
    const mazeSegs = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    expect(corridorSegs.length).toBeGreaterThan(mazeSegs.length);
  });

  it('all segments are within room interior bounds', () => {
    const seed = findSeedForType('corridor');
    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const innerMinX = ROOM_X + WALL_THICKNESS;
    const innerMinY = ROOM_Y + WALL_THICKNESS;
    const innerMaxX = ROOM_X + ROOM_WIDTH - WALL_THICKNESS;
    const innerMaxY = ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS;

    for (const seg of segments) {
      expect(seg.x1).toBeGreaterThanOrEqual(innerMinX);
      expect(seg.x2).toBeLessThanOrEqual(innerMaxX);
      expect(seg.y1).toBeGreaterThanOrEqual(innerMinY);
      expect(seg.y2).toBeLessThanOrEqual(innerMaxY);
    }
  });

  it('does not generate segments that cross door zones', () => {
    const seed = findSeedForType('corridor');
    const testDoors = [
      { wall: 'north', offset: 500, width: 80, targetRoomId: 1 },
      { wall: 'west', offset: 300, width: 80, targetRoomId: 2 },
    ];
    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, testDoors);
    assertNoDoorZoneCrossing(segments, testDoors, ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS);
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

  it('produces non-zero wall segments', () => {
    const seed = findSeedForType('storage');
    expect(seed).not.toBeNull();

    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    expect(segments.length).toBeGreaterThan(0);
  });

  it('produces only short segments (individual crate sides)', () => {
    const seed = findSeedForType('storage');
    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);

    for (const seg of segments) {
      const length = Math.sqrt((seg.x2 - seg.x1) ** 2 + (seg.y2 - seg.y1) ** 2);
      expect(length).toBeLessThanOrEqual(80);
    }
  });

  it('generates obstacles spread across multiple positions in the room', () => {
    const seed = findSeedForType('storage');
    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const uniqueXPositions = new Set(segments.map(s => Math.round(s.x1 / 100)));
    const uniqueYPositions = new Set(segments.map(s => Math.round(s.y1 / 100)));
    expect(uniqueXPositions.size).toBeGreaterThan(2);
    expect(uniqueYPositions.size).toBeGreaterThan(2);
  });

  it('all segments are within room interior bounds with margin', () => {
    const seed = findSeedForType('storage');
    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const margin = WALL_THICKNESS + 40;
    const innerMinX = ROOM_X + margin;
    const innerMinY = ROOM_Y + margin;
    const innerMaxX = ROOM_X + ROOM_WIDTH - margin;
    const innerMaxY = ROOM_Y + ROOM_HEIGHT - margin;

    for (const seg of segments) {
      expect(Math.min(seg.x1, seg.x2)).toBeGreaterThanOrEqual(innerMinX);
      expect(Math.max(seg.x1, seg.x2)).toBeLessThanOrEqual(innerMaxX);
      expect(Math.min(seg.y1, seg.y2)).toBeGreaterThanOrEqual(innerMinY);
      expect(Math.max(seg.y1, seg.y2)).toBeLessThanOrEqual(innerMaxY);
    }
  });

  it('does not generate segments that cross door zones', () => {
    const seed = findSeedForType('storage');
    const testDoors = [
      { wall: 'south', offset: 600, width: 80, targetRoomId: 1 },
      { wall: 'east', offset: 200, width: 80, targetRoomId: 2 },
    ];
    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, testDoors);
    assertNoDoorZoneCrossing(segments, testDoors, ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS);
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

  it('produces non-zero wall segments', () => {
    const seed = findSeedForType('cubicles');
    expect(seed).not.toBeNull();

    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    expect(segments.length).toBeGreaterThan(0);
  });

  it('produces uniform-length segments (partition walls are all the same size)', () => {
    const seed = findSeedForType('cubicles');
    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const lengths = segments.map(s => Math.round(Math.sqrt((s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2)));
    const uniqueLengths = new Set(lengths);
    expect(uniqueLengths.size).toBe(1);
  });

  it('all segments are within room interior bounds with margin', () => {
    const seed = findSeedForType('cubicles');
    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const margin = WALL_THICKNESS + 40;
    const innerMinX = ROOM_X + margin;
    const innerMinY = ROOM_Y + margin;
    const innerMaxX = ROOM_X + ROOM_WIDTH - margin;
    const innerMaxY = ROOM_Y + ROOM_HEIGHT - margin;

    for (const seg of segments) {
      expect(Math.min(seg.x1, seg.x2)).toBeGreaterThanOrEqual(innerMinX);
      expect(Math.max(seg.x1, seg.x2)).toBeLessThanOrEqual(innerMaxX);
      expect(Math.min(seg.y1, seg.y2)).toBeGreaterThanOrEqual(innerMinY);
      expect(Math.max(seg.y1, seg.y2)).toBeLessThanOrEqual(innerMaxY);
    }
  });

  it('does not generate segments that cross door zones', () => {
    const seed = findSeedForType('cubicles');
    const testDoors = [
      { wall: 'north', offset: 300, width: 80, targetRoomId: 1 },
      { wall: 'south', offset: 800, width: 80, targetRoomId: 2 },
      { wall: 'west', offset: 450, width: 80, targetRoomId: 3 },
    ];
    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, testDoors);
    assertNoDoorZoneCrossing(segments, testDoors, ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS);
  });

  it('is deterministic for the same seed', () => {
    const seed = findSeedForType('cubicles');
    const result1 = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    const result2 = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, doors);
    expect(result1).toEqual(result2);
  });
});

function assertNoDoorZoneCrossing(segments, testDoors, roomX, roomY, roomWidth, roomHeight, wallThickness) {
  const doorZones = testDoors.map(d => {
    if (d.wall === 'north') return { x: roomX + d.offset, y: roomY, width: d.width, height: 80 + wallThickness };
    if (d.wall === 'south') return { x: roomX + d.offset, y: roomY + roomHeight - 80 - wallThickness, width: d.width, height: 80 + wallThickness };
    if (d.wall === 'east') return { x: roomX + roomWidth - 80 - wallThickness, y: roomY + d.offset, width: 80 + wallThickness, height: d.width };
    return { x: roomX, y: roomY + d.offset, width: 80 + wallThickness, height: d.width };
  });

  for (const seg of segments) {
    for (const zone of doorZones) {
      const segIsHorizontal = Math.abs(seg.y2 - seg.y1) < 1;
      const segIsVertical = Math.abs(seg.x2 - seg.x1) < 1;
      if (segIsHorizontal) {
        const minX = Math.min(seg.x1, seg.x2);
        const maxX = Math.max(seg.x1, seg.x2);
        const crossesZone = maxX > zone.x && minX < zone.x + zone.width && seg.y1 > zone.y && seg.y1 < zone.y + zone.height;
        expect(crossesZone).toBe(false);
      } else if (segIsVertical) {
        const minY = Math.min(seg.y1, seg.y2);
        const maxY = Math.max(seg.y1, seg.y2);
        const crossesZone = maxY > zone.y && minY < zone.y + zone.height && seg.x1 > zone.x && seg.x1 < zone.x + zone.width;
        expect(crossesZone).toBe(false);
      }
    }
  }
}
