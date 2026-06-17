import { mulberry32 } from './random.js';

export const WEAPON_TYPES = [
  {
    id: 'pistol',
    name: 'Pistol',
    damage: 25,
    fireRate: 200,
    speed: 500,
    range: 600,
    bulletCount: 1,
    spreadAngle: 0,
    color: 0xffdd44,
    pickupColor: 0xaaaa44,
    maxAmmo: 50,
    startAmmo: 15,
    noiseRange: 1,
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    damage: 10,
    fireRate: 800,
    speed: 400,
    range: 350,
    bulletCount: 4,
    spreadAngle: Math.PI / 5,
    color: 0xff8844,
    pickupColor: 0xcc6633,
    maxAmmo: 20,
    startAmmo: 6,
    noiseRange: 2,
  },
  {
    id: 'rifle',
    name: 'Rifle',
    damage: 50,
    fireRate: 600,
    speed: 600,
    range: 900,
    bulletCount: 1,
    spreadAngle: 0,
    color: 0x44ddff,
    pickupColor: 0x3399aa,
    maxAmmo: 15,
    startAmmo: 4,
    noiseRange: 1,
  },
];

export const AMMO_PER_PICKUP = {
  pistol: 10,
  shotgun: 4,
  rifle: 3,
};

export function createWeaponState(options = {}) {
  const startingWeapons = [];
  if (options.startingRifle) startingWeapons.push(WEAPON_TYPES.find(w => w.id === 'rifle'));
  if (options.startingShotgun) startingWeapons.push(WEAPON_TYPES.find(w => w.id === 'shotgun'));
  if (options.startingPistol) startingWeapons.push(WEAPON_TYPES.find(w => w.id === 'pistol'));

  const slots = [startingWeapons[0] || null, startingWeapons[1] || null];
  return {
    slots,
    activeSlot: 0,
    ammo: [
      slots[0] ? slots[0].startAmmo : 0,
      slots[1] ? slots[1].startAmmo : 0,
    ],
  };
}

// Pare a live loadout down to weapon ids + ammo for the save. Storing ids (not
// the full weapon objects) keeps saved loadouts from carrying stale stats if a
// weapon's definition changes -- they rehydrate from WEAPON_TYPES on load.
export function serializeWeaponState(state) {
  return {
    slots: state.slots.map((w) => (w ? w.id : null)),
    activeSlot: state.activeSlot,
    ammo: [...state.ammo],
  };
}

// Rebuild a loadout from serialized ids, pulling current weapon definitions.
// Unknown ids become empty slots; absent/malformed data returns null so callers
// fall back to the starting loadout.
export function deserializeWeaponState(data) {
  if (!data || !Array.isArray(data.slots)) return null;
  const slots = [0, 1].map((i) => {
    const id = data.slots[i];
    return id ? (WEAPON_TYPES.find((w) => w.id === id) || null) : null;
  });
  const ammo = [0, 1].map((i) => (Number.isFinite(data.ammo?.[i]) ? data.ammo[i] : 0));
  const activeSlot = data.activeSlot === 1 && slots[1] ? 1 : 0;
  return { slots, activeSlot, ammo };
}

// Guarantee the player's owned starting-weapon upgrades are present: fill any
// empty slot (rifle > shotgun > pistol priority, matching createWeaponState)
// with an owned starting weapon not already carried. Never overwrites a carried
// weapon, never duplicates, and respects the two-slot cap.
export function fillStartingWeapons(state, options = {}) {
  const wanted = [];
  if (options.startingRifle) wanted.push('rifle');
  if (options.startingShotgun) wanted.push('shotgun');
  if (options.startingPistol) wanted.push('pistol');

  const slots = [...state.slots];
  const ammo = [...state.ammo];
  for (const id of wanted) {
    if (slots.some((w) => w && w.id === id)) continue;
    const empty = slots[0] === null ? 0 : slots[1] === null ? 1 : -1;
    if (empty < 0) break;
    const weapon = WEAPON_TYPES.find((w) => w.id === id);
    slots[empty] = weapon;
    ammo[empty] = weapon.startAmmo;
  }
  return { ...state, slots, ammo };
}

export function switchWeapon(state) {
  const otherSlot = state.activeSlot === 0 ? 1 : 0;
  if (state.slots[otherSlot] === null) return state;
  return { ...state, activeSlot: otherSlot };
}

// Classify what grabbing `weaponType` off the floor should do given the current
// loadout: 'equip' a free slot, dump it as 'ammo' into an already-owned copy,
// skip it ('full') because that copy is already maxed, or 'swap' it for the
// second weapon when both slots hold different guns.
export function weaponPickupOutcome(state, weaponType) {
  const ownedSlot = state.slots.findIndex((w) => w && w.id === weaponType.id);
  if (ownedSlot >= 0) {
    return state.ammo[ownedSlot] >= weaponType.maxAmmo ? 'full' : 'ammo';
  }
  return state.slots.includes(null) ? 'equip' : 'swap';
}

export function pickupWeapon(state, weaponType, initialAmmo) {
  const ammoToSet = initialAmmo !== undefined ? initialAmmo : weaponType.startAmmo;

  // A duplicate of a carried weapon is not a second copy -- its magazine is
  // poured into the slot already holding that weapon (capped at maxAmmo).
  const ownedSlot = state.slots.findIndex((w) => w && w.id === weaponType.id);
  if (ownedSlot >= 0) {
    const newAmmo = [...state.ammo];
    newAmmo[ownedSlot] = Math.min(newAmmo[ownedSlot] + ammoToSet, weaponType.maxAmmo);
    return {
      state: { ...state, ammo: newAmmo },
      droppedWeapon: null,
      addedAmmo: true,
    };
  }

  const firstEmpty = state.slots[0] === null ? 0 : state.slots[1] === null ? 1 : -1;

  if (firstEmpty >= 0) {
    const newSlots = [...state.slots];
    newSlots[firstEmpty] = weaponType;
    const newAmmo = [...state.ammo];
    newAmmo[firstEmpty] = ammoToSet;
    return {
      state: { ...state, slots: newSlots, ammo: newAmmo },
      droppedWeapon: null,
      addedAmmo: false,
    };
  }

  const dropped = state.slots[1];
  const droppedAmmo = state.ammo[1];
  const newSlots = [state.slots[0], weaponType];
  const newAmmo = [state.ammo[0], ammoToSet];
  return {
    state: { ...state, slots: newSlots, ammo: newAmmo },
    droppedWeapon: { ...dropped, ammo: droppedAmmo },
    addedAmmo: false,
  };
}

// Top every equipped weapon up to its max ammo (empty slots untouched). Used to
// apply a shop "Ammo" purchase at the start of a run.
export function refillAllAmmo(state) {
  const ammo = state.slots.map((w, i) => (w ? w.maxAmmo : state.ammo[i]));
  return { ...state, ammo };
}

export function getActiveWeapon(state) {
  return state.slots[state.activeSlot];
}

export function hasAmmo(state) {
  const weapon = state.slots[state.activeSlot];
  if (!weapon) return false;
  return state.ammo[state.activeSlot] > 0;
}

export function consumeAmmo(state) {
  const weapon = state.slots[state.activeSlot];
  if (!weapon) return state;
  const current = state.ammo[state.activeSlot];
  if (current <= 0) return state;
  const newAmmo = [...state.ammo];
  newAmmo[state.activeSlot] = current - 1;
  return { ...state, ammo: newAmmo };
}

export function addAmmo(state, amount) {
  const weapon = state.slots[state.activeSlot];
  if (!weapon) return state;
  const current = state.ammo[state.activeSlot];
  const newAmmo = [...state.ammo];
  newAmmo[state.activeSlot] = Math.min(current + amount, weapon.maxAmmo);
  return { ...state, ammo: newAmmo };
}

const MIN_FIRE_RATE = 50;

export function getEffectiveStats(weapon, bonuses) {
  return {
    damage: weapon.damage + bonuses.damage,
    fireRate: Math.max(MIN_FIRE_RATE, weapon.fireRate + bonuses.fireRate),
    speed: weapon.speed,
    range: weapon.range + bonuses.range,
    bulletCount: weapon.bulletCount,
    spreadAngle: weapon.spreadAngle,
    color: weapon.color,
  };
}

export function generateLevelWeapons(rooms, seed, furnitureByRoom) {
  const floors = [...new Set(rooms.map(r => r.floor))];
  const results = [];

  for (const floor of floors) {
    const floorRooms = rooms.filter(r => r.floor === floor && r.id !== 0);
    if (floorRooms.length === 0) continue;

    const rand = mulberry32(seed + 60000 + floor * 100);
    const roomIndex = Math.floor(rand() * floorRooms.length);
    const room = floorRooms[roomIndex];

    const furniture = furnitureByRoom.get(room.id) || [];
    const weapon = generateRoomWeapon(room.x, room.y, room.width, room.height, 16, seed + floor * 100, furniture, room.id);
    if (weapon) results.push(weapon);
  }

  return results;
}

export function generateRoomWeapon(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, furnitureItems, roomId, obstacles = []) {
  if (roomId === 0) return null;

  const rand = mulberry32(seed + 60000);
  const margin = 40;
  const minX = roomX + wallThickness + margin;
  const minY = roomY + wallThickness + margin;
  const maxX = roomX + roomWidth - wallThickness - margin;
  const maxY = roomY + roomHeight - wallThickness - margin;

  const weaponIndex = Math.floor(rand() * WEAPON_TYPES.length);
  const weapon = WEAPON_TYPES[weaponIndex];

  const itemRadius = 12;
  const blockers = obstacles.length ? furnitureItems.concat(obstacles) : furnitureItems;
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = minX + rand() * (maxX - minX);
    const y = minY + rand() * (maxY - minY);

    let overlaps = false;
    for (const f of blockers) {
      if (
        x >= f.x - itemRadius &&
        x <= f.x + f.width + itemRadius &&
        y >= f.y - itemRadius &&
        y <= f.y + f.height + itemRadius
      ) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      return { x, y, weaponId: weapon.id, roomId };
    }
  }

  return null;
}

