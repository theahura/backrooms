import { describe, it, expect } from 'vitest';
import {
  generateStoreLayout,
  generateCrackPoints,
  getExitPosition,
  isThroughRift,
  nextRiftCrossing,
} from '../startroom.js';

const WALL_THICKNESS = 16;

describe('startroom', () => {
  describe('generateStoreLayout', () => {
    const roomX = 0;
    const roomY = 0;
    const roomWidth = 1200;
    const roomHeight = 1000;

    it('each item has required properties', () => {
      const layout = generateStoreLayout(roomX, roomY, roomWidth, roomHeight, WALL_THICKNESS);
      for (const item of layout) {
        expect(typeof item.type).toBe('string');
        expect(typeof item.x).toBe('number');
        expect(typeof item.y).toBe('number');
        expect(typeof item.width).toBe('number');
        expect(typeof item.height).toBe('number');
        expect(typeof item.color).toBe('number');
        expect(typeof item.canHide).toBe('boolean');
      }
    });

    it('all items are within room bounds minus wall thickness', () => {
      const layout = generateStoreLayout(roomX, roomY, roomWidth, roomHeight, WALL_THICKNESS);
      for (const item of layout) {
        expect(item.x).toBeGreaterThanOrEqual(roomX + WALL_THICKNESS);
        expect(item.y).toBeGreaterThanOrEqual(roomY + WALL_THICKNESS);
        expect(item.x + item.width).toBeLessThanOrEqual(roomX + roomWidth - WALL_THICKNESS);
        expect(item.y + item.height).toBeLessThanOrEqual(roomY + roomHeight - WALL_THICKNESS);
      }
    });

    it('no items overlap the center spawn zone', () => {
      const layout = generateStoreLayout(roomX, roomY, roomWidth, roomHeight, WALL_THICKNESS);
      const spawnCenterX = roomX + roomWidth / 2;
      const spawnCenterY = roomY + roomHeight / 2;
      const spawnHalf = 30;

      for (const item of layout) {
        const overlapsX = item.x < spawnCenterX + spawnHalf && item.x + item.width > spawnCenterX - spawnHalf;
        const overlapsY = item.y < spawnCenterY + spawnHalf && item.y + item.height > spawnCenterY - spawnHalf;
        expect(overlapsX && overlapsY).toBe(false);
      }
    });

    it('is deterministic — same params produce same result', () => {
      const a = generateStoreLayout(roomX, roomY, roomWidth, roomHeight, WALL_THICKNESS);
      const b = generateStoreLayout(roomX, roomY, roomWidth, roomHeight, WALL_THICKNESS);
      expect(a).toEqual(b);
    });

    it('adjusts positions when room origin is not zero', () => {
      const layout = generateStoreLayout(1200, 1000, roomWidth, roomHeight, WALL_THICKNESS);
      for (const item of layout) {
        expect(item.x).toBeGreaterThanOrEqual(1200 + WALL_THICKNESS);
        expect(item.y).toBeGreaterThanOrEqual(1000 + WALL_THICKNESS);
      }
    });
  });

  describe('generateCrackPoints', () => {
    it('returns segments + 1 points', () => {
      const points = generateCrackPoints(100, 200, 60, 8);
      expect(points.length).toBe(9);
    });

    it('vertical crack: first point near startY, last near startY + length', () => {
      const points = generateCrackPoints(100, 200, 60, 8, true);
      expect(points[0].y).toBeCloseTo(200, 0);
      expect(points[points.length - 1].y).toBeCloseTo(260, 0);
    });

    it('vertical crack: points have x-offsets creating a jagged pattern', () => {
      const points = generateCrackPoints(100, 200, 60, 8, true);
      const xValues = points.map(p => p.x);
      const allSame = xValues.every(x => x === xValues[0]);
      expect(allSame).toBe(false);
    });

    it('horizontal crack: first point near startX, last near startX + length', () => {
      const points = generateCrackPoints(100, 200, 60, 8, false);
      expect(points[0].x).toBeCloseTo(100, 0);
      expect(points[points.length - 1].x).toBeCloseTo(160, 0);
    });

    it('horizontal crack: points have y-offsets creating a jagged pattern', () => {
      const points = generateCrackPoints(100, 200, 60, 8, false);
      const yValues = points.map(p => p.y);
      const allSame = yValues.every(y => y === yValues[0]);
      expect(allSame).toBe(false);
    });

  });

  describe('isThroughRift', () => {
    // The rift opening sits in the store's east wall. edgeX is the store's east
    // edge; riftRect is the opening's world rect (a band on the east wall).
    const edgeX = 720;
    const riftRect = { x: 700, y: 240, width: 40, height: 120 }; // opening spans y 240..360

    it('is true when the player is east of the edge AND within the rift band', () => {
      expect(isThroughRift(740, 300, edgeX, riftRect)).toBe(true);
    });

    it('is false east of the edge but OUTSIDE the rift band (an aligned door one room away)', () => {
      // Same eastward crossing X, but a full room south of the rift opening.
      expect(isThroughRift(740, 900, edgeX, riftRect)).toBe(false);
      // And one room north.
      expect(isThroughRift(740, 60, edgeX, riftRect)).toBe(false);
    });

    it('is false when the player is still west of the edge (inside the store)', () => {
      expect(isThroughRift(700, 300, edgeX, riftRect)).toBe(false);
    });

    it('is true exactly at the band edges, false just outside them', () => {
      expect(isThroughRift(740, 240, edgeX, riftRect)).toBe(true);
      expect(isThroughRift(740, 360, edgeX, riftRect)).toBe(true);
      expect(isThroughRift(740, 239, edgeX, riftRect)).toBe(false);
      expect(isThroughRift(740, 361, edgeX, riftRect)).toBe(false);
    });
  });

  describe('nextRiftCrossing', () => {
    // The store (entrance room) is the only opening into the backrooms (the rift
    // in its east wall). The transition fires once when the player passes through
    // the opening, and re-arms only when the player is genuinely back in the store.
    const room = { x: 0, y: 0, width: 720, height: 600 }; // east edge = 720
    const riftRect = { x: 700, y: 240, width: 40, height: 120 }; // band spans y 240..360

    it('fires the transition once when the player passes through the rift into the backrooms', () => {
      // Still inside the store: nothing fires.
      const inStore = nextRiftCrossing(100, 300, room, riftRect, false);
      expect(inStore).toEqual({ riftCrossed: false, triggered: false });
      // Step east through the opening: fires.
      const crossed = nextRiftCrossing(740, 300, room, riftRect, false);
      expect(crossed).toEqual({ riftCrossed: true, triggered: true });
    });

    it('does not re-fire while the player keeps moving deeper into the backrooms', () => {
      expect(nextRiftCrossing(800, 300, room, riftRect, true).triggered).toBe(false);
      expect(nextRiftCrossing(1500, 300, room, riftRect, true).triggered).toBe(false);
    });

    it('does NOT re-arm in a room north or south of the store that shares its east-edge X', () => {
      // (0,-1): west of the store's east edge but ABOVE the store's vertical extent.
      expect(nextRiftCrossing(620, -300, room, riftRect, true).riftCrossed).toBe(true);
      // (0,1): west of the edge but BELOW the store.
      expect(nextRiftCrossing(620, 900, room, riftRect, true).riftCrossed).toBe(true);
    });

    it('does not replay the transition after looping through a column-0 neighbor of the store', () => {
      // Player loops to the room north of the store -- must NOT re-arm...
      const looped = nextRiftCrossing(620, -300, room, riftRect, true);
      expect(looped.riftCrossed).toBe(true);
      // ...so re-entering the rift's band east of the store does NOT fire again.
      const reentry = nextRiftCrossing(740, 300, room, riftRect, looped.riftCrossed);
      expect(reentry.triggered).toBe(false);
    });

    it('re-arms when the player genuinely returns inside the store, so a real re-entry fires again', () => {
      const returned = nextRiftCrossing(100, 300, room, riftRect, true);
      expect(returned.riftCrossed).toBe(false);
      const reCross = nextRiftCrossing(740, 300, room, riftRect, returned.riftCrossed);
      expect(reCross.triggered).toBe(true);
    });

    it('re-arms within the store rect with hysteresis on the crossing axis', () => {
      // Y extent is inclusive of the store's far wall, exclusive just beyond it.
      expect(nextRiftCrossing(100, 600, room, riftRect, true).riftCrossed).toBe(false);
      expect(nextRiftCrossing(100, 601, room, riftRect, true).riftCrossed).toBe(true);
      // X re-arm sits 40px inside the east edge (hysteresis vs the +4 trigger).
      expect(nextRiftCrossing(680, 300, room, riftRect, true).riftCrossed).toBe(true);
      expect(nextRiftCrossing(679, 300, room, riftRect, true).riftCrossed).toBe(false);
    });
  });

  describe('getExitPosition', () => {
    const room = { x: 0, y: 0, width: 1200, height: 1000 };

    it('position is inside the room bounds', () => {
      const pos = getExitPosition(room, WALL_THICKNESS);
      expect(pos.x).toBeGreaterThan(room.x + WALL_THICKNESS);
      expect(pos.y).toBeGreaterThan(room.y + WALL_THICKNESS);
      expect(pos.x).toBeLessThan(room.x + room.width - WALL_THICKNESS);
      expect(pos.y).toBeLessThan(room.y + room.height - WALL_THICKNESS);
    });

    it('adjusts for non-zero room origin', () => {
      const offsetRoom = { x: 1200, y: 1000, width: 1200, height: 1000 };
      const pos = getExitPosition(offsetRoom, WALL_THICKNESS);
      expect(pos.x).toBeGreaterThan(1200 + WALL_THICKNESS);
      expect(pos.y).toBeGreaterThan(1000 + WALL_THICKNESS);
    });

    it('exit is on the west side of the room', () => {
      const pos = getExitPosition(room, WALL_THICKNESS);
      expect(pos.x).toBeLessThan(room.x + room.width * 0.2);
    });

    it('exit is vertically centered', () => {
      const pos = getExitPosition(room, WALL_THICKNESS);
      const centerY = room.y + room.height / 2;
      expect(Math.abs(pos.y - centerY)).toBeLessThan(50);
    });

    it('exit zone does not overlap player spawn at room center', () => {
      const pos = getExitPosition(room, WALL_THICKNESS);
      const spawnX = room.x + room.width / 2;
      const spawnY = room.y + room.height / 2;
      const exitHalf = 32;
      const playerHalf = 10;
      const overlapX = pos.x + exitHalf > spawnX - playerHalf && pos.x - exitHalf < spawnX + playerHalf;
      const overlapY = pos.y + exitHalf > spawnY - playerHalf && pos.y - exitHalf < spawnY + playerHalf;
      expect(overlapX && overlapY).toBe(false);
    });
  });

  describe('store layout positioning', () => {
    const roomX = 0;
    const roomY = 0;
    const roomWidth = 1200;
    const roomHeight = 1000;

    it('includes a counter near the horizontal center of the room', () => {
      const layout = generateStoreLayout(roomX, roomY, roomWidth, roomHeight, WALL_THICKNESS);
      const counter = layout.find(item => item.type === 'counter');
      expect(counter).toBeDefined();
      const counterCenterX = counter.x + counter.width / 2;
      expect(counterCenterX).toBeGreaterThan(roomWidth * 0.3);
      expect(counterCenterX).toBeLessThan(roomWidth * 0.65);
    });

    it('no furniture extends into the east doorway zone', () => {
      const layout = generateStoreLayout(roomX, roomY, roomWidth, roomHeight, WALL_THICKNESS);
      const eastBoundary = roomX + roomWidth - WALL_THICKNESS - 20;
      for (const item of layout) {
        expect(item.x + item.width).toBeLessThanOrEqual(eastBoundary);
      }
    });
  });
});
