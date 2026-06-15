import { mulberry32 } from './random.js';

// A "vibe" is the concrete look of a single room: its floor/wall colours and the
// furniture left behind in it. Vibes are now organised under ZONES (zones.js):
// each zone is a liminal-space archetype (a dead mall, an empty hospital, a
// Shining-style hotel) that spans several adjacent rooms. Every room still gets
// its OWN shade -- the palette is jittered per room around the zone's base
// colours -- so a zone reads as one coherent place without every room being an
// identical copy. This keeps the rooms desaturated and dim (liminal) while
// deliberately avoiding the old single shared sickly-yellow palette.
//
// Floor/wall textures (tex_<zone>_floor / tex_<zone>_wall) are generated offline
// by scripts/gen-textures.mjs; GameScene draws them when present and falls back
// to the flat jittered colours otherwise.

const VIBE_SEED_OFFSET = 130000;
const JITTER = 8; // per-channel +/- shade variation between rooms of one zone

function clamp8(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function jitterColor(base, rand, amt) {
  const r = clamp8(((base >> 16) & 0xff) + Math.round((rand() - 0.5) * 2 * amt));
  const g = clamp8(((base >> 8) & 0xff) + Math.round((rand() - 0.5) * 2 * amt));
  const b = clamp8((base & 0xff) + Math.round((rand() - 0.5) * 2 * amt));
  return (r << 16) | (g << 8) | b;
}

// Cluster = a recognizable furniture arrangement (relative dx/dy) that whoever
// used this kind of space would have left behind. Singletons = stray pieces.
// Both reference furniture.js types. Bases are chosen so each zone's floor is
// distinguishable from every other even after jitter.
export const ZONES = {
  mall: {
    id: 'mall',
    name: 'Dead Mall',
    floorBase: 0x615a4e,
    wallBase: 0x837a68,
    floorTextureKey: 'tex_mall_floor',
    wallTextureKey: 'tex_mall_wall',
    furniture: {
      clusters: [
        // a row of shuttered storefronts with a kiosk
        [
          { type: 'shelf', dx: 0, dy: 0 },
          { type: 'shelf', dx: 0, dy: 40 },
          { type: 'shelf', dx: 0, dy: 80 },
          { type: 'counter', dx: 130, dy: 30 },
        ],
        // concourse seating around a planter
        [
          { type: 'couch', dx: 0, dy: 0 },
          { type: 'couch', dx: 0, dy: 70 },
          { type: 'table', dx: 110, dy: 20 },
        ],
        // food-court tables
        [
          { type: 'table', dx: 0, dy: 0 },
          { type: 'table', dx: 100, dy: 0 },
          { type: 'table', dx: 0, dy: 70 },
          { type: 'table', dx: 100, dy: 70 },
        ],
        // a bank of vending machines against a wall
        [
          { type: 'vending_machine', dx: 0, dy: 0 },
          { type: 'vending_machine', dx: 72, dy: 0 },
        ],
      ],
      singletons: ['couch', 'table', 'vending_machine', 'potted_plant', 'payphone', 'shopping_cart'],
    },
  },

  hospital: {
    id: 'hospital',
    name: 'Empty Ward',
    floorBase: 0x44524f,
    wallBase: 0x5e706c,
    floorTextureKey: 'tex_hospital_floor',
    wallTextureKey: 'tex_hospital_wall',
    furniture: {
      clusters: [
        // a row of beds with a supply cabinet
        [
          { type: 'bed', dx: 0, dy: 0 },
          { type: 'bed', dx: 0, dy: 80 },
          { type: 'closet', dx: 110, dy: 0 },
        ],
        // nurse station
        [
          { type: 'desk', dx: 0, dy: 0 },
          { type: 'desk', dx: 70, dy: 0 },
          { type: 'counter', dx: 0, dy: 60 },
        ],
        // supply corner
        [
          { type: 'closet', dx: 0, dy: 0 },
          { type: 'closet', dx: 60, dy: 0 },
          { type: 'shelf', dx: 0, dy: 80 },
        ],
      ],
      singletons: ['bed', 'closet', 'water_cooler', 'potted_plant'],
    },
  },

  hotel: {
    id: 'hotel',
    name: 'Overlook Halls',
    floorBase: 0x53402c,
    wallBase: 0x6f4636,
    floorTextureKey: 'tex_hotel_floor',
    wallTextureKey: 'tex_hotel_wall',
    furniture: {
      clusters: [
        // a guest room set
        [
          { type: 'bed', dx: 0, dy: 0 },
          { type: 'armoire', dx: 110, dy: 0 },
          { type: 'closet', dx: 110, dy: 80 },
        ],
        // lobby lounge
        [
          { type: 'couch', dx: 0, dy: 0 },
          { type: 'couch', dx: 0, dy: 70 },
          { type: 'table', dx: 110, dy: 20 },
        ],
        // vanity nook
        [
          { type: 'desk', dx: 0, dy: 0 },
          { type: 'armoire', dx: 80, dy: 0 },
          { type: 'table', dx: 0, dy: 60 },
        ],
      ],
      singletons: ['bed', 'armoire', 'couch', 'potted_plant', 'payphone'],
    },
  },

  office: {
    id: 'office',
    name: 'Cubicle Maze',
    floorBase: 0x685b39,
    wallBase: 0x847848,
    floorTextureKey: 'tex_office_floor',
    wallTextureKey: 'tex_office_wall',
    furniture: {
      clusters: [
        // a pod of desks all facing one way
        [
          { type: 'desk', dx: 0, dy: 0 },
          { type: 'desk', dx: 90, dy: 0 },
          { type: 'desk', dx: 0, dy: 70 },
          { type: 'desk', dx: 90, dy: 70 },
        ],
        // meeting nook
        [
          { type: 'table', dx: 60, dy: 0 },
          { type: 'couch', dx: 0, dy: 70 },
          { type: 'couch', dx: 110, dy: 70 },
        ],
        // supply corner
        [
          { type: 'closet', dx: 0, dy: 0 },
          { type: 'closet', dx: 60, dy: 0 },
          { type: 'shelf', dx: 0, dy: 80 },
        ],
        // a row of lockers down a wall
        [
          { type: 'lockers', dx: 0, dy: 0 },
          { type: 'lockers', dx: 110, dy: 0 },
        ],
      ],
      singletons: ['desk', 'lockers', 'vending_machine', 'water_cooler'],
    },
  },

  warehouse: {
    id: 'warehouse',
    name: 'Storeroom',
    floorBase: 0x40372a,
    wallBase: 0x5a4c38,
    floorTextureKey: 'tex_warehouse_floor',
    wallTextureKey: 'tex_warehouse_wall',
    furniture: {
      clusters: [
        // storage aisle
        [
          { type: 'shelf', dx: 0, dy: 0 },
          { type: 'shelf', dx: 0, dy: 50 },
          { type: 'shelf', dx: 0, dy: 100 },
          { type: 'closet', dx: 120, dy: 30 },
        ],
        // stacked crates (tables stand in for pallets)
        [
          { type: 'table', dx: 0, dy: 0 },
          { type: 'table', dx: 100, dy: 0 },
          { type: 'table', dx: 0, dy: 70 },
          { type: 'table', dx: 100, dy: 70 },
        ],
        // loading counter
        [
          { type: 'counter', dx: 0, dy: 0 },
          { type: 'shelf', dx: 0, dy: 50 },
          { type: 'shelf', dx: 0, dy: 90 },
        ],
      ],
      singletons: ['shelf', 'closet', 'lockers', 'shopping_cart'],
    },
  },
};

// Resolve a concrete per-room vibe for a zone: the zone's identity plus a
// per-room jittered shade of its palette. `seed` is the room's content seed, so
// each room in a zone gets a stable but distinct shade.
export function getRoomVibe(zoneId, seed) {
  const zone = ZONES[zoneId] || ZONES.office;
  const rand = mulberry32(seed + VIBE_SEED_OFFSET);
  return {
    id: zone.id,
    name: zone.name,
    floorColor: jitterColor(zone.floorBase, rand, JITTER),
    wallColor: jitterColor(zone.wallBase, rand, JITTER),
    floorTextureKey: zone.floorTextureKey,
    wallTextureKey: zone.wallTextureKey,
    furniture: zone.furniture,
  };
}
