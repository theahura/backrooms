import { describe, it, expect } from 'vitest';
import { getRoomAt, hasStairDown } from '../worldgen.js';
import { generateMazeWalls, doorEntryZones } from '../maze.js';
import { generateRoomFurniture } from '../furniture.js';
import { getRoomVibe } from '../roomVibes.js';
import { stairKeepOut, stairLandingKeepOut, STAIR_SIZE, STAIR_MARGIN } from '../stairs.js';

// These tests exercise the REAL room-generation pipeline the way
// GameScene.activateRoom assembles it, so they guard the spec's
// "hiding places, stairs, and doors will often spawn inside walls" bug.
const WALL_THICKNESS = 16;
const STAIR_KEEPOUT_PAD = 16;

const overlaps = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

// Mirror of GameScene.activateRoom's obstacle assembly for a floor-0 room.
function placeRoom(seed, gx, gy) {
  const room = getRoomAt(seed, gx, gy);
  const entrance = gx === 0 && gy === 0;
  const hasStair = !entrance && hasStairDown(seed, gx, gy);
  const stairKeep = hasStair ? [stairKeepOut(room, STAIR_SIZE, STAIR_MARGIN, STAIR_KEEPOUT_PAD)] : [];
  const landingKeep = hasStair ? [stairLandingKeepOut(room)] : [];
  const mazeRects = !entrance
    ? generateMazeWalls(room.x, room.y, room.width, room.height, WALL_THICKNESS, room.seed, room.doors, [...stairKeep, ...landingKeep])
    : [];
  const furnitureObstacles = [...mazeRects, ...doorEntryZones(room, WALL_THICKNESS), ...landingKeep];
  const vibe = getRoomVibe(room.seed);
  const furniture = entrance
    ? []
    : generateRoomFurniture(room.x, room.y, room.width, room.height, WALL_THICKNESS, room.seed, vibe.furniture, furnitureObstacles);
  return { room, mazeRects, furniture, hasStair, stairKeep };
}

function forEachRoom(maxSeed, maxCell, fn) {
  for (let seed = 1; seed <= maxSeed; seed++) {
    for (let gx = 0; gx <= maxCell; gx++) {
      for (let gy = 0; gy <= maxCell; gy++) {
        if (gx === 0 && gy === 0) continue; // entrance room is furnished separately
        fn(placeRoom(seed, gx, gy), seed, gx, gy);
      }
    }
  }
}

describe('intra-room placement clearance (Bug 1)', () => {
  it('no hideable furniture overlaps a maze wall', () => {
    let hideables = 0;
    forEachRoom(6, 6, ({ furniture, mazeRects }, seed, gx, gy) => {
      for (const item of furniture) {
        if (!item.canHide) continue;
        hideables++;
        for (const wall of mazeRects) {
          expect(overlaps(item, wall), `seed ${seed} cell ${gx},${gy}`).toBe(false);
        }
      }
    });
    expect(hideables).toBeGreaterThan(0);
  });

  it('no hideable furniture sits inside a doorway entry zone (would block the door / hide in the doorway)', () => {
    forEachRoom(6, 6, ({ room, furniture }, seed, gx, gy) => {
      const zones = doorEntryZones(room, WALL_THICKNESS);
      for (const item of furniture) {
        if (!item.canHide) continue;
        for (const z of zones) {
          expect(overlaps(item, z), `seed ${seed} cell ${gx},${gy}`).toBe(false);
        }
      }
    });
  });

  it('no furniture overlaps the stair footprint', () => {
    let stairs = 0;
    forEachRoom(8, 8, ({ furniture, hasStair, stairKeep }, seed, gx, gy) => {
      if (!hasStair) return;
      stairs++;
      const footprint = stairKeep[0];
      for (const item of furniture) {
        expect(overlaps(item, footprint), `seed ${seed} cell ${gx},${gy}`).toBe(false);
      }
    });
    expect(stairs).toBeGreaterThan(0);
  });

  it('the stair footprint is never embedded in a maze wall', () => {
    let stairs = 0;
    forEachRoom(8, 8, ({ mazeRects, hasStair, stairKeep }, seed, gx, gy) => {
      if (!hasStair) return;
      stairs++;
      const footprint = stairKeep[0];
      for (const wall of mazeRects) {
        expect(overlaps(footprint, wall), `seed ${seed} cell ${gx},${gy}`).toBe(false);
      }
    });
    expect(stairs).toBeGreaterThan(0);
  });
});
