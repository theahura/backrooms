import { describe, it, expect } from 'vitest';
import { getRoomAt, hasStairDown } from '../worldgen.js';
import { generateMazeWalls, doorEntryZones, getRoomType } from '../maze.js';
import { generateRoomFurniture } from '../furniture.js';
import { generateRoomEnemies } from '../enemy.js';
import { getRoomVibe } from '../roomVibes.js';
import { stairKeepOut, stairLandingKeepOut, STAIR_SIZE, STAIR_MARGIN } from '../stairs.js';
import { computeSwitchPosition, chooseSwitchWall, SWITCH_HALF_W, SWITCH_HALF_H } from '../lightswitch.js';
import { mulberry32 } from '../random.js';

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
  return { room, mazeRects, furniture, hasStair, stairKeep, landingKeep };
}

const containsPoint = (rect, px, py) =>
  px >= rect.x && px <= rect.x + rect.width &&
  py >= rect.y && py <= rect.y + rect.height;

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

  // Bug 5: "they become vulnerable to attack immediately after spawning [on a
  // stair]". An enemy generated on top of the stair or on the spot where the
  // player materializes after a transition hits them before they can react.
  // GameScene.activateRoom passes [stairKeepOut, stairLandingKeepOut] to the
  // enemy spawner; this drives the real spawner with those same rects across the
  // generated world and asserts no enemy lands in either zone.
  it('no enemy spawns on the stair footprint or the player landing spot (Bug 5)', () => {
    let stairs = 0;
    let enemiesSeen = 0;
    forEachRoom(8, 8, ({ room, furniture, hasStair, stairKeep, landingKeep }, seed, gx, gy) => {
      if (!hasStair) return;
      stairs++;
      const keepOut = [...stairKeep, ...landingKeep];
      const enemies = generateRoomEnemies(
        room.x, room.y, room.width, room.height,
        WALL_THICKNESS, room.seed, furniture, room.id, 8, keepOut
      );
      enemiesSeen += enemies.length;
      for (const enemy of enemies) {
        for (const zone of keepOut) {
          expect(containsPoint(zone, enemy.x, enemy.y), `seed ${seed} cell ${gx},${gy}`).toBe(false);
        }
      }
    });
    expect(stairs).toBeGreaterThan(0);
    expect(enemiesSeen).toBeGreaterThan(0);
  });
});

// A light switch sprite is drawn centered (and unscaled) on the chosen wall. The
// footprint is what the player sees, so the bug ("light switches can spawn inside
// walls / on doors") shows up as the footprint overlapping an interior maze wall.
// Half-extents come from lightswitch.js so this tracks the real sprite size.
const SWITCH_CHANCE = 0.15;
const SWITCH_WALLS = ['north', 'south', 'east', 'west'];

function switchFootprint(pos) {
  return { x: pos.x - SWITCH_HALF_W, y: pos.y - SWITCH_HALF_H, width: SWITCH_HALF_W * 2, height: SWITCH_HALF_H * 2 };
}

// Mirror GameScene.activateRoomSwitch's RNG exactly (floor 0 -> floorSeed = seed):
// one draw decides whether the room gets a switch, the next picks the starting
// wall index. The `choose` callback turns (room, mazeRects, startWallIndex) into a
// final {wall, pos}, so the same driver expresses both the fixed and buggy paths.
function placeSwitch(seed, gx, gy, room, mazeRects, choose) {
  const rand = mulberry32(seed + 40000 + gx * 131 + gy * 977);
  if (rand() >= SWITCH_CHANCE) return null;
  const startWall = Math.floor(rand() * SWITCH_WALLS.length);
  return choose(room, mazeRects, startWall);
}

const placeSwitchLive = (room, mazeRects, startWall) => {
  const wall = chooseSwitchWall(room, WALL_THICKNESS, mazeRects, startWall);
  return { wall, pos: computeSwitchPosition(room, wall, WALL_THICKNESS, mazeRects) };
};

// Frozen reconstruction of the pre-fix path (random wall + maze-blind 3-arg
// placement) -- exists only so the guard above is provably non-vacuous.
const placeSwitchOld = (room, mazeRects, startWall) => {
  const wall = SWITCH_WALLS[startWall];
  return { wall, pos: computeSwitchPosition(room, wall, WALL_THICKNESS) };
};

describe('light switch placement clears interior maze walls (Known bug)', () => {
  it('never lands a switch footprint inside an interior maze wall, across the generated world', () => {
    let switches = 0;
    let inMazeWall = 0;
    let switchesInMazeTypeRooms = 0;
    forEachRoom(40, 8, ({ room, mazeRects }, seed, gx, gy) => {
      const placed = placeSwitch(seed, gx, gy, room, mazeRects, placeSwitchLive);
      if (!placed) return;
      switches++;
      const type = getRoomType(room.seed);
      if (type === 'maze' || type === 'corridor') switchesInMazeTypeRooms++;
      const fp = switchFootprint(placed.pos);
      if (mazeRects.some(wall => overlaps(fp, wall))) inMazeWall++;
    });
    expect(switches).toBeGreaterThan(0);
    // Anti-vacuous: switches actually land in the room types whose interior walls
    // reach the perimeter (the only ones that can bury a switch).
    expect(switchesInMazeTypeRooms).toBeGreaterThan(0);
    expect(inMazeWall, `${inMazeWall}/${switches} switches embedded in a maze wall`).toBe(0);
  });

  it('the old door-only placement DID bury switches in maze walls (proves the guard is non-vacuous)', () => {
    let inMazeWall = 0;
    forEachRoom(40, 8, ({ room, mazeRects }, seed, gx, gy) => {
      const placed = placeSwitch(seed, gx, gy, room, mazeRects, placeSwitchOld);
      if (!placed) return;
      const fp = switchFootprint(placed.pos);
      if (mazeRects.some(wall => overlaps(fp, wall))) inMazeWall++;
    });
    expect(inMazeWall).toBeGreaterThan(0);
  });
});
