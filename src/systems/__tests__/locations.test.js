import { describe, it, expect } from 'vitest';
import {
  LOCATIONS,
  getLocation,
  getLocationLayout,
  getLocationExitPosition,
  generateAlternateExit,
} from '../locations.js';

describe('LOCATIONS data', () => {
  it('contains at least 5 locations including the store', () => {
    expect(LOCATIONS.length).toBeGreaterThanOrEqual(5);
    const ids = LOCATIONS.map(l => l.id);
    expect(ids).toContain('store');
  });

  it('every location has required fields', () => {
    for (const loc of LOCATIONS) {
      expect(typeof loc.id).toBe('string');
      expect(typeof loc.name).toBe('string');
      expect(typeof loc.floorColor).toBe('number');
      expect(typeof loc.wallColor).toBe('number');
      expect(Array.isArray(loc.furniture)).toBe(true);
      expect(loc.furniture.length).toBeGreaterThan(0);
    }
  });

  it('every location has unique id', () => {
    const ids = LOCATIONS.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getLocation', () => {
  it('returns the correct location by id', () => {
    const store = getLocation('store');
    expect(store).not.toBeNull();
    expect(store.name).toBe('Furniture Store');

    const office = getLocation('office');
    expect(office).not.toBeNull();
    expect(office.name).toBe('Office Building');
  });

  it('returns null for unknown id', () => {
    expect(getLocation('nonexistent')).toBeNull();
    expect(getLocation('')).toBeNull();
  });
});

describe('getLocationLayout', () => {
  const room = { x: 0, y: 0, width: 1200, height: 1000 };
  const wallThickness = 16;

  it('returns furniture within room bounds for every location', () => {
    for (const loc of LOCATIONS) {
      const furniture = getLocationLayout(loc.id, room.x, room.y, room.width, room.height, wallThickness);
      expect(furniture.length).toBeGreaterThan(0);

      for (const item of furniture) {
        expect(item.x).toBeGreaterThanOrEqual(room.x + wallThickness);
        expect(item.y).toBeGreaterThanOrEqual(room.y + wallThickness);
        expect(item.x + item.width).toBeLessThanOrEqual(room.x + room.width - wallThickness);
        expect(item.y + item.height).toBeLessThanOrEqual(room.y + room.height - wallThickness);
      }
    }
  });

  it('avoids the center spawn zone', () => {
    const spawnCX = room.x + room.width / 2;
    const spawnCY = room.y + room.height / 2;
    const spawnHalf = 30;

    for (const loc of LOCATIONS) {
      const furniture = getLocationLayout(loc.id, room.x, room.y, room.width, room.height, wallThickness);
      for (const item of furniture) {
        const overlapsX = item.x < spawnCX + spawnHalf && item.x + item.width > spawnCX - spawnHalf;
        const overlapsY = item.y < spawnCY + spawnHalf && item.y + item.height > spawnCY - spawnHalf;
        expect(overlapsX && overlapsY).toBe(false);
      }
    }
  });

  it('is deterministic for the same inputs', () => {
    const layout1 = getLocationLayout('office', 0, 0, 1200, 1000, 16);
    const layout2 = getLocationLayout('office', 0, 0, 1200, 1000, 16);
    expect(layout1).toEqual(layout2);
  });

  it('returns empty array for unknown location id', () => {
    const furniture = getLocationLayout('nonexistent', 0, 0, 1200, 1000, 16);
    expect(furniture).toEqual([]);
  });
});

describe('getLocationExitPosition', () => {
  const room = { x: 0, y: 0, width: 1200, height: 1000 };
  const wallThickness = 16;

  it('returns a position inside the room for every location', () => {
    for (const loc of LOCATIONS) {
      const pos = getLocationExitPosition(loc.id, room, wallThickness);
      expect(pos.x).toBeGreaterThanOrEqual(room.x);
      expect(pos.x).toBeLessThanOrEqual(room.x + room.width);
      expect(pos.y).toBeGreaterThanOrEqual(room.y);
      expect(pos.y).toBeLessThanOrEqual(room.y + room.height);
    }
  });

  it('falls back to store position for unknown location', () => {
    const storePos = getLocationExitPosition('store', room, wallThickness);
    const unknownPos = getLocationExitPosition('nonexistent', room, wallThickness);
    expect(unknownPos).toEqual(storePos);
  });
});

describe('generateAlternateExit', () => {
  function makeRoomsMultiFloor() {
    return [
      { id: 0, floor: 0, x: 0, y: 0, width: 1200, height: 1000 },
      { id: 1, floor: 0, x: 1200, y: 0, width: 1200, height: 1000 },
      { id: 2, floor: 0, x: 2400, y: 0, width: 1200, height: 1000 },
      { id: 3, floor: 0, x: 3600, y: 0, width: 1200, height: 1000 },
      { id: 4, floor: 1, x: 0, y: 10000, width: 1200, height: 1000 },
      { id: 5, floor: 1, x: 1200, y: 10000, width: 1200, height: 1000 },
      { id: 6, floor: 1, x: 2400, y: 10000, width: 1200, height: 1000 },
    ];
  }

  it('returns null when all locations are already unlocked', () => {
    const rooms = makeRoomsMultiFloor();
    const allIds = LOCATIONS.map(l => l.id);
    const result = generateAlternateExit(rooms, [], 42, allIds);
    expect(result).toBeNull();
  });

  it('returns null when only floor-0 rooms exist', () => {
    const rooms = [
      { id: 0, floor: 0, x: 0, y: 0, width: 1200, height: 1000 },
      { id: 1, floor: 0, x: 1200, y: 0, width: 1200, height: 1000 },
    ];
    const result = generateAlternateExit(rooms, [], 42, ['store']);
    expect(result).toBeNull();
  });

  it('places exit on a non-zero floor when eligible rooms exist', () => {
    const rooms = makeRoomsMultiFloor();
    let found = false;
    for (let seed = 0; seed < 50; seed++) {
      const result = generateAlternateExit(rooms, [], seed, ['store']);
      if (result !== null) {
        found = true;
        const room = rooms.find(r => r.id === result.roomId);
        expect(room.floor).toBeGreaterThan(0);
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('picks only not-yet-unlocked locations', () => {
    const rooms = makeRoomsMultiFloor();
    const unlocked = ['store', 'office', 'garage'];
    const remaining = LOCATIONS.map(l => l.id).filter(id => !unlocked.includes(id));

    for (let seed = 0; seed < 100; seed++) {
      const result = generateAlternateExit(rooms, [], seed, unlocked);
      if (result !== null) {
        expect(remaining).toContain(result.locationId);
      }
    }
  });

  it('is deterministic with the same seed', () => {
    const rooms = makeRoomsMultiFloor();
    const result1 = generateAlternateExit(rooms, [], 42, ['store']);
    const result2 = generateAlternateExit(rooms, [], 42, ['store']);
    expect(result1).toEqual(result2);
  });

  it('avoids rooms that have stair connections', () => {
    const rooms = makeRoomsMultiFloor();
    const stairs = [
      { fromRoomId: 1, toRoomId: 4 },
      { fromRoomId: 2, toRoomId: 5 },
    ];
    const stairRoomIds = new Set([4, 5]);

    for (let seed = 0; seed < 100; seed++) {
      const result = generateAlternateExit(rooms, stairs, seed, ['store']);
      if (result !== null) {
        expect(stairRoomIds.has(result.roomId)).toBe(false);
      }
    }
  });

  it('returns position centered in the chosen room', () => {
    const rooms = makeRoomsMultiFloor();
    for (let seed = 0; seed < 50; seed++) {
      const result = generateAlternateExit(rooms, [], seed, ['store']);
      if (result !== null) {
        const room = rooms.find(r => r.id === result.roomId);
        expect(result.position.x).toBeGreaterThan(room.x);
        expect(result.position.x).toBeLessThan(room.x + room.width);
        expect(result.position.y).toBeGreaterThan(room.y);
        expect(result.position.y).toBeLessThan(room.y + room.height);
        break;
      }
    }
  });
});
