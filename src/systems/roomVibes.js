import { mulberry32 } from './random.js';

// A "vibe" is a coherent identity for a room: its colour palette plus the kind
// of furniture left behind in it. The backrooms still read as liminal because
// every palette stays desaturated and dim -- but each vibe is its OWN dim,
// so moving between a library, a derelict ship bay and an overgrown grove feels
// like crossing into a different place rather than walking the same room twice.
//
// Vibe is an axis ORTHOGONAL to a room's structural layout (open/maze/columns/
// ...). A library can be a maze; a forest can be a column hall. The two are
// drawn from independent seed streams (see VIBE_SEED_OFFSET).

const VIBE_SEED_OFFSET = 130000;

// Cluster = a recognizable arrangement of furniture (relative dx/dy offsets)
// that whoever inhabited this kind of space would have left behind. Singletons
// = stray pieces scattered to fill the room. Both reference furniture.js types.
export const ROOM_VIBES = {
  furnitureStore: {
    id: 'furnitureStore',
    name: 'Furniture Store',
    floorColor: 0x6b5a3f,
    wallColor: 0x7a6a4a,
    furniture: {
      clusters: [
        // showroom waiting row: couches in a line with a coffee table
        [
          { type: 'couch', dx: 0, dy: 0 },
          { type: 'couch', dx: 100, dy: 0 },
          { type: 'couch', dx: 200, dy: 0 },
          { type: 'table', dx: 100, dy: 70 },
        ],
        // checkout counter with display tables
        [
          { type: 'counter', dx: 0, dy: 0 },
          { type: 'table', dx: 10, dy: 50 },
          { type: 'table', dx: 110, dy: 50 },
        ],
        // staged bedroom set
        [
          { type: 'bed', dx: 0, dy: 0 },
          { type: 'armoire', dx: 110, dy: 0 },
          { type: 'closet', dx: 110, dy: 80 },
        ],
      ],
      singletons: ['couch', 'table', 'armoire'],
    },
  },

  library: {
    id: 'library',
    name: 'Library',
    floorColor: 0x3f4a3a,
    wallColor: 0x4e5a44,
    furniture: {
      clusters: [
        // reading corner: a wall of bookcases with a desk pulled up
        [
          { type: 'bookcase', dx: 0, dy: 0 },
          { type: 'bookcase', dx: 40, dy: 0 },
          { type: 'bookcase', dx: 80, dy: 0 },
          { type: 'desk', dx: 30, dy: 95 },
        ],
        // book stacks aisle
        [
          { type: 'shelf', dx: 0, dy: 0 },
          { type: 'shelf', dx: 0, dy: 50 },
          { type: 'shelf', dx: 0, dy: 100 },
          { type: 'closet', dx: 120, dy: 30 },
        ],
        // study table flanked by stacks
        [
          { type: 'table', dx: 0, dy: 0 },
          { type: 'bookcase', dx: 110, dy: 0 },
          { type: 'bookcase', dx: 150, dy: 0 },
        ],
      ],
      singletons: ['bookcase', 'desk', 'table'],
    },
  },

  office: {
    id: 'office',
    name: 'Office',
    floorColor: 0x3c4450,
    wallColor: 0x4a5360,
    furniture: {
      clusters: [
        // office pod: a grid of desks all facing the same way
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
      ],
      singletons: ['desk', 'closet', 'table'],
    },
  },

  spaceship: {
    id: 'spaceship',
    name: 'Derelict Ship',
    floorColor: 0x35454a,
    wallColor: 0x44585e,
    furniture: {
      clusters: [
        // control bank: stacked consoles with a equipment locker
        [
          { type: 'console', dx: 0, dy: 0 },
          { type: 'console', dx: 0, dy: 60 },
          { type: 'closet', dx: 120, dy: 10 },
        ],
        // cryo pod bay
        [
          { type: 'pod', dx: 0, dy: 0 },
          { type: 'pod', dx: 70, dy: 0 },
          { type: 'pod', dx: 140, dy: 0 },
        ],
        // maintenance corner: vents beside a console
        [
          { type: 'vent', dx: 0, dy: 0 },
          { type: 'vent', dx: 50, dy: 0 },
          { type: 'console', dx: 0, dy: 60 },
        ],
      ],
      singletons: ['pod', 'console', 'vent'],
    },
  },

  forest: {
    id: 'forest',
    name: 'Overgrowth',
    floorColor: 0x36402e,
    wallColor: 0x445030,
    furniture: {
      clusters: [
        // grove: a stand of trees with a boulder
        [
          { type: 'tree', dx: 0, dy: 0 },
          { type: 'tree', dx: 90, dy: 10 },
          { type: 'tree', dx: 180, dy: 0 },
          { type: 'rock', dx: 90, dy: 90 },
        ],
        // thicket: dense brush guarded by a tree
        [
          { type: 'bush', dx: 0, dy: 0 },
          { type: 'bush', dx: 70, dy: 0 },
          { type: 'bush', dx: 140, dy: 0 },
          { type: 'tree', dx: 70, dy: 60 },
        ],
        // rocky clearing
        [
          { type: 'rock', dx: 0, dy: 0 },
          { type: 'rock', dx: 80, dy: 0 },
          { type: 'bush', dx: 40, dy: 70 },
        ],
      ],
      singletons: ['tree', 'rock', 'bush'],
    },
  },

  warehouse: {
    id: 'warehouse',
    name: 'Warehouse',
    floorColor: 0x453a2c,
    wallColor: 0x544734,
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
      singletons: ['shelf', 'closet', 'table'],
    },
  },
};

const VIBE_IDS = Object.keys(ROOM_VIBES);

// Deterministic, independent of getRoomType (different seed offset), so the
// same structural layout can wear any vibe.
export function getRoomVibe(seed) {
  const rand = mulberry32(seed + VIBE_SEED_OFFSET);
  const index = Math.floor(rand() * VIBE_IDS.length);
  return ROOM_VIBES[VIBE_IDS[index]];
}
