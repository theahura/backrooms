import { describe, it, expect } from 'vitest';
import {
  generateRoomLamps,
  lampBrightness,
  LAMP_FLICKER_FLOOR,
} from '../lamps.js';

// Live backrooms rooms are 720x600 (worldgen.js). The lamp tests use the real
// dimensions so placement bounds reflect production geometry.
function makeRoom(id, x, y, overrides = {}) {
  return {
    id,
    gridX: 0,
    gridY: 0,
    x,
    y,
    width: 720,
    height: 600,
    doors: [],
    seed: 42,
    ...overrides,
  };
}

// A spread of rooms across a grid, none of them room 0, for rate/bounds tests.
function manyRooms(count, startId = 1) {
  const rooms = [];
  for (let i = 0; i < count; i++) {
    const gx = i % 10;
    const gy = Math.floor(i / 10);
    rooms.push(makeRoom(startId + i, gx * 720, gy * 600, { gridX: gx, gridY: gy }));
  }
  return rooms;
}

describe('generateRoomLamps', () => {
  it('returns empty array for empty rooms', () => {
    expect(generateRoomLamps([], 42)).toEqual([]);
  });

  it('never places a lamp in room 0 (the lit start room)', () => {
    const rooms = [makeRoom(0, 0, 0), ...manyRooms(20)];
    const lamps = generateRoomLamps(rooms, 42);
    expect(lamps.length).toBeGreaterThan(0);
    expect(lamps.every(l => l.roomId !== 0)).toBe(true);
  });

  it('is deterministic — same rooms and seed produce identical lamps', () => {
    const rooms = manyRooms(20);
    const lamps = generateRoomLamps(rooms, 77);
    expect(lamps.length).toBeGreaterThan(0);
    expect(lamps).toEqual(generateRoomLamps(rooms, 77));
  });

  it('places at most one lamp per room, each with a unique id', () => {
    const rooms = manyRooms(120);
    const lamps = generateRoomLamps(rooms, 42);
    expect(lamps.length).toBeGreaterThan(0);
    expect(new Set(lamps.map(l => l.roomId)).size).toBe(lamps.length);
    expect(new Set(lamps.map(l => l.id)).size).toBe(lamps.length);
  });

  it('produces different lamp sets for different seeds', () => {
    const rooms = manyRooms(40);
    const a = generateRoomLamps(rooms, 1).map(l => l.roomId).sort((p, q) => p - q);
    const b = generateRoomLamps(rooms, 9999).map(l => l.roomId).sort((p, q) => p - q);
    expect(a).not.toEqual(b);
  });

  it('lights some rooms but not most — spawn rate stays in a sane band', () => {
    let lampCount = 0;
    let roomCount = 0;
    for (const seed of [1, 2, 3, 7, 42, 99, 1234]) {
      const rooms = manyRooms(100);
      lampCount += generateRoomLamps(rooms, seed).length;
      roomCount += rooms.length;
    }
    const rate = lampCount / roomCount;
    expect(rate).toBeGreaterThan(0.15);
    expect(rate).toBeLessThan(0.45);
  });

  it('places every lamp inside its room interior with a positive radius', () => {
    const rooms = manyRooms(60);
    const lamps = generateRoomLamps(rooms, 42);
    expect(lamps.length).toBeGreaterThan(0);
    for (const lamp of lamps) {
      const room = rooms.find(r => r.id === lamp.roomId);
      expect(lamp.x).toBeGreaterThan(room.x);
      expect(lamp.x).toBeLessThan(room.x + room.width);
      expect(lamp.y).toBeGreaterThan(room.y);
      expect(lamp.y).toBeLessThan(room.y + room.height);
      expect(lamp.radius).toBeGreaterThan(0);
    }
  });

  it('produces at least some flickering and some steady lamps across the world', () => {
    const rooms = manyRooms(200);
    const lamps = generateRoomLamps(rooms, 42);
    expect(lamps.length).toBeGreaterThan(0);
    expect(lamps.some(l => l.flicker === true)).toBe(true);
    expect(lamps.some(l => l.flicker === false)).toBe(true);
  });
});

describe('lampBrightness', () => {
  const steady = { flicker: false, phase: 0 };
  const flickering = { flicker: true, phase: 0 };

  it('a steady lamp is always at full brightness', () => {
    for (const t of [0, 100, 250, 999, 5000, 123456]) {
      expect(lampBrightness(steady, t)).toBe(1);
    }
  });

  it('a flickering lamp never goes dark and never overbrightens', () => {
    for (let t = 0; t <= 6000; t += 17) {
      const b = lampBrightness(flickering, t);
      expect(b).toBeGreaterThanOrEqual(LAMP_FLICKER_FLOOR);
      expect(b).toBeLessThanOrEqual(1);
    }
  });

  it('a flickering lamp actually varies over time but is deterministic', () => {
    const samples = new Set();
    for (let t = 0; t <= 4000; t += 50) {
      samples.add(Math.round(lampBrightness(flickering, t) * 1000));
    }
    expect(samples.size).toBeGreaterThan(1);
    expect(lampBrightness(flickering, 1325)).toBe(lampBrightness(flickering, 1325));
  });

  it('a flickering lamp dips meaningfully toward its floor at some point', () => {
    let min = Infinity;
    for (let t = 0; t <= 6000; t += 25) {
      min = Math.min(min, lampBrightness(flickering, t));
    }
    expect(min).toBeLessThanOrEqual(LAMP_FLICKER_FLOOR + 0.05);
  });

  it('two lamps with different phases can differ at the same instant', () => {
    const a = { flicker: true, phase: 0 };
    const b = { flicker: true, phase: 730 };
    let differ = false;
    for (let t = 0; t <= 3000; t += 25) {
      if (lampBrightness(a, t) !== lampBrightness(b, t)) { differ = true; break; }
    }
    expect(differ).toBe(true);
  });
});
