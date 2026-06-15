import { hashU32 } from './worldgen.js';

// A "zone" is a contiguous region of the infinite room grid that all shares one
// liminal-space theme -- a whole mall of several rooms, then a hospital of
// several rooms, and so on. Where vibe (roomVibes.js) varies room-to-room, zone
// is the larger identity that several adjacent rooms have in common, so the
// player feels like they cross from one kind of place into another rather than
// every room being a fresh dice roll.
//
// The partition is a deterministic staggered block grid: every BLOCK_W x BLOCK_H
// rectangle of cells is one zone, and each horizontal band of rows is shifted by
// a seed-derived offset so the seams don't line up into an obvious lattice.
// Because it derives only from (seed, gx, gy) on its own salt, it is stable and
// orthogonal to the door / maze / vibe seed streams.

export const ZONE_SALT = 700;
const BLOCK_W = 3;
const BLOCK_H = 3;

// Backrooms zones (the store at (0,0) is its own special zone, NOT in here).
export const ZONE_IDS = ['mall', 'hospital', 'hotel', 'office', 'warehouse'];

function neighborCoords(gx, gy, wall) {
  if (wall === 'east') return [gx + 1, gy];
  if (wall === 'west') return [gx - 1, gy];
  if (wall === 'north') return [gx, gy - 1];
  return [gx, gy + 1]; // south
}

export function getZoneAt(seed, gx, gy) {
  if (gx === 0 && gy === 0) return 'store';
  const rowBlock = Math.floor(gy / BLOCK_H);
  const rowOffset = hashU32(seed, rowBlock, 0, ZONE_SALT + 1) % BLOCK_W;
  const colBlock = Math.floor((gx + rowOffset) / BLOCK_W);
  const idx = hashU32(seed, colBlock, rowBlock, ZONE_SALT) % ZONE_IDS.length;
  return ZONE_IDS[idx];
}

// True when the door on `wall` of cell (gx,gy) leads into a different zone --
// i.e. it is a seam between two themed regions. Symmetric: the east side of a
// cell and the west side of its east neighbor report the same answer.
export function isZoneBoundary(seed, gx, gy, wall) {
  const [nx, ny] = neighborCoords(gx, gy, wall);
  return getZoneAt(seed, gx, gy) !== getZoneAt(seed, nx, ny);
}
