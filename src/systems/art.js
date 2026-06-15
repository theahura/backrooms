import { UPGRADES } from './shop.js';

// --- Texture source selection (PNG-then-procedural fallback) ---------------
// The game loads AI-generated PNGs in preload(). For any sprite key whose PNG
// is missing (e.g. asset generation has not been run), the game falls back to
// the procedural pixel-grid textures. `hasTexture` is a predicate over loaded
// texture keys (Phaser's `this.textures.exists`).
export function getTextureSource(hasTexture, key) {
  return hasTexture(key) ? 'png' : 'procedural';
}

// --- Chroma key decision ----------------------------------------------------
// nano banana cannot output transparency, so sprites are generated on a solid
// background that is flood-filled out to alpha in post. The model's background
// colour is inconsistent (bright green, grey-green, even purple), so we key by
// similarity to the image's OWN sampled corner colour rather than a fixed hue.
export const BG_TOLERANCE = 75;

export function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Per-pixel decision used by the flood-fill background remover: a pixel is
// background if it is already transparent, or its colour is close to the
// sampled background reference colour.
export function isBackgroundSample(r, g, b, a, refR, refG, refB) {
  if (a === 0) return true;
  return colorDistance(r, g, b, refR, refG, refB) < BG_TOLERANCE;
}

// --- Shop upgrade icon mapping ---------------------------------------------
const UPGRADE_IDS = new Set(UPGRADES.map((u) => u.id));

export function shopIconKey(upgradeId) {
  if (!UPGRADE_IDS.has(upgradeId)) return null;
  return `shop_icon_${upgradeId}`;
}

// --- Art generation manifest ------------------------------------------------
// Each entry produces ONE generated image that is written to every texture key
// in `keys`. Character entries fan one sprite out across their animation
// frames (AI multi-frame walk cycles are not consistent enough to be worth the
// risk for dimly-lit top-down sprites). `chroma: false` skips the green-screen
// key-out (used for the opaque shop background).
const SPRITE_SUFFIX =
  'Strict orthographic top-down view as seen from a ceiling-mounted camera ' +
  'looking straight down, strict 90-degree overhead angle showing ONLY the top ' +
  'surface, no front view, no perspective, no isometric or tilted view, ' +
  '2D video game sprite, pixel art style, limited color palette, flat colors, ' +
  'bold dark outline around the shape, no drop shadow, single centered object ' +
  'that fills most of the frame. CRITICAL BACKGROUND REQUIREMENT: the entire ' +
  'background must be solid flat chroma key green, exact hex #00FF00 ' +
  '(RGB 0,255,0), with NO gradient, NO noise, NO texture and NO shadow.';

const ICON_SUFFIX =
  'Simple flat game UI icon, pixel art style, bold readable silhouette, limited ' +
  'color palette, single centered symbol that fills most of the frame. CRITICAL ' +
  'BACKGROUND REQUIREMENT: the entire background must be solid flat chroma key ' +
  'green, exact hex #00FF00 (RGB 0,255,0), with NO gradient, NO noise and NO shadow.';

// Upright billboard props are drawn FRONT-ON (elevation), the opposite of the
// top-down SPRITE_SUFFIX, so they stand up in the world like the player/enemy.
const PROP_SUFFIX =
  'Front elevation view seen straight on at eye level with a very slight ' +
  'downward angle, the object standing upright with its full front face visible, ' +
  'orthographic, no perspective distortion. A single centered object that fills ' +
  'most of the frame. 2D video game prop sprite, pixel art style, limited ' +
  'desaturated palette, grimy liminal-space horror mood, flat even lighting, ' +
  'bold dark outline around the shape, NO cast shadow, NO ground, NO floor. ' +
  'CRITICAL BACKGROUND REQUIREMENT: the entire background must be solid flat ' +
  'chroma key green, exact hex #00FF00 (RGB 0,255,0), with NO gradient, NO ' +
  'noise, NO texture and NO shadow.';

function sprite(subject) {
  return `${subject}. ${SPRITE_SUFFIX}`;
}
function icon(subject) {
  return `${subject}. ${ICON_SUFFIX}`;
}
function prop(subject) {
  return `${subject}. ${PROP_SUFFIX}`;
}

export const ART_MANIFEST = [
  // NOTE: characters (player/enemy/crawler/spitter) are intentionally NOT here.
  // The image model reverts to front/3-4 views for anything with vertical
  // structure, so a person/creature seen from directly overhead comes out
  // wrong, and at sprite sizes the downscale destroys detail. They are
  // hand-authored top-down pixel art in sprites.js instead (see SPRITE_DEFS /
  // scripts/gen-character-sprites.mjs).

  // Furniture (stretched to logical size in-game, so generated at higher res).
  { id: 'furniture_table', prompt: sprite('The flat rectangular top surface of a wooden table, only the tabletop visible, no legs visible'), width: 160, height: 100, keys: ['furniture_table'] },
  { id: 'furniture_shelf', prompt: sprite('The top surface of a long low wooden storage shelf, only the top plank visible'), width: 200, height: 40, keys: ['furniture_shelf'] },
  { id: 'furniture_desk', prompt: sprite('The flat rectangular top surface of a grey office desk with papers on it, only the desktop visible, no drawers visible'), width: 120, height: 80, keys: ['furniture_desk'] },
  { id: 'furniture_bookcase', prompt: sprite('The top panel of a tall wooden bookcase, a flat rectangular wooden slab, no shelves or books visible'), width: 60, height: 160, keys: ['furniture_bookcase'] },
  { id: 'furniture_bed', prompt: sprite('A bed with a mattress and pillow and blanket seen from directly straight above'), width: 180, height: 120, keys: ['furniture_bed'] },
  { id: 'furniture_closet', prompt: sprite('The flat rectangular top panel of a grey metal storage cabinet, only the top surface visible, no doors visible'), width: 100, height: 120, keys: ['furniture_closet'] },
  { id: 'furniture_vent', prompt: sprite('A square metal floor air vent grate seen from directly straight above'), width: 60, height: 60, keys: ['furniture_vent'] },
  // armoire, couch and counter are hand-authored procedural top-down art
  // (sprites.js): the model draws them as front-facing furniture with visible
  // doors / backrests / a checkout till despite "top surface only" prompts.
  { id: 'furniture_tree', prompt: sprite('The leafy round canopy of a tree seen from directly straight above, dense green foliage filling the frame'), width: 128, height: 128, keys: ['furniture_tree'] },
  { id: 'furniture_rock', prompt: sprite('A large grey boulder rock seen from directly straight above'), width: 112, height: 96, keys: ['furniture_rock'] },
  { id: 'furniture_bush', prompt: sprite('A low leafy green shrub bush seen from directly straight above'), width: 112, height: 88, keys: ['furniture_bush'] },
  { id: 'furniture_console', prompt: sprite('A spaceship control console panel with glowing cyan screens and buttons seen from directly straight above'), width: 192, height: 80, keys: ['furniture_console'] },
  { id: 'furniture_pod', prompt: sprite('A sci-fi cryo sleep pod with a glass canopy seen from directly straight above'), width: 112, height: 176, keys: ['furniture_pod'] },

  // 2.5D upright billboard props (front elevation, stood up in the world). Sizes
  // are the VISUAL standee size; the in-game floor footprint is smaller (see
  // FURNITURE_TYPES). Keys are furniture_<type> so they load like any furniture.
  { id: 'furniture_vending_machine', prompt: prop('A tall glass-front vending machine stocked with cans and snacks behind the glass, faint cold internal glow'), width: 128, height: 240, keys: ['furniture_vending_machine'] },
  { id: 'furniture_lockers', prompt: prop('A bank of four tall dented metal school lockers standing side by side, institutional grey-green, with vents and latches'), width: 208, height: 224, keys: ['furniture_lockers'] },
  { id: 'furniture_water_cooler', prompt: prop('An office water cooler dispenser with an upturned pale blue water jug on top and two spigots'), width: 80, height: 168, keys: ['furniture_water_cooler'] },
  { id: 'furniture_potted_plant', prompt: prop('A tall potted ficus house plant with slightly wilted dark green leaves in a plain ceramic pot'), width: 112, height: 208, keys: ['furniture_potted_plant'] },
  { id: 'furniture_payphone', prompt: prop('A wall payphone on a short metal stand with a coin box, keypad and hanging handset'), width: 88, height: 192, keys: ['furniture_payphone'] },
  { id: 'furniture_shopping_cart', prompt: prop('An abandoned metal wire shopping cart with a child seat, slightly rusted, seen from the front'), width: 120, height: 144, keys: ['furniture_shopping_cart'] },

  // Weapon pickups.
  { id: 'pickup_pistol', prompt: sprite('A handgun pistol weapon lying on the ground seen from directly straight above'), width: 28, height: 20, keys: ['pickup_pistol'] },
  { id: 'pickup_shotgun', prompt: sprite('A pump shotgun weapon lying on the ground seen from directly straight above'), width: 32, height: 20, keys: ['pickup_shotgun'] },
  { id: 'pickup_rifle', prompt: sprite('A rifle weapon lying on the ground seen from directly straight above'), width: 32, height: 20, keys: ['pickup_rifle'] },

  // Misc world objects.
  { id: 'lore_note', prompt: sprite('An old worn yellowed paper note with faint handwriting seen from directly straight above'), width: 24, height: 20, keys: ['lore_note'] },
  { id: 'switch_off', prompt: sprite('A wall mounted light switch toggled to the OFF position, dark'), width: 20, height: 28, keys: ['switch_off'] },
  { id: 'switch_on', prompt: sprite('A wall mounted light switch toggled to the ON position, faintly glowing'), width: 20, height: 28, keys: ['switch_on'] },
  { id: 'door_closed', prompt: sprite('A closed wooden door panel seen from directly straight above'), width: 28, height: 32, keys: ['door_closed'] },
  { id: 'item_battery', prompt: sprite('A glowing green battery power cell item'), width: 20, height: 28, keys: ['item_battery'] },
  { id: 'item_medkit', prompt: sprite('A white first aid medkit box with a red cross'), width: 20, height: 20, keys: ['item_medkit'] },
  { id: 'item_gem', prompt: sprite('A shiny cut cyan gemstone treasure jewel'), width: 20, height: 20, keys: ['item_gem'] },

  // Shop background scene (opaque, no chroma key).
  {
    id: 'shop_bg',
    prompt:
      'A dark cozy 2D pixel-art shop interior storefront: wooden shelves stocked ' +
      'with mysterious adventuring gear, lanterns, a shopkeeper counter, warm ' +
      'dim lighting against deep shadow, eerie backrooms horror atmosphere. ' +
      'Wide background scene, pixel art style, no text, no words, no letters.',
    width: 768,
    height: 576,
    chroma: false,
    keys: ['shop_bg'],
  },

  // Shop upgrade icons.
  { id: 'shop_icon_battery', prompt: icon('A glowing battery power cell'), width: 48, height: 48, keys: ['shop_icon_battery'] },
  { id: 'shop_icon_flashlight', prompt: icon('A flashlight casting a light beam cone'), width: 48, height: 48, keys: ['shop_icon_flashlight'] },
  { id: 'shop_icon_health', prompt: icon('A red heart with a small white cross'), width: 48, height: 48, keys: ['shop_icon_health'] },
  { id: 'shop_icon_speed', prompt: icon('A running boot with speed motion lines'), width: 48, height: 48, keys: ['shop_icon_speed'] },
  { id: 'shop_icon_weaponDamage', prompt: icon('A bullet with an impact burst'), width: 48, height: 48, keys: ['shop_icon_weaponDamage'] },
  { id: 'shop_icon_fireRate', prompt: icon('A stopwatch overlaid with bullets'), width: 48, height: 48, keys: ['shop_icon_fireRate'] },
  { id: 'shop_icon_bulletRange', prompt: icon('A target crosshair with an arrow flying toward it'), width: 48, height: 48, keys: ['shop_icon_bulletRange'] },
  { id: 'shop_icon_backpack', prompt: icon('An explorer travel backpack'), width: 48, height: 48, keys: ['shop_icon_backpack'] },
  { id: 'shop_icon_startingPistol', prompt: icon('A handgun pistol'), width: 48, height: 48, keys: ['shop_icon_startingPistol'] },
  { id: 'shop_icon_startingShotgun', prompt: icon('A pump shotgun'), width: 48, height: 48, keys: ['shop_icon_startingShotgun'] },
  { id: 'shop_icon_startingRifle', prompt: icon('A rifle'), width: 48, height: 48, keys: ['shop_icon_startingRifle'] },
  { id: 'shop_icon_minimap', prompt: icon('A folded paper treasure map'), width: 48, height: 48, keys: ['shop_icon_minimap'] },
  { id: 'shop_icon_rechargeBattery', prompt: icon('A battery power cell encircled by two curved recharge arrows'), width: 48, height: 48, keys: ['shop_icon_rechargeBattery'] },
];

export function getArtSpriteKeys() {
  return ART_MANIFEST.flatMap((entry) => entry.keys);
}

// --- Zone floor/wall textures ----------------------------------------------
// Tileable, opaque (no chroma) textures generated by scripts/gen-textures.mjs
// and drawn as repeating TileSprites per zone (see roomVibes.js texture keys).
// Each is post-processed to tile seamlessly. Liminal direction: empty,
// institutional, evenly lit, no people, no text.
const TEX_FLOOR_SUFFIX =
  'Seamless tileable texture, strict flat top-down overhead view of a floor, ' +
  'even flat lighting with NO vignette, NO directional shadow, NO bright center, ' +
  'uniform across the whole image, photorealistic but slightly desaturated and ' +
  'grim, no objects, no people, no text. The pattern must repeat seamlessly when tiled.';
const TEX_WALL_SUFFIX =
  'Seamless tileable texture of a wall surface seen straight on, ' +
  'even flat lighting with NO vignette, NO directional shadow, uniform across the ' +
  'whole image, slightly desaturated and grim, no objects, no people, no text. ' +
  'The pattern must repeat seamlessly when tiled.';

function floorTex(subject) {
  return `${subject}. ${TEX_FLOOR_SUFFIX}`;
}
function wallTex(subject) {
  return `${subject}. ${TEX_WALL_SUFFIX}`;
}

export const TEXTURE_MANIFEST = [
  { id: 'tex_mall_floor', prompt: floorTex('Polished beige terrazzo shopping-mall floor with subtle speckled stone aggregate and faint tile grout lines'), size: 512, key: 'tex_mall_floor' },
  { id: 'tex_mall_wall', prompt: wallTex('Beige and tan rectangular stone cladding panels of a shopping-mall wall, regular masonry grid'), size: 512, key: 'tex_mall_wall' },

  { id: 'tex_hospital_floor', prompt: floorTex('Pale grey-green vinyl sheet hospital floor with faint scuff marks, very clean and cold'), size: 512, key: 'tex_hospital_floor' },
  { id: 'tex_hospital_wall', prompt: wallTex('Smooth pale mint-green and white painted hospital corridor wall, faint stains'), size: 512, key: 'tex_hospital_wall' },

  { id: 'tex_hotel_floor', prompt: floorTex('Vintage 1970s hotel carpet, repeating orange brown and dark red hexagon pattern in the style of the Overlook Hotel Hicks hexagon carpet'), size: 512, key: 'tex_hotel_floor' },
  { id: 'tex_hotel_wall', prompt: wallTex('Dark red and faded gold damask hotel corridor wallpaper, ornate repeating vertical pattern'), size: 512, key: 'tex_hotel_wall' },

  { id: 'tex_office_floor', prompt: floorTex('Damp yellowed low-pile commercial office carpet, mono-yellow backrooms aesthetic, faint stains and worn patches'), size: 512, key: 'tex_office_floor' },
  { id: 'tex_office_wall', prompt: wallTex('Yellowed institutional office wallpaper, mono-yellow backrooms aesthetic, faint vertical seams and water stains'), size: 512, key: 'tex_office_wall' },

  { id: 'tex_warehouse_floor', prompt: floorTex('Bare grey concrete warehouse floor with faint cracks, oil stains and a painted line'), size: 512, key: 'tex_warehouse_floor' },
  { id: 'tex_warehouse_wall', prompt: wallTex('Corrugated grey galvanized metal warehouse wall siding with vertical ribs, scuffed and industrial'), size: 512, key: 'tex_warehouse_wall' },
];

export function getTextureKeys() {
  return TEXTURE_MANIFEST.map((entry) => entry.key);
}
