import { describe, it, expect } from 'vitest';
import { getRoomType, generateMazeWalls, generateColumns } from '../maze.js';

describe('getRoomType', () => {
  it('returns one of open, maze, or columns', () => {
    for (let seed = 0; seed < 50; seed++) {
      const type = getRoomType(seed);
      expect(['open', 'maze', 'columns']).toContain(type);
    }
  });

  it('is deterministic for the same seed', () => {
    const type1 = getRoomType(42);
    const type2 = getRoomType(42);
    expect(type1).toBe(type2);
  });

  it('produces variety across different seeds', () => {
    const types = new Set();
    for (let seed = 0; seed < 100; seed++) {
      types.add(getRoomType(seed));
    }
    expect(types.size).toBe(3);
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
    let mazeSeed = null;
    for (let s = 0; s < 100; s++) {
      if (getRoomType(s) === 'maze') { mazeSeed = s; break; }
    }
    expect(mazeSeed).not.toBeNull();

    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) {
      const length = Math.sqrt((seg.x2 - seg.x1) ** 2 + (seg.y2 - seg.y1) ** 2);
      expect(length).toBeGreaterThan(0);
    }
  });

  it('returns empty array for open-type rooms', () => {
    let openSeed = null;
    for (let s = 0; s < 100; s++) {
      if (getRoomType(s) === 'open') { openSeed = s; break; }
    }
    expect(openSeed).not.toBeNull();

    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, openSeed, doors);
    expect(segments).toHaveLength(0);
  });

  it('all generated segments are within room interior bounds', () => {
    let mazeSeed = null;
    for (let s = 0; s < 100; s++) {
      if (getRoomType(s) === 'maze') { mazeSeed = s; break; }
    }

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
    let mazeSeed = null;
    for (let s = 0; s < 100; s++) {
      if (getRoomType(s) === 'maze') { mazeSeed = s; break; }
    }

    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, doors);
    const innerWidth = ROOM_WIDTH - 2 * WALL_THICKNESS;
    const innerHeight = ROOM_HEIGHT - 2 * WALL_THICKNESS;

    for (const seg of segments) {
      const segLength = Math.sqrt((seg.x2 - seg.x1) ** 2 + (seg.y2 - seg.y1) ** 2);
      expect(segLength).toBeLessThan(Math.max(innerWidth, innerHeight));
    }
  });

  it('does not generate walls that block door zones', () => {
    let mazeSeed = null;
    for (let s = 0; s < 100; s++) {
      if (getRoomType(s) === 'maze') { mazeSeed = s; break; }
    }

    const testDoors = [
      { wall: 'north', offset: 500, width: 80, targetRoomId: 1 },
      { wall: 'south', offset: 300, width: 80, targetRoomId: 2 },
    ];

    const segments = generateMazeWalls(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, mazeSeed, testDoors);

    // Door entry zones extend 80px into the room from the door opening
    const doorZones = testDoors.map(d => {
      if (d.wall === 'north') {
        return { x: ROOM_X + d.offset, y: ROOM_Y, width: d.width, height: 80 + WALL_THICKNESS };
      } else if (d.wall === 'south') {
        return { x: ROOM_X + d.offset, y: ROOM_Y + ROOM_HEIGHT - 80 - WALL_THICKNESS, width: d.width, height: 80 + WALL_THICKNESS };
      } else if (d.wall === 'east') {
        return { x: ROOM_X + ROOM_WIDTH - 80 - WALL_THICKNESS, y: ROOM_Y + d.offset, width: 80 + WALL_THICKNESS, height: d.width };
      } else {
        return { x: ROOM_X, y: ROOM_Y + d.offset, width: 80 + WALL_THICKNESS, height: d.width };
      }
    });

    for (const seg of segments) {
      for (const zone of doorZones) {
        // Check if segment crosses the door zone
        const segIsHorizontal = Math.abs(seg.y2 - seg.y1) < 1;
        const segIsVertical = Math.abs(seg.x2 - seg.x1) < 1;

        if (segIsHorizontal) {
          const minX = Math.min(seg.x1, seg.x2);
          const maxX = Math.max(seg.x1, seg.x2);
          const y = seg.y1;
          // Segment crosses zone if it overlaps in X and Y is within zone
          const crossesZone = maxX > zone.x && minX < zone.x + zone.width &&
                              y > zone.y && y < zone.y + zone.height;
          expect(crossesZone).toBe(false);
        } else if (segIsVertical) {
          const minY = Math.min(seg.y1, seg.y2);
          const maxY = Math.max(seg.y1, seg.y2);
          const x = seg.x1;
          const crossesZone = maxY > zone.y && minY < zone.y + zone.height &&
                              x > zone.x && x < zone.x + zone.width;
          expect(crossesZone).toBe(false);
        }
      }
    }
  });

  it('is deterministic for the same seed', () => {
    let mazeSeed = null;
    for (let s = 0; s < 100; s++) {
      if (getRoomType(s) === 'maze') { mazeSeed = s; break; }
    }

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
    let colSeed = null;
    for (let s = 0; s < 100; s++) {
      if (getRoomType(s) === 'columns') { colSeed = s; break; }
    }
    expect(colSeed).not.toBeNull();

    const columns = generateColumns(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, colSeed);
    expect(columns.length).toBeGreaterThan(2);
    for (const col of columns) {
      expect(col.size).toBeGreaterThan(0);
    }
  });

  it('all columns are within room interior bounds', () => {
    let colSeed = null;
    for (let s = 0; s < 100; s++) {
      if (getRoomType(s) === 'columns') { colSeed = s; break; }
    }

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
    let colSeed = null;
    for (let s = 0; s < 100; s++) {
      if (getRoomType(s) === 'columns') { colSeed = s; break; }
    }

    const result1 = generateColumns(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, colSeed);
    const result2 = generateColumns(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, colSeed);
    expect(result1).toEqual(result2);
  });
});
