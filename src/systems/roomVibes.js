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

// Each zone furnishes rooms from `scenes` -- hand-authored coherent set pieces
// (relative dx/dy arrangements: a reception lobby, a hospital ward, a racking
// aisle) one of which is dropped into a maze clearing per room (furniture.js
// planScene) -- plus `ambient`, a small-prop pool scattered lightly in the maze
// gaps. Hero props live only in scenes, never the ambient pool. All reference
// furniture.js types. Bases are chosen so each zone's floor is distinguishable
// from every other even after jitter.
export const ZONES = {
  mall: {
    id: 'mall',
    name: 'Dead Mall',
    floorBase: 0x615a4e,
    wallBase: 0x837a68,
    floorTextureKey: 'tex_mall_floor',
    wallTextureKey: 'tex_mall_wall',
    furniture: {
      scenes: [
        // a storefront window line of faceless mannequins, a bench out front
        { name: 'storefront', pieces: [
          { type: 'mannequin', dx: 0, dy: 0 },
          { type: 'mannequin', dx: 30, dy: 0 },
          { type: 'mannequin', dx: 60, dy: 0 },
          { type: 'mall_bench', dx: 10, dy: 40 },
          { type: 'trash_can', dx: 70, dy: 42 },
        ] },
        // food court: a block of four tables
        { name: 'food-court', pieces: [
          { type: 'table', dx: 0, dy: 0 },
          { type: 'table', dx: 110, dy: 0 },
          { type: 'table', dx: 0, dy: 80 },
          { type: 'table', dx: 110, dy: 80 },
        ] },
        // concourse: a directory kiosk flanked by benches and planters
        { name: 'concourse', pieces: [
          { type: 'mall_directory', dx: 40, dy: 0 },
          { type: 'potted_plant', dx: 0, dy: 0 },
          { type: 'potted_plant', dx: 82, dy: 0 },
          { type: 'mall_bench', dx: 0, dy: 40 },
          { type: 'mall_bench', dx: 60, dy: 40 },
        ] },
        // a bank of vending machines with a bench
        { name: 'vending-bank', pieces: [
          { type: 'vending_machine', dx: 0, dy: 0 },
          { type: 'vending_machine', dx: 30, dy: 0 },
          { type: 'vending_machine', dx: 60, dy: 0 },
          { type: 'trash_can', dx: 92, dy: 2 },
          { type: 'mall_bench', dx: 20, dy: 40 },
        ] },
        // a planted seating nook with an abandoned cart
        { name: 'seating', pieces: [
          { type: 'potted_plant', dx: 0, dy: 0 },
          { type: 'potted_plant', dx: 0, dy: 40 },
          { type: 'mall_bench', dx: 40, dy: 10 },
          { type: 'mall_bench', dx: 40, dy: 50 },
          { type: 'shopping_cart', dx: 90, dy: 20 },
        ] },
      ],
      ambient: ['trash_can', 'potted_plant', 'shopping_cart', 'payphone'],
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
      scenes: [
        // a ward: two beds with IV stands, a supply cart and a cabinet
        { name: 'ward', pieces: [
          { type: 'bed', dx: 0, dy: 0 },
          { type: 'bed', dx: 0, dy: 90 },
          { type: 'iv_stand', dx: 100, dy: 10 },
          { type: 'iv_stand', dx: 100, dy: 100 },
          { type: 'supply_cart', dx: 120, dy: 50 },
          { type: 'closet', dx: 150, dy: 0 },
        ] },
        // nurse station: a counter, two desks, an empty wheelchair
        { name: 'nurse-station', pieces: [
          { type: 'counter', dx: 0, dy: 0 },
          { type: 'desk', dx: 0, dy: 50 },
          { type: 'desk', dx: 70, dy: 50 },
          { type: 'wheelchair', dx: 110, dy: 0 },
        ] },
        // a waiting area: rows of linked chairs, a planter and IV stand
        { name: 'waiting', pieces: [
          { type: 'hospital_chairs', dx: 0, dy: 0 },
          { type: 'hospital_chairs', dx: 0, dy: 40 },
          { type: 'hospital_chairs', dx: 50, dy: 0 },
          { type: 'hospital_chairs', dx: 50, dy: 40 },
          { type: 'potted_plant', dx: 90, dy: 0 },
          { type: 'iv_stand', dx: 90, dy: 40 },
        ] },
        // a supply corner: cabinets, a shelf and a supply cart
        { name: 'supply', pieces: [
          { type: 'closet', dx: 0, dy: 0 },
          { type: 'closet', dx: 60, dy: 0 },
          { type: 'shelf', dx: 0, dy: 80 },
          { type: 'supply_cart', dx: 120, dy: 20 },
        ] },
        // an exam bay: a bed, IV stand, wheelchair and cart
        { name: 'exam-bay', pieces: [
          { type: 'bed', dx: 0, dy: 0 },
          { type: 'iv_stand', dx: 100, dy: 0 },
          { type: 'wheelchair', dx: 100, dy: 30 },
          { type: 'supply_cart', dx: 0, dy: 80 },
        ] },
      ],
      ambient: ['trash_can', 'iv_stand', 'wheelchair', 'potted_plant'],
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
      scenes: [
        // a deserted reception lobby: desk, planters, luggage cart, a bench
        { name: 'reception', pieces: [
          { type: 'reception_desk', dx: 20, dy: 0 },
          { type: 'potted_plant', dx: 0, dy: 0 },
          { type: 'potted_plant', dx: 75, dy: 0 },
          { type: 'luggage_cart', dx: 80, dy: 30 },
          { type: 'mall_bench', dx: 20, dy: 50 },
        ] },
        // a guest room set
        { name: 'guest-room', pieces: [
          { type: 'bed', dx: 0, dy: 0 },
          { type: 'armoire', dx: 100, dy: 0 },
          { type: 'closet', dx: 100, dy: 80 },
          { type: 'payphone', dx: 0, dy: 70 },
        ] },
        // a lobby lounge: facing couches around a table
        { name: 'lounge', pieces: [
          { type: 'couch', dx: 0, dy: 0 },
          { type: 'couch', dx: 0, dy: 60 },
          { type: 'table', dx: 110, dy: 20 },
          { type: 'potted_plant', dx: 100, dy: 0 },
          { type: 'payphone', dx: 100, dy: 80 },
        ] },
        // a vending alcove: ice and vending machines
        { name: 'vending-alcove', pieces: [
          { type: 'ice_machine', dx: 0, dy: 0 },
          { type: 'vending_machine', dx: 30, dy: 0 },
          { type: 'trash_can', dx: 60, dy: 2 },
        ] },
        // a vanity nook
        { name: 'vanity-nook', pieces: [
          { type: 'desk', dx: 0, dy: 0 },
          { type: 'armoire', dx: 80, dy: 0 },
          { type: 'table', dx: 0, dy: 60 },
          { type: 'potted_plant', dx: 100, dy: 80 },
        ] },
      ],
      ambient: ['trash_can', 'potted_plant', 'payphone', 'luggage_cart'],
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
      scenes: [
        // a cubicle farm: partitions with chairs and a filing cabinet
        { name: 'cubicle-farm', pieces: [
          { type: 'cubicle_partition', dx: 0, dy: 0 },
          { type: 'cubicle_partition', dx: 0, dy: 60 },
          { type: 'cubicle_partition', dx: 60, dy: 0 },
          { type: 'office_chair', dx: 10, dy: 20 },
          { type: 'office_chair', dx: 10, dy: 80 },
          { type: 'filing_cabinet', dx: 70, dy: 30 },
        ] },
        // a pod of four desks with a water cooler
        { name: 'desk-pod', pieces: [
          { type: 'desk', dx: 0, dy: 0 },
          { type: 'desk', dx: 80, dy: 0 },
          { type: 'desk', dx: 0, dy: 60 },
          { type: 'desk', dx: 80, dy: 60 },
          { type: 'water_cooler', dx: 150, dy: 0 },
        ] },
        // a break room: vending, water cooler, a table and chair
        { name: 'break-room', pieces: [
          { type: 'vending_machine', dx: 0, dy: 0 },
          { type: 'water_cooler', dx: 30, dy: 0 },
          { type: 'trash_can', dx: 60, dy: 0 },
          { type: 'table', dx: 0, dy: 40 },
          { type: 'office_chair', dx: 90, dy: 40 },
        ] },
        // a records room: a wall of filing cabinets and a cabinet
        { name: 'records', pieces: [
          { type: 'filing_cabinet', dx: 0, dy: 0 },
          { type: 'filing_cabinet', dx: 30, dy: 0 },
          { type: 'filing_cabinet', dx: 60, dy: 0 },
          { type: 'closet', dx: 0, dy: 40 },
          { type: 'office_chair', dx: 70, dy: 40 },
        ] },
        // a locker row with a bench
        { name: 'locker-row', pieces: [
          { type: 'lockers', dx: 0, dy: 0 },
          { type: 'lockers', dx: 55, dy: 0 },
          { type: 'mall_bench', dx: 20, dy: 40 },
          { type: 'trash_can', dx: 70, dy: 42 },
        ] },
      ],
      ambient: ['trash_can', 'office_chair', 'water_cooler', 'vent'],
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
      scenes: [
        // a racking aisle: parallel pallet racks, a forklift and a barrel
        { name: 'racking-aisle', pieces: [
          { type: 'pallet_rack', dx: 0, dy: 0 },
          { type: 'pallet_rack', dx: 0, dy: 70 },
          { type: 'oil_barrel', dx: 55, dy: 0 },
          { type: 'forklift', dx: 70, dy: 30 },
        ] },
        // crate storage: tables stand in for pallet stacks, barrels and a cart
        { name: 'crate-storage', pieces: [
          { type: 'table', dx: 0, dy: 0 },
          { type: 'table', dx: 100, dy: 0 },
          { type: 'table', dx: 0, dy: 70 },
          { type: 'oil_barrel', dx: 100, dy: 70 },
          { type: 'oil_barrel', dx: 130, dy: 70 },
          { type: 'shopping_cart', dx: 100, dy: 100 },
        ] },
        // a loading dock: a counter, shelving, a forklift and a barrel
        { name: 'loading-dock', pieces: [
          { type: 'counter', dx: 0, dy: 0 },
          { type: 'shelf', dx: 0, dy: 50 },
          { type: 'shelf', dx: 0, dy: 90 },
          { type: 'forklift', dx: 120, dy: 0 },
          { type: 'oil_barrel', dx: 120, dy: 50 },
        ] },
        // a shelving aisle with a cabinet
        { name: 'shelving', pieces: [
          { type: 'shelf', dx: 0, dy: 0 },
          { type: 'shelf', dx: 0, dy: 40 },
          { type: 'shelf', dx: 0, dy: 80 },
          { type: 'closet', dx: 120, dy: 0 },
          { type: 'oil_barrel', dx: 120, dy: 80 },
        ] },
        // a cluster of oil drums beside a rack and forklift
        { name: 'barrel-store', pieces: [
          { type: 'oil_barrel', dx: 0, dy: 0 },
          { type: 'oil_barrel', dx: 30, dy: 0 },
          { type: 'oil_barrel', dx: 0, dy: 30 },
          { type: 'oil_barrel', dx: 30, dy: 30 },
          { type: 'pallet_rack', dx: 60, dy: 0 },
          { type: 'forklift', dx: 60, dy: 40 },
        ] },
      ],
      ambient: ['oil_barrel', 'shopping_cart', 'trash_can', 'vent'],
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
