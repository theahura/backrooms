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
  },
];

export function createWeaponState() {
  return {
    slots: [WEAPON_TYPES[0], null],
    activeSlot: 0,
  };
}

export function switchWeapon(state) {
  const otherSlot = state.activeSlot === 0 ? 1 : 0;
  if (state.slots[otherSlot] === null) return state;
  return { ...state, activeSlot: otherSlot };
}

export function pickupWeapon(state, weaponType) {
  if (state.slots[1] === null) {
    return {
      state: { ...state, slots: [state.slots[0], weaponType] },
      droppedWeapon: null,
    };
  }
  const dropped = state.slots[1];
  return {
    state: { ...state, slots: [state.slots[0], weaponType] },
    droppedWeapon: dropped,
  };
}

export function getActiveWeapon(state) {
  return state.slots[state.activeSlot];
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

export function generateLevelWeapon(rooms, seed, furnitureByRoom) {
  const nonZeroRooms = rooms.filter(r => r.id !== 0);
  if (nonZeroRooms.length === 0) return null;

  const rand = mulberry32(seed + 60000);
  const roomIndex = Math.floor(rand() * nonZeroRooms.length);
  const room = nonZeroRooms[roomIndex];

  const furniture = furnitureByRoom.get(room.id) || [];
  return generateRoomWeapon(room.x, room.y, room.width, room.height, 16, seed, furniture, room.id);
}

export function generateRoomWeapon(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, furnitureItems, roomId) {
  if (roomId === 0) return null;

  const rand = mulberry32(seed + 60000);
  const margin = 40;
  const minX = roomX + wallThickness + margin;
  const minY = roomY + wallThickness + margin;
  const maxX = roomX + roomWidth - wallThickness - margin;
  const maxY = roomY + roomHeight - wallThickness - margin;

  const pickableWeapons = WEAPON_TYPES.filter(w => w.id !== 'pistol');
  const weaponIndex = Math.floor(rand() * pickableWeapons.length);
  const weapon = pickableWeapons[weaponIndex];

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
