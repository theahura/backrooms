import { mulberry32 } from './random.js';

export const FURNITURE_TYPES = {
  table: { width: 80, height: 50, color: 0x5c3a21, canHide: true, blocksLight: false },
  shelf: { width: 100, height: 20, color: 0x6b4e2a, canHide: false, blocksLight: true },
  desk: { width: 60, height: 40, color: 0x3a3a3a, canHide: true, blocksLight: false },
  bookcase: { width: 30, height: 80, color: 0x4a2c17, canHide: false, blocksLight: true },
  bed: { width: 90, height: 60, color: 0x4a3a3a, canHide: true, blocksLight: false },
  armoire: { width: 40, height: 70, color: 0x5c3a21, canHide: true, blocksLight: true },
  closet: { width: 50, height: 60, color: 0x3a3a3a, canHide: true, blocksLight: true },
  vent: { width: 30, height: 30, color: 0x666666, canHide: true, blocksLight: false },
  couch: { width: 90, height: 40, color: 0x6a5a44, canHide: false, blocksLight: false },
  counter: { width: 100, height: 30, color: 0x7a6a50, canHide: false, blocksLight: true },
  // Forest vibe: overgrowth that has crept into the backrooms.
  tree: { width: 64, height: 64, color: 0x3a5a32, canHide: false, blocksLight: true },
  rock: { width: 56, height: 48, color: 0x5a5a52, canHide: false, blocksLight: true },
  bush: { width: 56, height: 44, color: 0x4a6a3a, canHide: true, blocksLight: false },
  // Spaceship vibe: derelict control bay.
  console: { width: 96, height: 40, color: 0x2a3a40, canHide: false, blocksLight: true },
  pod: { width: 56, height: 88, color: 0x4a5a60, canHide: true, blocksLight: false },
  // 2.5D upright billboard props -- rendered as front-elevation standees that
  // rise above a small floor footprint (the width/height here). `spriteWidth`/
  // `spriteHeight` are the VISUAL size; placement, collision and light occlusion
  // all use the footprint, so a tall standee never becomes a tall wall.
  // spriteHeight is sized against the ~48px player (a person): a vending machine
  // and lockers stand about person-height, a tall ficus a little over, while a
  // water cooler, payphone and shopping cart are clearly shorter than a person.
  // spriteWidth keeps the cropped art's aspect so nothing is stretched; the
  // footprint (width/height) is the floor the prop occupies for collision.
  vending_machine: { width: 22, height: 14, color: 0x39506a, canHide: false, blocksLight: true, upright: true, spriteWidth: 25, spriteHeight: 52 },
  lockers: { width: 44, height: 14, color: 0x5d7064, canHide: false, blocksLight: true, upright: true, spriteWidth: 47, spriteHeight: 50 },
  water_cooler: { width: 15, height: 12, color: 0x9ab2c2, canHide: false, blocksLight: false, upright: true, spriteWidth: 15, spriteHeight: 36 },
  potted_plant: { width: 18, height: 16, color: 0x4a5a36, canHide: false, blocksLight: false, upright: true, spriteWidth: 19, spriteHeight: 56 },
  payphone: { width: 13, height: 10, color: 0x46464f, canHide: false, blocksLight: false, upright: true, spriteWidth: 13, spriteHeight: 40 },
  shopping_cart: { width: 24, height: 16, color: 0x8a8a92, canHide: false, blocksLight: false, upright: true, spriteWidth: 25, spriteHeight: 34 },
  // Second wave of liminal props. `variants: N` means the prop has N distinct
  // generated images (furniture_<type>_0..N-1) and each placement deterministically
  // picks one from its position (propVariantKey), so a room of trash cans or
  // mannequins is varied instead of copy-pasted.
  // Mall.
  mall_directory: { width: 18, height: 12, color: 0x2a3a4a, canHide: false, blocksLight: true, upright: true, spriteWidth: 22, spriteHeight: 54 },
  mall_bench: { width: 40, height: 16, color: 0x6a5a44, canHide: false, blocksLight: false, upright: true, spriteWidth: 44, spriteHeight: 22 },
  trash_can: { width: 14, height: 12, color: 0x55585a, canHide: false, blocksLight: false, upright: true, spriteWidth: 16, spriteHeight: 30, variants: 3 },
  mannequin: { width: 12, height: 10, color: 0xb9b2a6, canHide: false, blocksLight: false, upright: true, spriteWidth: 18, spriteHeight: 52, variants: 3 },
  // Hospital.
  wheelchair: { width: 20, height: 16, color: 0x8a9098, canHide: false, blocksLight: false, upright: true, spriteWidth: 26, spriteHeight: 38 },
  iv_stand: { width: 12, height: 12, color: 0xb0b6bc, canHide: false, blocksLight: false, upright: true, spriteWidth: 14, spriteHeight: 54 },
  hospital_chairs: { width: 34, height: 16, color: 0x4f6f6a, canHide: false, blocksLight: false, upright: true, spriteWidth: 40, spriteHeight: 34 },
  supply_cart: { width: 18, height: 14, color: 0x9aa0a6, canHide: false, blocksLight: false, upright: true, spriteWidth: 22, spriteHeight: 36 },
  // Hotel.
  reception_desk: { width: 50, height: 18, color: 0x5c3a21, canHide: false, blocksLight: true, upright: true, spriteWidth: 56, spriteHeight: 40 },
  ice_machine: { width: 20, height: 14, color: 0x70757a, canHide: false, blocksLight: true, upright: true, spriteWidth: 26, spriteHeight: 50 },
  luggage_cart: { width: 24, height: 16, color: 0x7a5a3a, canHide: false, blocksLight: false, upright: true, spriteWidth: 30, spriteHeight: 40 },
  // Office.
  filing_cabinet: { width: 16, height: 14, color: 0x6a6e72, canHide: false, blocksLight: true, upright: true, spriteWidth: 20, spriteHeight: 46 },
  office_chair: { width: 18, height: 16, color: 0x35373a, canHide: false, blocksLight: false, upright: true, spriteWidth: 24, spriteHeight: 34 },
  cubicle_partition: { width: 44, height: 10, color: 0x8a8676, canHide: false, blocksLight: true, upright: true, spriteWidth: 50, spriteHeight: 46 },
  // Warehouse.
  pallet_rack: { width: 46, height: 14, color: 0x86643a, canHide: false, blocksLight: true, upright: true, spriteWidth: 52, spriteHeight: 58 },
  forklift: { width: 30, height: 20, color: 0xc2a032, canHide: false, blocksLight: true, upright: true, spriteWidth: 36, spriteHeight: 46 },
  oil_barrel: { width: 16, height: 16, color: 0x7a4a32, canHide: false, blocksLight: false, upright: true, spriteWidth: 20, spriteHeight: 34 },
};

// Texture key for a placed prop. A type with `variants` deterministically maps
// its floor position to one of N generated images so repeated props in a room
// (trash cans, mannequins) don't all look identical; a type without variants
// uses the plain furniture_<type> key. Position hashing keeps the choice stable
// across re-renders of the same room.
export function propVariantKey(type, x, y, variantCount = 1) {
  if (!variantCount || variantCount <= 1) return `furniture_${type}`;
  const ix = Math.floor(x) | 0;
  const iy = Math.floor(y) | 0;
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
  h = (h ^ (h >>> 13)) >>> 0;
  return `furniture_${type}_${h % variantCount}`;
}

// Draw-order key for an upright billboard prop. Props sort among themselves by
// the world-Y of their base ("feet"): one further south (larger feetY) draws in
// front. The result stays in the band [110, 120) -- ABOVE the darkness overlay
// (depth 100) so the flashlight can light a prop's full upright height (GameScene
// tints each prop by the light sampled at its base) instead of leaving the body a
// black silhouette, and below the player (200) so an unoccluded prop never covers
// them. Depth tracks position WITHIN the floor band (feetY - floorBaseY), with
// headroom for rooms north of the origin; rooms far beyond the headroom clamp
// together but are never on screen at the same time.
const BILLBOARD_DEPTH_BASE = 110;
const BILLBOARD_DEPTH_SPAN = 9.99;
const BILLBOARD_DEPTH_HEADROOM = 30000;

export function billboardDepth(feetY, floorBaseY) {
  const local = feetY - floorBaseY + BILLBOARD_DEPTH_HEADROOM;
  const clamped = Math.min(99900, Math.max(0, local));
  return BILLBOARD_DEPTH_BASE + Math.min(BILLBOARD_DEPTH_SPAN, clamped * 0.0001);
}

// The player is pinned above the darkness/damage layers, so it can't be lowered
// into the billboard band. Instead, an upright prop draws OVER the player (and
// thus occludes them) exactly when the player stands behind it and overlaps it
// on screen -- i.e. the player's feet point falls inside the prop's standee box
// AND is north of (above) the prop's base. `prop` is { cx, baseY, spriteWidth,
// spriteHeight }. playerFeetY is the player's ground contact point.
const PLAYER_OVERLAP_MARGIN = 16;

export function shouldPropDrawOverPlayer(prop, playerX, playerFeetY, playerHalfWidth = PLAYER_OVERLAP_MARGIN) {
  const halfW = prop.spriteWidth / 2 + playerHalfWidth;
  const overlapsX = Math.abs(playerX - prop.cx) < halfW;
  const behindAndOverlapping = playerFeetY < prop.baseY && playerFeetY > prop.baseY - prop.spriteHeight;
  return overlapsX && behindAndOverlapping;
}

// Furniture is placed as semantic clusters -- recognizable arrangements left
// behind by whoever furnished these rooms -- rather than uniform scatter.
// Familiar-but-abandoned groupings are what make the rooms read as liminal.
const CLUSTER_TEMPLATES = [
  // office pod: desks in a grid, all facing the same way
  [
    { type: 'desk', dx: 0, dy: 0 },
    { type: 'desk', dx: 90, dy: 0 },
    { type: 'desk', dx: 0, dy: 70 },
    { type: 'desk', dx: 90, dy: 70 },
  ],
  // waiting row: couches in a line facing nothing, table at the end
  [
    { type: 'couch', dx: 0, dy: 0 },
    { type: 'couch', dx: 100, dy: 0 },
    { type: 'couch', dx: 200, dy: 0 },
    { type: 'table', dx: 100, dy: 70 },
  ],
  // storage aisle: parallel shelving with a closet at the end
  [
    { type: 'shelf', dx: 0, dy: 0 },
    { type: 'shelf', dx: 0, dy: 50 },
    { type: 'shelf', dx: 0, dy: 100 },
    { type: 'closet', dx: 120, dy: 30 },
  ],
  // abandoned bedroom set
  [
    { type: 'bed', dx: 0, dy: 0 },
    { type: 'armoire', dx: 110, dy: 0 },
    { type: 'closet', dx: 110, dy: 80 },
  ],
  // reading corner: bookcase row with a desk pulled up to it
  [
    { type: 'bookcase', dx: 0, dy: 0 },
    { type: 'bookcase', dx: 40, dy: 0 },
    { type: 'bookcase', dx: 80, dy: 0 },
    { type: 'desk', dx: 30, dy: 95 },
  ],
  // cafeteria counter with tables pushed against it
  [
    { type: 'counter', dx: 0, dy: 0 },
    { type: 'table', dx: 10, dy: 50 },
    { type: 'table', dx: 110, dy: 50 },
  ],
];

const SINGLETON_TYPES = ['vent', 'armoire', 'closet', 'table'];

// Used when no vibe-specific profile is supplied (e.g. the starting room is
// furnished separately, and tests exercise the generic mix). roomVibes.js
// supplies a per-vibe profile for the procedurally generated backrooms.
const DEFAULT_PROFILE = { clusters: CLUSTER_TEMPLATES, singletons: SINGLETON_TYPES };

const SINGLETON_COUNT = 3;
const CLUSTER_PADDING = 16;
const SPAWN_ZONE_PADDING = 20;
// Small clearance so furniture sits flush-but-not-embedded against an obstacle
// (maze wall or door entry zone). rectsOverlap applies padding to both rects,
// so this is an ~8px gap. Kept well below CLUSTER_PADDING so dense rooms can
// still hug their internal walls.
const OBSTACLE_CLEARANCE = 4;
// Wide enough that the wall-adjacent channel stays walkable and door entry
// zones (which reach ~80px into the room) stay mostly clear.
const WALL_MARGIN = 56;

// Tall, solid furniture is cover that stops gunfire; low furniture (tables,
// desks, beds) is shot across. This is the same tall/solid distinction that
// occludes the flashlight and blocks line of sight, so bullet-blocking is kept
// identical to light-blocking -- a player never shoots through something opaque
// they cannot see through. Unknown types do not block bullets.
export function blocksBullets(type) {
  const def = FURNITURE_TYPES[type];
  return !!(def && def.blocksLight);
}

// The AI-generated furniture PNGs carry transparent padding, so the visible art
// fills only part of the texture. opaqueBounds scans an RGBA pixel buffer and
// returns the bounding box of the non-transparent pixels (or null if fully
// transparent). Used to shrink a furniture piece's collision body and light
// occluder to where the art actually is, so the hitbox matches the visuals.
export function opaqueBounds(data, width, height, threshold = 16) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// Maps a furniture piece's NORMALIZED opaque-art box (fractions of the texture,
// 0..1) onto its world rect, yielding the rectangle the art actually occupies on
// screen. The sprite is still drawn stretched to the full logical rect; this is
// the sub-rect used for the collision body and the light occluder so they line
// up with the visible art instead of the transparent padding.
export function visibleFurnitureRect(item, frac) {
  return {
    x: item.x + frac.x * item.width,
    y: item.y + frac.y * item.height,
    width: frac.width * item.width,
    height: frac.height * item.height,
  };
}

export function createFurnitureSegments(x, y, width, height) {
  return [
    { x1: x, y1: y, x2: x + width, y2: y },
    { x1: x + width, y1: y, x2: x + width, y2: y + height },
    { x1: x + width, y1: y + height, x2: x, y2: y + height },
    { x1: x, y1: y + height, x2: x, y2: y },
  ];
}

function rectsOverlap(a, b, padding) {
  return (
    a.x - padding < b.x + b.width + padding &&
    a.x + a.width + padding > b.x - padding &&
    a.y - padding < b.y + b.height + padding &&
    a.y + a.height + padding > b.y - padding
  );
}

function templateBounds(template) {
  let width = 0;
  let height = 0;
  for (const piece of template) {
    const def = FURNITURE_TYPES[piece.type];
    width = Math.max(width, piece.dx + def.width);
    height = Math.max(height, piece.dy + def.height);
  }
  return { width, height };
}

function makeItem(type, x, y) {
  const def = FURNITURE_TYPES[type];
  return { type, x, y, width: def.width, height: def.height, color: def.color, canHide: def.canHide };
}

export function generateRoomFurniture(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, profile = DEFAULT_PROFILE, obstacles = [], targetOverride = null) {
  const { clusters, singletons } = profile;
  const rand = mulberry32(seed);
  const minX = roomX + wallThickness + WALL_MARGIN;
  const minY = roomY + wallThickness + WALL_MARGIN;
  const maxX = roomX + roomWidth - wallThickness - WALL_MARGIN;
  const maxY = roomY + roomHeight - wallThickness - WALL_MARGIN;

  // Ambient scatter passes an explicit small cap (and no clusters); normal
  // furnishing scales the count to the room area.
  const target = targetOverride != null ? targetOverride : Math.max(8, Math.round((roomWidth * roomHeight) / 45000));
  const placed = [];

  const spawnZone = {
    x: roomX + roomWidth / 2 - 30,
    y: roomY + roomHeight / 2 - 30,
    width: 60,
    height: 60,
  };

  const fits = candidate =>
    !rectsOverlap(candidate, spawnZone, SPAWN_ZONE_PADDING) &&
    !obstacles.some(obstacle => rectsOverlap(candidate, obstacle, OBSTACLE_CLEARANCE)) &&
    !placed.some(existing => rectsOverlap(existing, candidate, CLUSTER_PADDING));

  const clusterBudget = target - SINGLETON_COUNT;
  for (let attempt = 0; clusters.length > 0 && attempt < 120 && placed.length < clusterBudget; attempt++) {
    const template = clusters[Math.floor(rand() * clusters.length)];
    const bounds = templateBounds(template);

    const availableW = maxX - minX - bounds.width;
    const availableH = maxY - minY - bounds.height;
    if (availableW <= 0 || availableH <= 0) continue;

    const anchorX = minX + Math.floor(rand() * availableW);
    const anchorY = minY + Math.floor(rand() * availableH);

    const pieces = template.map(p => makeItem(p.type, anchorX + p.dx, anchorY + p.dy));
    if (pieces.every(fits)) {
      placed.push(...pieces);
    }
  }

  for (let attempt = 0; attempt < 120 && placed.length < target; attempt++) {
    const type = singletons[Math.floor(rand() * singletons.length)];
    const def = FURNITURE_TYPES[type];

    const availableW = maxX - minX - def.width;
    const availableH = maxY - minY - def.height;
    if (availableW <= 0 || availableH <= 0) continue;

    const candidate = makeItem(type, minX + Math.floor(rand() * availableW), minY + Math.floor(rand() * availableH));
    if (fits(candidate)) {
      placed.push(candidate);
    }
  }

  return placed;
}

// --- Scene set pieces -------------------------------------------------------
// A "scene" is a hand-authored, coherent arrangement of furniture (a reception
// lobby, a hospital ward, a racking aisle) that defines what a room IS, instead
// of scattering pieces at random. planScene drops ONE scene into a room as a
// rigid unit and returns the rectangular CLEARING it occupies; the caller hands
// that clearing to the maze generator as a keep-out, so the maze walls open into
// the set piece -- you wind through bare maze and emerge into a furnished pocket.
const CLEARING_PAD = 40;
const SCENE_PLACE_ATTEMPTS = 60;
// Distinct from the other per-room seed offsets (lore uses 90000, vibe 130000,
// maze 70000) so scene choice doesn't correlate with those systems' draws.
const SCENE_SEED_OFFSET = 33331;

// Bounding box of a scene's piece FOOTPRINTS, in the scene's own dx/dy space.
function sceneFootprint(scene) {
  let minDx = Infinity;
  let minDy = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const piece of scene.pieces) {
    const def = FURNITURE_TYPES[piece.type];
    minDx = Math.min(minDx, piece.dx);
    minDy = Math.min(minDy, piece.dy);
    maxX = Math.max(maxX, piece.dx + def.width);
    maxY = Math.max(maxY, piece.dy + def.height);
  }
  return { minDx, minDy, width: maxX - minDx, height: maxY - minDy };
}

// Place one of `scenes` (chosen by seed) into the room and return { items,
// clearing }. The clearing is the footprint box grown by CLEARING_PAD so there
// is walkable floor around the set piece. Returns { items: [], clearing: null }
// when there are no scenes or the chosen one cannot fit clear of `reserved`
// (doorways, stairs) -- such rooms are left as pure maze.
export function planScene(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, scenes, reserved = []) {
  if (!scenes || scenes.length === 0) return { items: [], clearing: null };

  const rand = mulberry32(seed + SCENE_SEED_OFFSET);
  const scene = scenes[Math.floor(rand() * scenes.length)];
  const fp = sceneFootprint(scene);
  const clearingW = fp.width + 2 * CLEARING_PAD;
  const clearingH = fp.height + 2 * CLEARING_PAD;

  const minX = roomX + wallThickness;
  const minY = roomY + wallThickness;
  const availW = roomWidth - 2 * wallThickness - clearingW;
  const availH = roomHeight - 2 * wallThickness - clearingH;
  if (availW < 0 || availH < 0) return { items: [], clearing: null };

  for (let attempt = 0; attempt < SCENE_PLACE_ATTEMPTS; attempt++) {
    const clearing = {
      x: minX + Math.floor(rand() * (availW + 1)),
      y: minY + Math.floor(rand() * (availH + 1)),
      width: clearingW,
      height: clearingH,
    };
    if (reserved.some(r => rectsOverlap(clearing, r, 0))) continue;
    // Plant the footprint box at (clearing + pad), then offset each piece by its
    // dx/dy so the whole arrangement keeps its authored shape.
    const originX = clearing.x + CLEARING_PAD - fp.minDx;
    const originY = clearing.y + CLEARING_PAD - fp.minDy;
    const items = scene.pieces.map(p => makeItem(p.type, originX + p.dx, originY + p.dy));
    return { items, clearing };
  }
  return { items: [], clearing: null };
}
