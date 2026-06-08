import { describe, it, expect } from 'vitest';
import { computeRoomDistances } from '../distance.js';

describe('computeRoomDistances', () => {
  it('reports the entrance room as distance 0', () => {
    const rooms = [{ id: 0, floor: 0, doors: [] }];
    const distances = computeRoomDistances(rooms, []);
    expect(distances.get(0)).toBe(0);
  });

  it('counts door hops from the entrance along a chain', () => {
    const rooms = [
      { id: 0, floor: 0, doors: [{ targetRoomId: 1 }] },
      { id: 1, floor: 0, doors: [{ targetRoomId: 0 }, { targetRoomId: 2 }] },
      { id: 2, floor: 0, doors: [{ targetRoomId: 1 }, { targetRoomId: 3 }] },
      { id: 3, floor: 0, doors: [{ targetRoomId: 2 }] },
    ];
    const distances = computeRoomDistances(rooms, []);
    expect(distances.get(0)).toBe(0);
    expect(distances.get(1)).toBe(1);
    expect(distances.get(2)).toBe(2);
    expect(distances.get(3)).toBe(3);
  });

  it('treats a room reached only by climbing a stair as farther than its same-floor neighbors', () => {
    const rooms = [
      { id: 0, floor: 0, doors: [{ targetRoomId: 1 }] },
      { id: 1, floor: 0, doors: [{ targetRoomId: 0 }] },
      { id: 2, floor: 1, doors: [{ targetRoomId: 3 }] },
      { id: 3, floor: 1, doors: [{ targetRoomId: 2 }] },
    ];
    const stairs = [{ fromRoomId: 1, toRoomId: 2 }];
    const distances = computeRoomDistances(rooms, stairs);
    expect(distances.get(2)).toBe(2);
    expect(distances.get(3)).toBe(3);
    expect(distances.get(2)).toBeGreaterThan(distances.get(1));
  });

  it('returns the shortest hop count when a shortcut door exists', () => {
    const rooms = [
      { id: 0, floor: 0, doors: [{ targetRoomId: 1 }, { targetRoomId: 2 }, { targetRoomId: 3 }] },
      { id: 1, floor: 0, doors: [{ targetRoomId: 0 }, { targetRoomId: 3 }] },
      { id: 2, floor: 0, doors: [{ targetRoomId: 0 }, { targetRoomId: 3 }] },
      { id: 3, floor: 0, doors: [{ targetRoomId: 1 }, { targetRoomId: 2 }, { targetRoomId: 0 }] },
    ];
    const distances = computeRoomDistances(rooms, []);
    expect(distances.get(3)).toBe(1);
  });
});
