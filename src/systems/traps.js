import { mulberry32 } from './random.js';

export const TRAP_TYPES = [
  { type: 'spike', damage: 15, cooldown: 3000, singleUse: false },
  { type: 'noise', damage: 0, cooldown: 0, singleUse: true },
];

const SEED_OFFSET = 110000;

export function generateRoomTraps(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, furnitureItems, roomId, distance = 0) {
  if (roomId === 0) return [];
  if (distance < 2) return [];

  const rand = mulberry32(seed + SEED_OFFSET);
  const margin = 40;
  const minX = roomX + wallThickness + margin;
  const minY = roomY + wallThickness + margin;
  const maxX = roomX + roomWidth - wallThickness - margin;
  const maxY = roomY + roomHeight - wallThickness - margin;

  const roll = rand();
  let trapDef = null;

  if (distance >= 3 && roll < 0.15) {
    trapDef = TRAP_TYPES.find(t => t.type === 'noise');
  } else if (roll >= 0.15 && roll < 0.35) {
    trapDef = TRAP_TYPES.find(t => t.type === 'spike');
  }

  if (!trapDef) return [];

  const trapRadius = 10;
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = minX + rand() * (maxX - minX);
    const y = minY + rand() * (maxY - minY);

    let overlaps = false;
    for (const f of furnitureItems) {
      if (
        x >= f.x - trapRadius &&
        x <= f.x + f.width + trapRadius &&
        y >= f.y - trapRadius &&
        y <= f.y + f.height + trapRadius
      ) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      return [{
        x,
        y,
        type: trapDef.type,
        damage: trapDef.damage,
        cooldown: trapDef.cooldown,
        singleUse: trapDef.singleUse,
      }];
    }
  }

  return [];
}
