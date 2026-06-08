import { mulberry32 } from './random.js';

export const ITEM_TYPES = [
  { type: 'battery', value: 0, weight: 25, color: 0xffff00, size: { w: 10, h: 14 } },
  { type: 'ammo', value: 0, weight: 20, color: 0x88ff88, size: { w: 10, h: 10 } },
  { type: 'copper_coin', value: 10, weight: 30, color: 0xcd7f32, size: { w: 8, h: 8 } },
  { type: 'silver_coin', value: 50, weight: 15, color: 0xc0c0c0, size: { w: 8, h: 8 } },
  { type: 'gold_coin', value: 200, weight: 8, color: 0xffd700, size: { w: 8, h: 8 } },
  { type: 'gem', value: 1000, weight: 2, color: 0x00cccc, size: { w: 10, h: 10 } },
];

const TOTAL_WEIGHT = ITEM_TYPES.reduce((sum, t) => sum + t.weight, 0);

function pickWeightedType(rand) {
  const roll = rand() * TOTAL_WEIGHT;
  let cumulative = 0;
  for (const itemType of ITEM_TYPES) {
    cumulative += itemType.weight;
    if (roll < cumulative) return itemType;
  }
  return ITEM_TYPES[ITEM_TYPES.length - 1];
}

export function generateRoomItems(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, furnitureItems, roomId) {
  if (roomId === 0) return [];

  const rand = mulberry32(seed + 20000);
  const margin = 40;
  const minX = roomX + wallThickness + margin;
  const minY = roomY + wallThickness + margin;
  const maxX = roomX + roomWidth - wallThickness - margin;
  const maxY = roomY + roomHeight - wallThickness - margin;

  const count = 1 + Math.floor(rand() * 3);
  const placed = [];
  const itemRadius = 8;

  for (let attempt = 0; attempt < count * 20 && placed.length < count; attempt++) {
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
      const itemType = pickWeightedType(rand);
      placed.push({
        x,
        y,
        type: itemType.type,
        value: itemType.value,
        color: itemType.color,
        size: itemType.size,
      });
    }
  }

  return placed;
}
