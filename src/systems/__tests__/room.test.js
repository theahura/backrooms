import { describe, it, expect } from 'vitest';
import { createRoomWalls } from '../room.js';

describe('createRoomWalls', () => {
  it('wall segments form a closed boundary', () => {
    const walls = createRoomWalls(0, 0, 100, 80);

    for (let i = 0; i < walls.length; i++) {
      const current = walls[i];
      const next = walls[(i + 1) % walls.length];
      expect(current.x2).toBeCloseTo(next.x1, 5);
      expect(current.y2).toBeCloseTo(next.y1, 5);
    }
  });

  it('wall segments match the specified dimensions', () => {
    const walls = createRoomWalls(10, 20, 200, 150);

    const allX = walls.flatMap(w => [w.x1, w.x2]);
    const allY = walls.flatMap(w => [w.y1, w.y2]);
    expect(Math.min(...allX)).toBe(10);
    expect(Math.max(...allX)).toBe(210);
    expect(Math.min(...allY)).toBe(20);
    expect(Math.max(...allY)).toBe(170);
  });

  it('no doors produces same result as before', () => {
    const withoutDoors = createRoomWalls(0, 0, 100, 80);
    const withEmptyDoors = createRoomWalls(0, 0, 100, 80, []);
    expect(withoutDoors).toEqual(withEmptyDoors);
    expect(withoutDoors).toHaveLength(4);
  });

  it('a door on the north wall splits it into two segments with a gap', () => {
    const walls = createRoomWalls(0, 0, 200, 100, [
      { wall: 'north', offset: 60, width: 40 }
    ]);

    const northSegments = walls.filter(w => w.y1 === 0 && w.y2 === 0);
    expect(northSegments).toHaveLength(2);

    const leftSeg = northSegments.find(s => s.x1 === 0);
    expect(leftSeg.x2).toBe(60);

    const rightSeg = northSegments.find(s => s.x2 === 200);
    expect(rightSeg.x1).toBe(100);
  });

  it('a door on the east wall splits it with a gap', () => {
    const walls = createRoomWalls(0, 0, 200, 100, [
      { wall: 'east', offset: 20, width: 30 }
    ]);

    const eastSegments = walls.filter(w => w.x1 === 200 && w.x2 === 200);
    expect(eastSegments).toHaveLength(2);

    const topSeg = eastSegments.find(s => s.y1 === 0);
    expect(topSeg.y2).toBe(20);

    const bottomSeg = eastSegments.find(s => s.y2 === 100);
    expect(bottomSeg.y1).toBe(50);
  });

  it('doors on multiple walls produce correct total segment count', () => {
    const walls = createRoomWalls(0, 0, 200, 100, [
      { wall: 'north', offset: 50, width: 40 },
      { wall: 'south', offset: 80, width: 40 }
    ]);

    expect(walls).toHaveLength(6);
  });

  it('door flush against wall start produces only one segment on that wall', () => {
    const walls = createRoomWalls(0, 0, 200, 100, [
      { wall: 'north', offset: 0, width: 40 }
    ]);

    const northSegments = walls.filter(w => w.y1 === 0 && w.y2 === 0);
    expect(northSegments).toHaveLength(1);
    expect(northSegments[0].x1).toBe(40);
    expect(northSegments[0].x2).toBe(200);
  });

  it('door flush against wall end produces only one segment on that wall', () => {
    const walls = createRoomWalls(0, 0, 200, 100, [
      { wall: 'north', offset: 160, width: 40 }
    ]);

    const northSegments = walls.filter(w => w.y1 === 0 && w.y2 === 0);
    expect(northSegments).toHaveLength(1);
    expect(northSegments[0].x1).toBe(0);
    expect(northSegments[0].x2).toBe(160);
  });
});
