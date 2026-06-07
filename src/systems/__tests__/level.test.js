import { describe, it, expect } from 'vitest';
import { generateLevel } from '../level.js';
import { getFlashlightPolygon } from '../visibility.js';

describe('generateLevel', () => {
  it('produces the requested number of rooms', () => {
    const level = generateLevel(42, 5);
    expect(level.rooms).toHaveLength(5);
  });

  it('rooms occupy distinct grid positions', () => {
    const level = generateLevel(42, 5);
    const positions = level.rooms.map(r => `${r.gridX},${r.gridY}`);
    const unique = new Set(positions);
    expect(unique.size).toBe(positions.length);
  });

  it('all rooms are connected via doors (reachable from first room)', () => {
    const level = generateLevel(42, 6);

    const visited = new Set();
    const queue = [level.rooms[0].id];
    visited.add(level.rooms[0].id);

    const roomById = new Map(level.rooms.map(r => [r.id, r]));

    while (queue.length > 0) {
      const currentId = queue.shift();
      const room = roomById.get(currentId);
      for (const door of room.doors) {
        if (!visited.has(door.targetRoomId)) {
          visited.add(door.targetRoomId);
          queue.push(door.targetRoomId);
        }
      }
    }

    expect(visited.size).toBe(level.rooms.length);
  });

  it('no two rooms overlap in world space', () => {
    const level = generateLevel(42, 8);

    for (let i = 0; i < level.rooms.length; i++) {
      for (let j = i + 1; j < level.rooms.length; j++) {
        const a = level.rooms[i];
        const b = level.rooms[j];
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const first = generateLevel(99, 5);
    const second = generateLevel(99, 5);
    expect(first).toEqual(second);
  });

  it('produces different layouts for different seeds', () => {
    const first = generateLevel(1, 5);
    const second = generateLevel(2, 5);
    const firstPositions = first.rooms.map(r => `${r.gridX},${r.gridY}`).sort();
    const secondPositions = second.rooms.map(r => `${r.gridX},${r.gridY}`).sort();
    expect(firstPositions).not.toEqual(secondPositions);
  });

  it('doors are paired: if room A has a door to room B, room B has a door to room A', () => {
    const level = generateLevel(42, 6);
    const roomById = new Map(level.rooms.map(r => [r.id, r]));

    for (const room of level.rooms) {
      for (const door of room.doors) {
        const targetRoom = roomById.get(door.targetRoomId);
        const matchingDoor = targetRoom.doors.find(d => d.targetRoomId === room.id);
        expect(matchingDoor).toBeDefined();
      }
    }
  });

  it('wall segments increase with more rooms', () => {
    const small = generateLevel(42, 2);
    const large = generateLevel(42, 5);
    expect(large.wallSegments.length).toBeGreaterThan(small.wallSegments.length);
  });

  it('single room produces a level with no doors', () => {
    const level = generateLevel(42, 1);
    expect(level.rooms).toHaveLength(1);
    expect(level.rooms[0].doors).toHaveLength(0);
  });
});

describe('flashlight through doorway', () => {
  it('light passes through a doorway into an adjacent room', () => {
    const level = generateLevel(42, 2);
    const segments = level.wallSegments;

    const room0 = level.rooms[0];
    const room1 = level.rooms[1];

    const origin = { x: room0.x + room0.width / 2, y: room0.y + room0.height / 2 };
    const targetCenter = { x: room1.x + room1.width / 2, y: room1.y + room1.height / 2 };
    const angle = Math.atan2(targetCenter.y - origin.y, targetCenter.x - origin.x);

    const polygon = getFlashlightPolygon(origin, angle, Math.PI / 6, segments);

    const reachesRoom1 = polygon.some(p =>
      p.x >= room1.x && p.x <= room1.x + room1.width &&
      p.y >= room1.y && p.y <= room1.y + room1.height
    );

    expect(reachesRoom1).toBe(true);
  });

  it('light is blocked by a solid wall (not a doorway)', () => {
    const level = generateLevel(42, 2);
    const segments = level.wallSegments;

    const room0 = level.rooms[0];
    const room1 = level.rooms[1];
    const door = room0.doors[0];
    const isHorizontalDoor = door.wall === 'north' || door.wall === 'south';

    const origin = { x: room0.x + room0.width / 2, y: room0.y + room0.height / 2 };

    let blockedAngle;
    if (isHorizontalDoor) {
      blockedAngle = door.offset > room0.width / 2 ? Math.PI : 0;
    } else {
      blockedAngle = door.offset > room0.height / 2 ? -Math.PI / 2 : Math.PI / 2;
    }

    const polygon = getFlashlightPolygon(origin, blockedAngle, Math.PI / 16, segments);

    const inset = 5;
    const reachesRoom1Interior = polygon.some(p =>
      p.x > room1.x + inset && p.x < room1.x + room1.width - inset &&
      p.y > room1.y + inset && p.y < room1.y + room1.height - inset
    );
    expect(reachesRoom1Interior).toBe(false);
  });
});
