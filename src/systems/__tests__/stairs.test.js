import { describe, it, expect } from 'vitest';
import { generateMultiFloorLevel, getFloorBounds, FLOOR_Y_OFFSET, STAIR_SIZE } from '../stairs.js';

describe('generateMultiFloorLevel', () => {
  const seed = 42;
  const floorRoomCounts = [4, 3];

  it('generates rooms across multiple floors with correct total count', () => {
    const { rooms } = generateMultiFloorLevel(seed, floorRoomCounts);
    expect(rooms.length).toBe(7);
  });

  it('assigns globally unique room IDs', () => {
    const { rooms } = generateMultiFloorLevel(seed, floorRoomCounts);
    const ids = rooms.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(rooms.length);
  });

  it('assigns floor field to each room matching its floor index', () => {
    const { rooms } = generateMultiFloorLevel(seed, floorRoomCounts);
    const floor0Rooms = rooms.filter(r => r.floor === 0);
    const floor1Rooms = rooms.filter(r => r.floor === 1);
    expect(floor0Rooms.length).toBe(4);
    expect(floor1Rooms.length).toBe(3);
  });

  it('offsets floor 1 rooms by FLOOR_Y_OFFSET in world Y position', () => {
    const { rooms } = generateMultiFloorLevel(seed, floorRoomCounts);
    const floor0MaxY = Math.max(...rooms.filter(r => r.floor === 0).map(r => r.y + r.height));
    const floor1MinY = Math.min(...rooms.filter(r => r.floor === 1).map(r => r.y));
    expect(floor1MinY).toBeGreaterThanOrEqual(FLOOR_Y_OFFSET);
    expect(floor1MinY - floor0MaxY).toBeGreaterThan(0);
  });

  it('creates at least two stair connections between floors', () => {
    const { stairs } = generateMultiFloorLevel(seed, floorRoomCounts);
    expect(stairs.length).toBeGreaterThanOrEqual(2);
  });

  it('stair connections use distinct rooms on each floor', () => {
    const { stairs } = generateMultiFloorLevel(seed, floorRoomCounts);
    if (stairs.length >= 2) {
      expect(stairs[0].fromRoomId).not.toBe(stairs[1].fromRoomId);
      expect(stairs[0].toRoomId).not.toBe(stairs[1].toRoomId);
    }
  });

  it('stair fromRoomId is never room 0 (starting room)', () => {
    const { stairs } = generateMultiFloorLevel(seed, floorRoomCounts);
    for (const stair of stairs) {
      expect(stair.fromRoomId).not.toBe(0);
    }
  });

  it('stair fromRoomId is on floor 0 and toRoomId is on floor 1', () => {
    const { rooms, stairs } = generateMultiFloorLevel(seed, floorRoomCounts);
    for (const stair of stairs) {
      const fromRoom = rooms.find(r => r.id === stair.fromRoomId);
      const toRoom = rooms.find(r => r.id === stair.toRoomId);
      expect(fromRoom.floor).toBe(0);
      expect(toRoom.floor).toBe(1);
    }
  });

  it('stair positions are within bounds of their respective rooms', () => {
    const { rooms, stairs } = generateMultiFloorLevel(seed, floorRoomCounts);
    for (const stair of stairs) {
      const fromRoom = rooms.find(r => r.id === stair.fromRoomId);
      const toRoom = rooms.find(r => r.id === stair.toRoomId);

      expect(stair.fromPos.x).toBeGreaterThanOrEqual(fromRoom.x);
      expect(stair.fromPos.x + STAIR_SIZE).toBeLessThanOrEqual(fromRoom.x + fromRoom.width);
      expect(stair.fromPos.y).toBeGreaterThanOrEqual(fromRoom.y);
      expect(stair.fromPos.y + STAIR_SIZE).toBeLessThanOrEqual(fromRoom.y + fromRoom.height);

      expect(stair.toPos.x).toBeGreaterThanOrEqual(toRoom.x);
      expect(stair.toPos.x + STAIR_SIZE).toBeLessThanOrEqual(toRoom.x + toRoom.width);
      expect(stair.toPos.y).toBeGreaterThanOrEqual(toRoom.y);
      expect(stair.toPos.y + STAIR_SIZE).toBeLessThanOrEqual(toRoom.y + toRoom.height);
    }
  });

  it('is deterministic (same seed produces same output)', () => {
    const result1 = generateMultiFloorLevel(seed, floorRoomCounts);
    const result2 = generateMultiFloorLevel(seed, floorRoomCounts);
    expect(result1.rooms.map(r => r.id)).toEqual(result2.rooms.map(r => r.id));
    expect(result1.stairs).toEqual(result2.stairs);
  });

  it('door targetRoomId references point to existing rooms', () => {
    const { rooms } = generateMultiFloorLevel(seed, floorRoomCounts);
    const allIds = new Set(rooms.map(r => r.id));
    for (const room of rooms) {
      for (const door of room.doors) {
        expect(allIds.has(door.targetRoomId)).toBe(true);
      }
    }
  });

  it('wall segments include segments from both floors', () => {
    const { rooms, wallSegments } = generateMultiFloorLevel(seed, floorRoomCounts);
    const floor1MinY = Math.min(...rooms.filter(r => r.floor === 1).map(r => r.y));
    const hasFloor1Segments = wallSegments.some(s => s.y1 >= floor1MinY || s.y2 >= floor1MinY);
    expect(hasFloor1Segments).toBe(true);
  });
});

describe('getFloorBounds', () => {
  it('returns bounds encompassing only rooms on the specified floor', () => {
    const { rooms } = generateMultiFloorLevel(42, [4, 3]);
    const bounds0 = getFloorBounds(rooms, 0);
    const bounds1 = getFloorBounds(rooms, 1);

    const floor0Rooms = rooms.filter(r => r.floor === 0);
    const floor1Rooms = rooms.filter(r => r.floor === 1);

    for (const room of floor0Rooms) {
      expect(room.x).toBeGreaterThanOrEqual(bounds0.minX);
      expect(room.x + room.width).toBeLessThanOrEqual(bounds0.maxX);
      expect(room.y).toBeGreaterThanOrEqual(bounds0.minY);
      expect(room.y + room.height).toBeLessThanOrEqual(bounds0.maxY);
    }

    for (const room of floor1Rooms) {
      expect(room.x).toBeGreaterThanOrEqual(bounds1.minX);
      expect(room.x + room.width).toBeLessThanOrEqual(bounds1.maxX);
      expect(room.y).toBeGreaterThanOrEqual(bounds1.minY);
      expect(room.y + room.height).toBeLessThanOrEqual(bounds1.maxY);
    }

    // Floors should not overlap
    expect(bounds1.minY).toBeGreaterThan(bounds0.maxY);
  });
});
