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
  { id: 'furniture_vending_machine', prompt: prop('A tall glass-front vending machine stocked with cans and snacks behind the glass, faint cold internal glow'), width: 128, height: 240, crop: true, keys: ['furniture_vending_machine'] },
  { id: 'furniture_lockers', prompt: prop('A bank of four tall dented metal school lockers standing side by side, institutional grey-green, with vents and latches'), width: 208, height: 224, crop: true, keys: ['furniture_lockers'] },
  { id: 'furniture_water_cooler', prompt: prop('A short squat office water cooler about waist height, a clear pale-blue water jug resting on a boxy white dispenser base with two spigots, the whole unit shorter than a person and fairly wide'), width: 110, height: 132, crop: true, keys: ['furniture_water_cooler'] },
  { id: 'furniture_potted_plant', prompt: prop('A tall potted ficus house plant with slightly wilted dark green leaves in a plain ceramic pot'), width: 112, height: 208, crop: true, keys: ['furniture_potted_plant'] },
  { id: 'furniture_payphone', prompt: prop('A wall payphone on a short metal stand with a coin box, keypad and hanging handset'), width: 88, height: 192, crop: true, keys: ['furniture_payphone'] },
  { id: 'furniture_shopping_cart', prompt: prop('An abandoned metal wire shopping cart seen from the front, the wide wire basket facing the viewer, wider than it is tall, about hip height, slightly rusted'), width: 150, height: 110, crop: true, keys: ['furniture_shopping_cart'] },

  // Second wave of 2.5D upright props (front elevation). Same convention as
  // above: keys are furniture_<type>, sizes are the generated resolution that is
  // cropped and scaled to the standee in-game. Types with several images per kind
  // (trash can, mannequin) carry furniture_<type>_<i> keys -- see propVariantKey.
  // Mall.
  { id: 'furniture_mall_directory', prompt: prop('A tall backlit shopping-mall directory kiosk, a slab on a stand with a glowing YOU ARE HERE store map panel behind scratched plexiglass, no readable text just colored blocks and lines'), width: 110, height: 270, crop: true, keys: ['furniture_mall_directory'] },
  { id: 'furniture_mall_bench', prompt: prop('A long low public mall bench with wooden slats and dark metal end frames, empty, wider than it is tall, about knee-to-hip height'), width: 220, height: 110, crop: true, keys: ['furniture_mall_bench'] },
  { id: 'furniture_trash_can_0', prompt: prop('A dented stainless-steel trash can with a domed swing lid, empty and closed, about hip height'), width: 100, height: 190, crop: true, keys: ['furniture_trash_can_0'] },
  { id: 'furniture_trash_can_1', prompt: prop('A dented stainless-steel trash can overflowing with crumpled paper and garbage spilling over the rim, about hip height'), width: 100, height: 190, crop: true, keys: ['furniture_trash_can_1'] },
  { id: 'furniture_trash_can_2', prompt: prop('A battered stainless-steel trash can with its domed swing lid knocked askew and half off, a little trash poking out, about hip height'), width: 100, height: 190, crop: true, keys: ['furniture_trash_can_2'] },
  { id: 'furniture_mannequin_0', prompt: prop('A faceless matte pale-grey retail store mannequin standing upright with both arms straight down at its sides, smooth featureless head, bare unclothed body on a slim pole base'), width: 96, height: 280, crop: true, keys: ['furniture_mannequin_0'] },
  { id: 'furniture_mannequin_1', prompt: prop('A faceless matte pale-grey retail store mannequin with one arm raised and bent at the elbow in a frozen gesture, smooth featureless head, bare body on a slim pole base'), width: 96, height: 280, crop: true, keys: ['furniture_mannequin_1'] },
  { id: 'furniture_mannequin_2', prompt: prop('A headless matte pale-grey retail store mannequin torso leaning slightly forward with one shoulder dropped, bare body on a slim pole base'), width: 96, height: 280, crop: true, keys: ['furniture_mannequin_2'] },
  // Hospital.
  { id: 'furniture_wheelchair', prompt: prop('An empty hospital wheelchair seen from the front, chrome frame, dark vinyl seat and back, large rear wheels, footrests, slightly worn'), width: 150, height: 220, crop: true, keys: ['furniture_wheelchair'] },
  { id: 'furniture_iv_stand', prompt: prop('A tall thin chrome hospital IV drip stand on small castor wheels, an empty clear drip bag and hooks at the top, taller than a person'), width: 80, height: 300, crop: true, keys: ['furniture_iv_stand'] },
  { id: 'furniture_hospital_chairs', prompt: prop('A short row of three linked hospital waiting-room chairs, sickly teal vinyl seats on a chrome tube frame, empty, wider than tall'), width: 220, height: 190, crop: true, keys: ['furniture_hospital_chairs'] },
  { id: 'furniture_supply_cart', prompt: prop('A rolling hospital supply crash cart, a grey metal cabinet of drawers on castor wheels with a handle, clinical and a bit grimy'), width: 130, height: 210, crop: true, keys: ['furniture_supply_cart'] },
  // Hotel.
  { id: 'furniture_reception_desk', prompt: prop('A derelict hotel reception front desk seen from the front, dark wood panelling with a worn countertop, a small call bell and a grid of empty key cubbies behind, wider than tall'), width: 260, height: 190, crop: true, keys: ['furniture_reception_desk'] },
  { id: 'furniture_ice_machine', prompt: prop('A tall beige hotel ice and vending machine with a dispenser flap and a faint internal glow, scuffed institutional plastic, about person height'), width: 140, height: 270, crop: true, keys: ['furniture_ice_machine'] },
  { id: 'furniture_luggage_cart', prompt: prop('An empty brass bellhop luggage trolley cart on four black caster wheels, a low flat carpeted deck at the bottom with a single tall thin upright pole railing at the back and one horizontal hanging bar across the top, clearly a wheeled hotel luggage cart and NOT a door or archway'), width: 170, height: 220, crop: true, keys: ['furniture_luggage_cart'] },
  // Office.
  { id: 'furniture_filing_cabinet', prompt: prop('A tall grey metal four-drawer office filing cabinet, one drawer hanging open, dented and scuffed, about chest height'), width: 110, height: 250, crop: true, keys: ['furniture_filing_cabinet'] },
  { id: 'furniture_office_chair', prompt: prop('A black office swivel desk chair seen from the front, padded seat and back on a five-star wheeled base, slightly worn'), width: 150, height: 210, crop: true, keys: ['furniture_office_chair'] },
  { id: 'furniture_cubicle_partition', prompt: prop('A free-standing grey-beige fabric office cubicle partition wall panel on small feet, blank and featureless, wider than tall, about head height'), width: 250, height: 230, crop: true, keys: ['furniture_cubicle_partition'] },
  // Warehouse.
  { id: 'furniture_pallet_rack', prompt: prop('A tall orange and blue industrial steel pallet storage rack, two levels half-stocked with shrink-wrapped cardboard boxes, seen from the front, taller than a person'), width: 230, height: 260, crop: true, keys: ['furniture_pallet_rack'] },
  { id: 'furniture_forklift', prompt: prop('An idle yellow warehouse forklift seen from the front, twin lifting forks lowered to the ground, a roll cage over the seat, grimy and industrial'), width: 200, height: 250, crop: true, keys: ['furniture_forklift'] },
  { id: 'furniture_oil_barrel', prompt: prop('A rusted steel 55-gallon oil drum barrel standing upright, dented with a worn ribbed body, about hip-to-waist height'), width: 120, height: 200, crop: true, keys: ['furniture_oil_barrel'] },

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
