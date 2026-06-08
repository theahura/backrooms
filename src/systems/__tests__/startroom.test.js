import { describe, it, expect } from 'vitest';
import {
  generateStoreLayout,
  generateCrackPoints,
  getExitPosition,
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
