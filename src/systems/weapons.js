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

export function switchWeapon(state) {
  const otherSlot = state.activeSlot === 0 ? 1 : 0;
  if (state.slots[otherSlot] === null) return state;
  return { ...state, activeSlot: otherSlot };
}

export function pickupWeapon(state, weaponType, initialAmmo) {
  const ammoToSet = initialAmmo !== undefined ? initialAmmo : weaponType.startAmmo;
  const firstEmpty = state.slots[0] === null ? 0 : state.slots[1] === null ? 1 : -1;

  if (firstEmpty >= 0) {
    const newSlots = [...state.slots];
    newSlots[firstEmpty] = weaponType;
    const newAmmo = [...state.ammo];
    newAmmo[firstEmpty] = ammoToSet;
    return {
      state: { ...state, slots: newSlots, ammo: newAmmo },
      droppedWeapon: null,
    };
  }

  const dropped = state.slots[1];
  const droppedAmmo = state.ammo[1];
  const newSlots = [state.slots[0], weaponType];
  const newAmmo = [state.ammo[0], ammoToSet];
  return {
    state: { ...state, slots: newSlots, ammo: newAmmo },
    droppedWeapon: { ...dropped, ammo: droppedAmmo },
  };
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

export function generateRoomWeapon(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, furnitureItems, roomId) {
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
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = minX + rand() * (maxX - minX);
    const y = minY + rand() * (maxY - minY);

    let overlaps = false;
    for (const f of furnitureItems) {
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

